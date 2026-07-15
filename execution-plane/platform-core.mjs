import { createHmac, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { runDemoExecution } from "./demo-runner.mjs";
import { FilePlatformStore } from "./persistence.mjs";
import {
  CONTRACT_VERSION,
  CUSTOMER_EVENT_TYPES,
  FINAL_STATUSES,
  clampInteger,
  getDriverCatalog,
  normalizeRequest,
  nowIso,
  publicJob,
  runCommandDriver,
  safeId,
} from "./platform-runtime.mjs";

const EVENT_TO_AUDIT = {
  plan: "agent.plan",
  file_diff: "filesystem.diff",
  command_run: "command.executed",
  test_result: "test.completed",
  question: "agent.question",
  usage: "usage.reported",
  done: "job.completed",
  error: "job.failed",
};

const ROLE_ACTIONS = {
  owner: ["job:create", "job:read", "job:cancel", "evidence:add", "approval:record", "promotion:create", "artifact:write", "analytics:read"],
  admin: ["job:create", "job:read", "job:cancel", "evidence:add", "approval:record", "promotion:create", "artifact:write", "analytics:read"],
  engineer: ["job:create", "job:read", "evidence:add", "artifact:write"],
  approver: ["job:read", "approval:record"],
  auditor: ["job:read", "analytics:read"],
  system: ["job:create", "job:read", "job:cancel", "evidence:add", "approval:record", "promotion:create", "artifact:write", "analytics:read"],
};

function authorize(actor, action) {
  const role = String(actor?.role || "system");
  if (!(ROLE_ACTIONS[role] || []).includes(action)) throw new Error(`Role ${role} cannot perform ${action}.`);
}

function requestApprovalKeys(job, result) {
  if (job.request.requiredApprovals.length) return job.request.requiredApprovals;
  return Array.isArray(result?.promotionPackage?.approvalsRequired)
    ? result.promotionPackage.approvalsRequired.map((value) => String(value).trim()).filter(Boolean).slice(0, 25)
    : [];
}

export function createPlatformCore(options = {}) {
  const dataDir = resolve(options.dataDir || process.env.FDE_DATA_DIR || "/tmp/fde-execution-data");
  const store = new FilePlatformStore(dataDir);
  const callbackSecret = options.callbackSecret || process.env.FDE_CALLBACK_SIGNING_SECRET || process.env.FDE_EXECUTION_SIGNING_SECRET || "local-demo-signing-secret";
  const maxConcurrent = clampInteger(options.maxConcurrent || process.env.FDE_MAX_CONCURRENT_JOBS, 2, 1, 64);
  const perTenantConcurrent = clampInteger(options.perTenantConcurrent || process.env.FDE_MAX_CONCURRENT_JOBS_PER_TENANT, 1, 1, 32);
  const maxQueued = clampInteger(options.maxQueued || process.env.FDE_MAX_QUEUED_JOBS, 100, 1, 10_000);
  const queue = [];
  const runningByTenant = new Map();
  let running = 0;

  async function init() {
    await store.init();
    const jobs = await store.listAllJobs();
    for (const job of jobs) {
      if (job.status === "running") {
        job.status = "failed";
        job.error = "Execution plane restarted while this job was running.";
        job.completedAt = nowIso();
        await store.saveJob(job);
        await store.appendAudit(job.tenantId, job.id, "job.failed", { reason: "execution-plane-restarted" });
      } else if (job.status === "queued") {
        queue.push({ tenantId: job.tenantId, jobId: job.id });
      }
    }
    void pump();
  }

  async function deliverCallback(job, eventType) {
    if (!job.callback?.url) return;
    const body = JSON.stringify({ contractVersion: CONTRACT_VERSION, eventType, job: publicJob(job) });
    const timestamp = Date.now().toString();
    const signature = `sha256=${createHmac("sha256", callbackSecret).update(`${timestamp}.${body}`).digest("hex")}`;
    const delivery = { eventType, attemptedAt: nowIso(), status: "pending" };
    try {
      const response = await fetch(job.callback.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-fde-timestamp": timestamp,
          "x-fde-signature": signature,
          "x-fde-job-id": job.id,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      delivery.status = response.ok ? "delivered" : "failed";
      delivery.httpStatus = response.status;
      await store.appendAudit(job.tenantId, job.id, response.ok ? "callback.delivered" : "callback.failed", delivery);
    } catch (error) {
      delivery.status = "failed";
      delivery.error = error instanceof Error ? error.message : "Callback failed";
      await store.appendAudit(job.tenantId, job.id, "callback.failed", delivery);
    }
    await store.mutateJob(job.tenantId, job.id, (current) => {
      current.callback.deliveries.push(delivery);
      return current;
    });
  }

  async function createJob(input) {
    const request = normalizeRequest(input);
    authorize(request.actor, "job:create");
    if (queue.length >= maxQueued) throw new Error("Execution queue is at capacity.");
    const id = `fdejob-${randomUUID().slice(0, 12)}`;
    const timestamp = nowIso();
    const job = {
      id,
      tenantId: request.tenantId,
      organizationId: request.organizationId,
      engagementId: request.engagementId,
      status: "queued",
      approvalStatus: request.requiredApprovals.length ? "pending" : "not-configured",
      approvals: [],
      evidence: [],
      usage: { costUsd: 0, eventCount: 0 },
      callback: request.callbackUrl ? { url: request.callbackUrl, deliveries: [] } : null,
      request,
      result: null,
      error: null,
      promotion: null,
      merge: null,
      createdAt: timestamp,
      acceptedAt: timestamp,
      queuedAt: timestamp,
      startedAt: null,
      completedAt: null,
      approvedAt: null,
      promotedAt: null,
      mergedAt: null,
      updatedAt: timestamp,
      externalSequence: 0,
    };
    await store.saveJob(job);
    await store.appendAudit(job.tenantId, id, "job.accepted", { driverId: request.driverId, limits: request.limits }, "fde-control-plane");
    await store.appendAudit(job.tenantId, id, "policy.bound", request.policy, "fde-control-plane");
    await store.appendAudit(job.tenantId, id, "job.queued", { queueDepth: queue.length + 1 });
    queue.push({ tenantId: job.tenantId, jobId: id });
    void pump();
    return publicJob(job);
  }

  function canStart(tenantId) {
    return running < maxConcurrent && (runningByTenant.get(tenantId) || 0) < perTenantConcurrent;
  }

  async function pump() {
    let found = true;
    while (found) {
      found = false;
      const index = queue.findIndex((entry) => canStart(entry.tenantId));
      if (index < 0) break;
      const [entry] = queue.splice(index, 1);
      running += 1;
      runningByTenant.set(entry.tenantId, (runningByTenant.get(entry.tenantId) || 0) + 1);
      found = true;
      void executeJob(entry.tenantId, entry.jobId).finally(() => {
        running -= 1;
        runningByTenant.set(entry.tenantId, Math.max(0, (runningByTenant.get(entry.tenantId) || 1) - 1));
        void pump();
      });
    }
  }

  async function emitObservedEvent(job, event) {
    const type = EVENT_TO_AUDIT[event.type] || "evidence.ingested";
    await store.appendAudit(job.tenantId, job.id, type, event.payload || {}, event.source || "agent-driver");
    await store.mutateJob(job.tenantId, job.id, (current) => {
      current.usage.eventCount += 1;
      if (current.usage.eventCount > current.request.limits.maxEvents) throw new Error("Job exceeded maxEvents.");
      if (event.type === "usage") {
        const cost = Number(event.payload?.costUsd ?? event.payload?.totalCostUsd ?? event.payload?.total_cost_usd ?? 0) || 0;
        current.usage.costUsd = Math.max(current.usage.costUsd, cost);
        if (current.usage.costUsd > current.request.limits.maxCostUsd) throw new Error("Job exceeded maxCostUsd.");
      }
      return current;
    });
  }

  async function executeJob(tenantId, jobId) {
    let job = await store.mutateJob(tenantId, jobId, (current) => {
      if (current.status === "cancelled") return current;
      current.status = "running";
      current.startedAt = nowIso();
      return current;
    });
    if (job.status === "cancelled") return;
    await store.appendAudit(tenantId, jobId, "job.started", { driverId: job.request.driverId });
    await store.appendAudit(tenantId, jobId, "driver.selected", { driverId: job.request.driverId, sandboxId: job.request.sandboxId });

    if (job.request.driverId === "customer-agent-gateway") {
      await deliverCallback(job, "job.ready-for-customer-agent");
      return;
    }

    try {
      let result;
      if (job.request.driverId === "fde-demo-agent") {
        result = await runDemoExecution({
          ...job.request,
          scenario: job.request.scenario || "enterprise-ai",
          clientAsk: job.request.intent,
          codingAgentId: "fde-demo-agent",
          approvalMode: "human-required",
        });
        for (const file of result.provenance?.filesystemDiff || []) await emitObservedEvent(job, { type: "file_diff", payload: file, source: "fde-execution-plane" });
        for (const command of result.provenance?.commands || []) await emitObservedEvent(job, { type: "command_run", payload: command, source: "fde-execution-plane" });
        for (const test of result.provenance?.tests || []) await emitObservedEvent(job, { type: "test_result", payload: test, source: "fde-execution-plane" });
      } else {
        result = await runCommandDriver(job.request, (event) => emitObservedEvent(job, event));
      }

      job = await store.mutateJob(tenantId, jobId, (current) => {
        current.status = "completed";
        current.result = result;
        current.error = null;
        current.completedAt = nowIso();
        const required = requestApprovalKeys(current, result);
        current.request.requiredApprovals = required;
        current.approvalStatus = required.length ? "pending" : "not-configured";
        return current;
      });
      await store.appendAudit(tenantId, jobId, "job.completed", { driverId: job.request.driverId, costUsd: job.usage.costUsd });
      await deliverCallback(job, "job.completed");
    } catch (error) {
      job = await store.mutateJob(tenantId, jobId, (current) => {
        current.status = "failed";
        current.error = error instanceof Error ? error.message : "Execution failed.";
        current.completedAt = nowIso();
        return current;
      });
      await store.appendAudit(tenantId, jobId, "job.failed", { error: job.error });
      await deliverCallback(job, "job.failed");
    }
  }

  async function ingestCustomerEvent(input) {
    const tenantId = safeId(input.tenantId, "tenant ID");
    const jobId = safeId(input.jobId, "job ID");
    const sequence = clampInteger(input.sequence, 0, 1, Number.MAX_SAFE_INTEGER);
    if (!CUSTOMER_EVENT_TYPES.has(input.event?.type)) throw new Error("Unsupported customer-agent event type.");
    let job = await store.mutateJob(tenantId, jobId, (current) => {
      if (current.request.driverId !== "customer-agent-gateway") throw new Error("Job is not assigned to the customer-agent gateway.");
      if (FINAL_STATUSES.has(current.status)) throw new Error("Job is already final.");
      if (sequence !== current.externalSequence + 1) throw new Error("Customer-agent event sequence is not contiguous.");
      current.externalSequence = sequence;
      current.usage.eventCount += 1;
      if (current.usage.eventCount > current.request.limits.maxEvents) throw new Error("Job exceeded maxEvents.");
      return current;
    });
    await store.appendAudit(tenantId, jobId, EVENT_TO_AUDIT[input.event.type], input.event.payload || {}, "customer-gateway");

    if (input.event.type === "usage") {
      job = await store.mutateJob(tenantId, jobId, (current) => {
        const cost = Number(input.event.payload?.costUsd || 0) || 0;
        current.usage.costUsd = Math.max(current.usage.costUsd, cost);
        if (current.usage.costUsd > current.request.limits.maxCostUsd) throw new Error("Job exceeded maxCostUsd.");
        return current;
      });
    }
    if (["done", "error"].includes(input.event.type)) {
      job = await store.mutateJob(tenantId, jobId, (current) => {
        current.status = input.event.type === "done" ? "completed" : "failed";
        current.result = input.event.type === "done" ? input.event.payload : null;
        current.error = input.event.type === "error" ? String(input.event.payload?.message || "Customer agent failed.") : null;
        current.completedAt = nowIso();
        return current;
      });
      await deliverCallback(job, input.event.type === "done" ? "job.completed" : "job.failed");
    }
    return publicJob(job);
  }

  async function addEvidence(tenantId, jobId, input, actor = { role: "system" }) {
    authorize(actor, "evidence:add");
    const evidence = {
      id: `ev-${randomUUID().slice(0, 10)}`,
      kind: safeId(input.kind || "evidence", "evidence kind"),
      source: input.source || "external",
      status: input.status || "recorded",
      summary: String(input.summary || "").slice(0, 4000),
      payload: input.payload && typeof input.payload === "object" ? input.payload : {},
      observedAt: input.observedAt || nowIso(),
    };
    const job = await store.mutateJob(tenantId, jobId, (current) => {
      current.evidence.push(evidence);
      return current;
    });
    await store.appendAudit(tenantId, jobId, "evidence.ingested", evidence, input.source === "ci" ? "ci-ingestion" : "fde-control-plane");
    return { job: publicJob(job), evidence };
  }

  async function recordApproval(tenantId, jobId, input) {
    authorize(input.actor, "approval:record");
    const approvalKey = String(input.approvalKey || "").trim();
    if (!approvalKey) throw new Error("approvalKey is required.");
    const decision = input.decision === "reject" ? "rejected" : "approved";
    const job = await store.mutateJob(tenantId, jobId, (current) => {
      if (!current.request.policy.humanApprovalRequired) throw new Error("This job does not require human approval.");
      if (!current.request.requiredApprovals.includes(approvalKey)) throw new Error("approvalKey is not required for this job.");
      const record = {
        id: `approval-${randomUUID().slice(0, 10)}`,
        approvalKey,
        decision,
        actor: { id: safeId(input.actor?.id, "approval actor ID"), role: safeId(input.actor?.role, "approval actor role") },
        comment: String(input.comment || "").slice(0, 4000),
        decidedAt: nowIso(),
      };
      current.approvals = current.approvals.filter((item) => item.approvalKey !== approvalKey);
      current.approvals.push(record);
      const rejected = current.approvals.some((item) => item.decision === "rejected");
      const complete = current.request.requiredApprovals.every((key) => current.approvals.some((item) => item.approvalKey === key && item.decision === "approved"));
      current.approvalStatus = rejected ? "rejected" : complete ? "approved" : "pending";
      if (complete) current.approvedAt = nowIso();
      return current;
    });
    await store.appendAudit(tenantId, jobId, "approval.recorded", job.approvals.find((item) => item.approvalKey === approvalKey), "fde-control-plane");
    await deliverCallback(job, "approval.recorded");
    return publicJob(job);
  }

  async function cancelJob(tenantId, jobId, actor = { role: "system" }) {
    authorize(actor, "job:cancel");
    const job = await store.mutateJob(tenantId, jobId, (current) => {
      if (FINAL_STATUSES.has(current.status)) return current;
      current.status = "cancelled";
      current.completedAt = nowIso();
      current.error = `Cancelled by ${actor.id || "control-plane"}.`;
      return current;
    });
    await store.appendAudit(tenantId, jobId, "job.cancelled", { actor });
    return publicJob(job);
  }

  async function createArtifact(input, actor = { role: "system" }) {
    authorize(actor, "artifact:write");
    return store.saveArtifact({
      tenantId: safeId(input.tenantId, "tenant ID"),
      organizationId: input.organizationId ? safeId(input.organizationId, "organization ID") : input.tenantId,
      name: String(input.name || "Reusable delivery artifact").slice(0, 200),
      type: safeId(input.type || "delivery-pattern", "artifact type"),
      classification: input.classification || "sanitized-pattern",
      sourceJobId: input.sourceJobId || null,
      tags: Array.isArray(input.tags) ? input.tags.map(String).slice(0, 50) : [],
      contentRef: input.contentRef || null,
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    });
  }

  async function analytics(tenantId, actor = { role: "system" }) {
    authorize(actor, "analytics:read");
    const jobs = await store.listJobs(tenantId);
    const durations = (startKey, endKey) => jobs.filter((job) => job[startKey] && job[endKey])
      .map((job) => new Date(job[endKey]).getTime() - new Date(job[startKey]).getTime()).sort((a, b) => a - b);
    const median = (values) => values.length ? values[Math.floor(values.length / 2)] : null;
    return {
      tenantId,
      jobs: jobs.length,
      completed: jobs.filter((job) => job.status === "completed").length,
      failed: jobs.filter((job) => job.status === "failed").length,
      approved: jobs.filter((job) => job.approvalStatus === "approved").length,
      promoted: jobs.filter((job) => job.promotedAt).length,
      merged: jobs.filter((job) => job.mergedAt).length,
      medianAskToCompletedMs: median(durations("acceptedAt", "completedAt")),
      medianAskToApprovedMs: median(durations("acceptedAt", "approvedAt")),
      medianAskToPromotedMs: median(durations("acceptedAt", "promotedAt")),
      medianAskToMergedMs: median(durations("acceptedAt", "mergedAt")),
      totalCostUsd: jobs.reduce((sum, job) => sum + Number(job.usage?.costUsd || 0), 0),
    };
  }

  async function markPromoted(tenantId, jobId, promotion, actor = { role: "system" }) {
    authorize(actor, "promotion:create");
    const job = await store.mutateJob(tenantId, jobId, (current) => {
      current.promotion = promotion;
      current.promotedAt = promotion.promotedAt || nowIso();
      return current;
    });
    await store.appendAudit(tenantId, jobId, "promotion.completed", promotion, "scm-driver");
    await deliverCallback(job, "promotion.completed");
    return publicJob(job);
  }

  async function markMerged(tenantId, jobId, input = {}) {
    const job = await store.mutateJob(tenantId, jobId, (current) => {
      current.mergedAt = input.mergedAt || nowIso();
      current.merge = {
        provider: input.provider || "github",
        mergeCommitSha: input.mergeCommitSha || null,
        pullRequestNumber: input.pullRequestNumber || current.promotion?.pullRequestNumber || null,
        pullRequestUrl: input.pullRequestUrl || current.promotion?.pullRequestUrl || null,
      };
      return current;
    });
    await store.appendAudit(tenantId, jobId, "evidence.ingested", { kind: "scm.merge", ...job.merge }, "scm-driver");
    await deliverCallback(job, "job.merged");
    return publicJob(job);
  }

  return {
    dataDir,
    init,
    createJob,
    getJob: async (tenantId, jobId) => publicJob(await store.getJob(tenantId, jobId)),
    locateJob: async (jobId, tenantId) => publicJob(await store.locateJob(jobId, tenantId)),
    getRawJob: (jobId, tenantId) => store.locateJob(jobId, tenantId),
    getAudit: (tenantId, jobId) => store.getAudit(tenantId, jobId),
    ingestCustomerEvent,
    addEvidence,
    recordApproval,
    cancelJob,
    createArtifact,
    listArtifacts: (tenantId) => store.listArtifacts(tenantId),
    analytics,
    markPromoted,
    markMerged,
    getDriverCatalog,
    authorize,
    queueStats: () => ({ queued: queue.length, running, maxConcurrent, perTenantConcurrent, maxQueued }),
  };
}

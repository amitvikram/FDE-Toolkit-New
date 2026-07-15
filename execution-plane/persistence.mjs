import { appendFile, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { ZERO_HASH, nowIso, safeId, sha256, stableJson } from "./platform-runtime.mjs";

async function atomicWrite(path, value) {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, value, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}

export class FilePlatformStore {
  constructor(dataDir) {
    this.dataDir = resolve(dataDir);
    this.jobsRoot = join(this.dataDir, "jobs");
    this.auditRoot = join(this.dataDir, "audit");
    this.artifactsRoot = join(this.dataDir, "artifacts");
    this.locks = new Map();
  }

  async init() {
    await Promise.all([this.jobsRoot, this.auditRoot, this.artifactsRoot].map((path) => mkdir(path, { recursive: true, mode: 0o700 })));
  }

  tenantPath(root, tenantId) {
    return join(root, safeId(tenantId, "tenant ID"));
  }

  jobPath(tenantId, jobId) {
    return join(this.tenantPath(this.jobsRoot, tenantId), `${safeId(jobId, "job ID")}.json`);
  }

  auditPath(tenantId, jobId) {
    return join(this.tenantPath(this.auditRoot, tenantId), `${safeId(jobId, "job ID")}.jsonl`);
  }

  async withLock(key, operation) {
    const previous = this.locks.get(key) || Promise.resolve();
    const next = previous.then(operation, operation);
    const guarded = next.catch(() => {});
    this.locks.set(key, guarded);
    try {
      return await next;
    } finally {
      if (this.locks.get(key) === guarded) this.locks.delete(key);
    }
  }

  async saveJob(job) {
    const directory = this.tenantPath(this.jobsRoot, job.tenantId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    job.updatedAt = nowIso();
    await atomicWrite(this.jobPath(job.tenantId, job.id), `${JSON.stringify(job, null, 2)}\n`);
    return job;
  }

  async getJob(tenantId, jobId) {
    try {
      return JSON.parse(await readFile(this.jobPath(tenantId, jobId), "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async locateJob(jobId, requestedTenantId) {
    if (requestedTenantId) return this.getJob(requestedTenantId, jobId);
    const tenants = await readdir(this.jobsRoot).catch(() => []);
    for (const tenant of tenants) {
      const job = await this.getJob(tenant, jobId);
      if (job) return job;
    }
    return null;
  }

  async mutateJob(tenantId, jobId, mutation) {
    return this.withLock(`job:${tenantId}:${jobId}`, async () => {
      const job = await this.getJob(tenantId, jobId);
      if (!job) throw new Error("Job not found.");
      const updated = await mutation(job) || job;
      return this.saveJob(updated);
    });
  }

  async listJobs(tenantId) {
    const directory = this.tenantPath(this.jobsRoot, tenantId);
    const files = await readdir(directory).catch(() => []);
    return Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) => JSON.parse(await readFile(join(directory, file), "utf8"))));
  }

  async listAllJobs() {
    const tenants = await readdir(this.jobsRoot).catch(() => []);
    const groups = await Promise.all(tenants.map((tenant) => this.listJobs(tenant)));
    return groups.flat();
  }

  async appendAudit(tenantId, jobId, type, payload = {}, source = "fde-execution-plane") {
    return this.withLock(`audit:${tenantId}:${jobId}`, async () => {
      const directory = this.tenantPath(this.auditRoot, tenantId);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const path = this.auditPath(tenantId, jobId);
      let previousHash = ZERO_HASH;
      let sequence = 1;
      try {
        const existing = (await readFile(path, "utf8")).trim().split(/\r?\n/).filter(Boolean);
        if (existing.length) {
          const last = JSON.parse(existing.at(-1));
          previousHash = last.hash;
          sequence = last.sequence + 1;
        }
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      const unsigned = {
        formatVersion: "1.0",
        sequence,
        tenantId,
        jobId,
        type,
        observedAt: nowIso(),
        source,
        payload,
        previousHash,
      };
      const record = { ...unsigned, hash: sha256(stableJson(unsigned)) };
      await appendFile(path, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
      return record;
    });
  }

  async getAudit(tenantId, jobId) {
    try {
      const records = (await readFile(this.auditPath(tenantId, jobId), "utf8"))
        .trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
      let previousHash = ZERO_HASH;
      let verified = true;
      for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        const { hash, ...unsigned } = record;
        if (record.sequence !== index + 1 || record.previousHash !== previousHash || hash !== sha256(stableJson(unsigned))) {
          verified = false;
          break;
        }
        previousHash = hash;
      }
      return { records, verified, headHash: records.at(-1)?.hash || ZERO_HASH };
    } catch (error) {
      if (error?.code === "ENOENT") return { records: [], verified: true, headHash: ZERO_HASH };
      throw error;
    }
  }

  async saveArtifact(input) {
    const tenantId = safeId(input.tenantId, "tenant ID");
    const id = input.id || `artifact-${randomUUID().slice(0, 12)}`;
    const artifact = { ...input, id, tenantId, createdAt: input.createdAt || nowIso() };
    const directory = this.tenantPath(this.artifactsRoot, tenantId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await atomicWrite(join(directory, `${id}.json`), `${JSON.stringify(artifact, null, 2)}\n`);
    return artifact;
  }

  async listArtifacts(tenantId) {
    const directory = this.tenantPath(this.artifactsRoot, tenantId);
    const files = await readdir(directory).catch(() => []);
    return Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) => JSON.parse(await readFile(join(directory, file), "utf8"))));
  }
}

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile, readFile, readdir } from "node:fs/promises";
import { delimiter, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { safeId, nowIso } from "./platform-runtime.mjs";

function findExecutable(command) {
  if (!command) return false;
  if (command.includes("/") || command.includes("\\")) return existsSync(command);
  const extensions = process.platform === "win32" ? String(process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";") : [""];
  return String(process.env.PATH || "").split(delimiter).filter(Boolean)
    .some((entry) => extensions.some((extension) => existsSync(join(entry, `${command}${extension}`))));
}

function number(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function safeWorkspace(root, id) {
  const workspace = resolve(root, safeId(id, "sandbox ID"));
  const normalizedRoot = resolve(root);
  if (workspace !== normalizedRoot && !workspace.startsWith(`${normalizedRoot}${sep}`)) throw new Error("Unsafe sandbox workspace path.");
  return workspace;
}

async function run(command, args, { input, timeoutMs = 30_000 } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolveRun({ stdout: stdout.trim(), stderr: stderr.trim() });
      else reject(new Error(`${command} exited with ${code}. ${stderr.slice(-4000)}`));
    });
    if (input) child.stdin.end(input); else child.stdin.end();
  });
}

export function sandboxDriverCatalog() {
  const dockerCommand = process.env.FDE_DOCKER_COMMAND || "docker";
  const kubectlCommand = process.env.FDE_KUBECTL_COMMAND || "kubectl";
  return [
    {
      id: "local-ephemeral",
      name: "Local ephemeral workspace",
      status: "configured",
      operations: ["provision", "seed", "snapshot", "destroy", "status"],
      deploymentModes: ["local", "toolkit-cloud", "client-vpc", "air-gapped"],
    },
    {
      id: "docker-local",
      name: "Docker Engine gateway",
      status: findExecutable(dockerCommand) ? "configured" : "requires-runtime",
      operations: ["provision", "seed", "expose_url", "snapshot", "destroy", "status"],
      deploymentModes: ["local", "client-vpc", "air-gapped"],
    },
    {
      id: "kubernetes-job",
      name: "Kubernetes Job gateway",
      status: findExecutable(kubectlCommand) ? "configured" : "manifest-only",
      operations: ["provision", "seed", "status", "destroy"],
      deploymentModes: ["client-vpc", "air-gapped"],
    },
  ];
}

function kubernetesManifest(input, sandboxId) {
  const namespace = safeId(input.namespace || "fde-execution", "Kubernetes namespace");
  const name = `fde-${sandboxId}`.toLowerCase().slice(0, 63).replace(/[^a-z0-9-]/g, "-");
  const image = String(input.image || "node:22-alpine");
  const timeoutSeconds = Math.trunc(number(input.timeoutSeconds, 900, 1, 86_400));
  const memoryMb = Math.trunc(number(input.memoryMb, 1024, 128, 1_048_576));
  const cpu = number(input.cpu, 1, 0.1, 128);
  return {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: { name, namespace, labels: { "app.kubernetes.io/name": "fde-sandbox", "fde.toolkit/sandbox-id": sandboxId } },
    spec: {
      backoffLimit: 0,
      activeDeadlineSeconds: timeoutSeconds,
      ttlSecondsAfterFinished: 3600,
      template: {
        metadata: { labels: { "app.kubernetes.io/name": "fde-sandbox", "fde.toolkit/sandbox-id": sandboxId } },
        spec: {
          restartPolicy: "Never",
          automountServiceAccountToken: false,
          securityContext: { runAsNonRoot: true, seccompProfile: { type: "RuntimeDefault" } },
          containers: [{
            name: "workspace",
            image,
            command: ["sh", "-lc", "trap : TERM INT; sleep infinity & wait"],
            resources: { requests: { cpu: String(cpu), memory: `${memoryMb}Mi` }, limits: { cpu: String(cpu), memory: `${memoryMb}Mi` } },
            securityContext: { allowPrivilegeEscalation: false, readOnlyRootFilesystem: false, capabilities: { drop: ["ALL"] } },
            volumeMounts: [{ name: "workspace", mountPath: "/workspace" }],
          }],
          volumes: [{ name: "workspace", emptyDir: { sizeLimit: `${Math.trunc(number(input.workspaceSizeMb, 2048, 64, 1_048_576))}Mi` } }],
        },
      },
    },
  };
}

export function createSandboxGateway(options = {}) {
  const workspaceRoot = resolve(options.workspaceRoot || process.env.FDE_WORKSPACE_ROOT || "/workspaces");
  const metadataRoot = resolve(options.metadataRoot || process.env.FDE_SANDBOX_METADATA_DIR || "/tmp/fde-sandboxes");
  const dockerCommand = options.dockerCommand || process.env.FDE_DOCKER_COMMAND || "docker";
  const kubectlCommand = options.kubectlCommand || process.env.FDE_KUBECTL_COMMAND || "kubectl";

  async function init() {
    await Promise.all([workspaceRoot, metadataRoot].map((path) => mkdir(path, { recursive: true, mode: 0o700 })));
  }

  async function save(metadata) {
    await writeFile(join(metadataRoot, `${metadata.id}.json`), `${JSON.stringify(metadata, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    return metadata;
  }

  async function get(id) {
    try { return JSON.parse(await readFile(join(metadataRoot, `${safeId(id, "sandbox ID")}.json`), "utf8")); }
    catch (error) { if (error?.code === "ENOENT") return null; throw error; }
  }

  async function list(filters = {}) {
    const files = await readdir(metadataRoot).catch(() => []);
    const sandboxes = await Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) => JSON.parse(await readFile(join(metadataRoot, file), "utf8"))));
    return sandboxes
      .filter((sandbox) => !filters.tenantId || sandbox.tenantId === filters.tenantId)
      .filter((sandbox) => !filters.workspaceId || sandbox.workspaceId === filters.workspaceId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function provision(input = {}) {
    const driverId = safeId(input.driverId || "local-ephemeral", "sandbox driver ID");
    const id = `sbx-${randomUUID().slice(0, 12)}`;
    const workspace = safeWorkspace(workspaceRoot, id);
    await mkdir(workspace, { recursive: true, mode: 0o700 });
    const base = {
      id,
      driverId,
      tenantId: safeId(input.tenantId || "public-demo", "tenant ID"),
      workspaceId: input.workspaceId ? safeId(input.workspaceId, "workspace ID") : null,
      jobId: input.jobId ? safeId(input.jobId, "job ID") : null,
      workspaceMount: workspace,
      image: String(input.image || "node:22-alpine"),
      networkPolicy: input.networkPolicy || "disabled",
      cpu: number(input.cpu, 1, 0.1, 128),
      memoryMb: Math.trunc(number(input.memoryMb, 1024, 128, 1_048_576)),
      workspaceSizeMb: Math.trunc(number(input.workspaceSizeMb, 2048, 64, 1_048_576)),
      status: "provisioning",
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + number(input.timeoutSeconds, 900, 1, 86_400) * 1000).toISOString(),
    };

    if (driverId === "local-ephemeral") return save({ ...base, status: "ready" });

    if (driverId === "docker-local") {
      if (!findExecutable(dockerCommand)) throw new Error("Docker gateway is not configured in this execution plane.");
      const containerName = `fde-${id}`;
      await run(dockerCommand, [
        "create", "--name", containerName,
        "--label", `fde.toolkit/sandbox-id=${id}`,
        "--label", `fde.toolkit/tenant-id=${base.tenantId}`,
        "--network", base.networkPolicy === "disabled" ? "none" : "bridge",
        "--cpus", String(base.cpu),
        "--memory", `${base.memoryMb}m`,
        "--pids-limit", String(Math.trunc(number(input.pidsLimit, 256, 16, 32_768))),
        "--security-opt", "no-new-privileges",
        "--mount", `type=bind,src=${workspace},dst=/workspace`,
        base.image, "sh", "-lc", "trap : TERM INT; sleep infinity & wait",
      ]);
      await run(dockerCommand, ["start", containerName]);
      return save({ ...base, status: "ready", providerMetadata: { containerName } });
    }

    if (driverId === "kubernetes-job") {
      const manifest = kubernetesManifest(input, id);
      if (input.apply === true) {
        if (!findExecutable(kubectlCommand)) throw new Error("kubectl is not configured in this execution plane.");
        await run(kubectlCommand, ["apply", "-f", "-"], { input: JSON.stringify(manifest) });
        return save({ ...base, status: "ready", providerMetadata: { namespace: manifest.metadata.namespace, jobName: manifest.metadata.name, applied: true }, manifest });
      }
      return save({ ...base, status: "manifest-ready", providerMetadata: { namespace: manifest.metadata.namespace, jobName: manifest.metadata.name, applied: false }, manifest });
    }

    throw new Error(`Unsupported sandbox driver ${driverId}.`);
  }

  async function destroy(id) {
    const metadata = await get(id);
    if (!metadata) throw new Error("Sandbox not found.");
    if (metadata.driverId === "docker-local" && metadata.providerMetadata?.containerName) {
      if (!findExecutable(dockerCommand)) throw new Error("Docker gateway is not configured in this execution plane.");
      await run(dockerCommand, ["rm", "-f", metadata.providerMetadata.containerName]);
    }
    if (metadata.driverId === "kubernetes-job" && metadata.providerMetadata?.applied) {
      if (!findExecutable(kubectlCommand)) throw new Error("kubectl is not configured in this execution plane.");
      await run(kubectlCommand, ["delete", "job", metadata.providerMetadata.jobName, "-n", metadata.providerMetadata.namespace, "--ignore-not-found=true"]);
    }
    await rm(metadata.workspaceMount, { recursive: true, force: true });
    return save({ ...metadata, status: "destroyed", destroyedAt: nowIso() });
  }

  return { init, provision, destroy, get, list, catalog: sandboxDriverCatalog, workspaceRoot };
}

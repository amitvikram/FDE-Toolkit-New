import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { randomUUID } from "node:crypto";
import { nowIso, safeId } from "./platform-runtime.mjs";

function findExecutable(command) {
  if (!command) return false;
  if (command.includes("/") || command.includes("\\")) return existsSync(command);
  const extensions = process.platform === "win32" ? String(process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";") : [""];
  return String(process.env.PATH || "").split(delimiter).filter(Boolean)
    .some((entry) => extensions.some((extension) => existsSync(join(entry, `${command}${extension}`))));
}

async function run(command, args, timeoutMs = 20_000) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolveRun(stdout.trim());
      else reject(new Error(`${command} exited with ${code}. ${stderr.slice(-2000)}`));
    });
  });
}

function splitFragment(uri) {
  const index = uri.indexOf("#");
  return index < 0 ? [uri, null] : [uri.slice(0, index), uri.slice(index + 1)];
}

function selectField(value, field) {
  if (!field) return typeof value === "string" ? value : JSON.stringify(value);
  const segments = field.split(".").filter(Boolean);
  let current = value;
  for (const segment of segments) current = current?.[segment];
  if (current === undefined || current === null) throw new Error(`Secret field ${field} was not found.`);
  return typeof current === "string" ? current : JSON.stringify(current);
}

export function secretProviderCatalog() {
  const awsCommand = process.env.FDE_AWS_COMMAND || "aws";
  const azureCommand = process.env.FDE_AZ_COMMAND || "az";
  return [
    { id: "env", name: "Execution-plane environment", status: "configured", deploymentModes: ["local", "client-vpc", "air-gapped"] },
    { id: "vault", name: "HashiCorp Vault", status: process.env.VAULT_ADDR && process.env.VAULT_TOKEN ? "configured" : "requires-credentials", deploymentModes: ["client-vpc", "air-gapped"] },
    { id: "aws-sm", name: "AWS Secrets Manager", status: findExecutable(awsCommand) ? "configured" : "requires-runtime", deploymentModes: ["toolkit-cloud", "client-vpc"] },
    { id: "azure-kv", name: "Azure Key Vault", status: findExecutable(azureCommand) ? "configured" : "requires-runtime", deploymentModes: ["toolkit-cloud", "client-vpc"] },
  ];
}

export function createCredentialBroker(options = {}) {
  const leases = new Map();
  const awsCommand = options.awsCommand || process.env.FDE_AWS_COMMAND || "aws";
  const azureCommand = options.azureCommand || process.env.FDE_AZ_COMMAND || "az";

  async function resolveReference(reference) {
    const ref = String(reference || "");
    if (ref.startsWith("env://")) {
      const name = safeId(ref.slice("env://".length), "environment secret name");
      const value = process.env[name];
      if (value === undefined) throw new Error(`Environment secret ${name} is not configured.`);
      return { value, source: `env://${name}` };
    }

    if (ref.startsWith("vault://")) {
      const [withoutFragment, field] = splitFragment(ref);
      const path = withoutFragment.slice("vault://".length).replace(/^\/+/, "");
      if (!path) throw new Error("Vault secret path is required.");
      const address = String(process.env.VAULT_ADDR || "").replace(/\/$/, "");
      const token = process.env.VAULT_TOKEN;
      if (!address || !token) throw new Error("VAULT_ADDR and VAULT_TOKEN are required.");
      const response = await fetch(`${address}/v1/${path}`, {
        headers: { "x-vault-token": token },
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.errors?.join("; ") || `Vault returned ${response.status}.`);
      const data = payload?.data?.data ?? payload?.data;
      return { value: selectField(data, field), source: `vault://${path}${field ? `#${field}` : ""}` };
    }

    if (ref.startsWith("aws-sm://")) {
      if (!findExecutable(awsCommand)) throw new Error("AWS CLI is not configured in the execution plane.");
      const [withoutFragment, field] = splitFragment(ref);
      const secretId = decodeURIComponent(withoutFragment.slice("aws-sm://".length));
      const output = await run(awsCommand, ["secretsmanager", "get-secret-value", "--secret-id", secretId, "--query", "SecretString", "--output", "text"]);
      let value = output;
      try { value = JSON.parse(output); } catch {}
      return { value: selectField(value, field), source: `aws-sm://${secretId}${field ? `#${field}` : ""}` };
    }

    if (ref.startsWith("azure-kv://")) {
      if (!findExecutable(azureCommand)) throw new Error("Azure CLI is not configured in the execution plane.");
      const path = ref.slice("azure-kv://".length).split("/").filter(Boolean);
      if (path.length < 2) throw new Error("Azure Key Vault reference must be azure-kv://vault-name/secret-name.");
      const [vaultName, secretName] = path;
      const value = await run(azureCommand, ["keyvault", "secret", "show", "--vault-name", vaultName, "--name", secretName, "--query", "value", "--output", "tsv"]);
      return { value, source: `azure-kv://${vaultName}/${secretName}` };
    }

    throw new Error("Unsupported secret reference scheme.");
  }

  async function issueLease(input = {}) {
    const tenantId = safeId(input.tenantId, "tenant ID");
    const jobId = safeId(input.jobId, "job ID");
    const references = input.references && typeof input.references === "object" ? input.references : {};
    const entries = Object.entries(references);
    if (entries.length > 50) throw new Error("A job may request at most 50 secret references.");
    const env = {};
    const sources = [];
    for (const [name, reference] of entries) {
      if (!/^[A-Z][A-Z0-9_]{0,127}$/.test(name)) throw new Error(`Invalid secret environment key ${name}.`);
      const resolved = await resolveReference(reference);
      env[name] = resolved.value;
      sources.push(resolved.source);
    }
    const ttlSeconds = Math.max(30, Math.min(3600, Math.trunc(Number(input.ttlSeconds) || 900)));
    const issuedAt = nowIso();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const lease = { contractVersion: "1.0", leaseId: `lease-${randomUUID().slice(0, 12)}`, tenantId, jobId, env, sources, issuedAt, expiresAt, revokedAt: null };
    leases.set(lease.leaseId, lease);
    return lease;
  }

  function metadata(lease) {
    if (!lease) return null;
    return {
      contractVersion: lease.contractVersion,
      leaseId: lease.leaseId,
      tenantId: lease.tenantId,
      jobId: lease.jobId,
      environmentKeys: Object.keys(lease.env),
      sources: lease.sources,
      issuedAt: lease.issuedAt,
      expiresAt: lease.expiresAt,
      revokedAt: lease.revokedAt,
    };
  }

  function revoke(leaseId) {
    const lease = leases.get(leaseId);
    if (!lease) return null;
    for (const key of Object.keys(lease.env)) lease.env[key] = "";
    lease.revokedAt = nowIso();
    leases.delete(leaseId);
    return metadata(lease);
  }

  return { issueLease, revoke, metadata, catalog: secretProviderCatalog };
}

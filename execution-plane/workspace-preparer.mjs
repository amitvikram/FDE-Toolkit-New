import { spawn } from "node:child_process";
import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createInstallationToken, githubAppConfigured, parseGitHubRepository } from "./github-app.mjs";

function safeChild(root, value) {
  const base = resolve(root);
  const child = resolve(base, String(value || ""));
  if (child !== base && !child.startsWith(`${base}${sep}`)) throw new Error("Unsafe workspace project path.");
  return child;
}

async function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), options.timeoutMs || 120_000);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolveRun({ stdout: stdout.trim(), stderr: stderr.trim() });
      else reject(new Error(`${command} exited with ${code}. ${stderr.slice(-4000)}`));
    });
  });
}

async function initializeTemplateRepository(repositoryRoot) {
  await run("git", ["init", "-b", "main"], { cwd: repositoryRoot });
  await run("git", ["config", "user.name", "FDE Demo"], { cwd: repositoryRoot });
  await run("git", ["config", "user.email", "demo@fde-toolkit.local"], { cwd: repositoryRoot });
  await run("git", ["add", "."], { cwd: repositoryRoot });
  await run("git", ["commit", "-m", "chore: seed client review portal"], { cwd: repositoryRoot });
}

export function createWorkspacePreparer(options = {}) {
  const templateRoot = resolve(options.templateRoot || fileURLToPath(new URL("./templates/client-review-portal", import.meta.url)));

  async function prepare({ workspace, sandbox }) {
    if (!workspace) throw new Error("Workspace not found.");
    if (!sandbox || sandbox.status !== "ready") throw new Error("A ready sandbox is required before repository preparation.");
    const repositoryRoot = safeChild(sandbox.workspaceMount, "repository");
    await rm(repositoryRoot, { recursive: true, force: true });
    await mkdir(repositoryRoot, { recursive: true, mode: 0o700 });

    let source = "sample-repository";
    let repository = workspace.repository.fullName;
    if (workspace.repository.connected && workspace.github.installationId && githubAppConfigured()) {
      const parsed = parseGitHubRepository(workspace.repository.fullName || workspace.repository.url);
      const access = await createInstallationToken({
        installationId: workspace.github.installationId,
        repository: parsed.fullName,
        permissions: { contents: "read", metadata: "read" },
      });
      const authorization = Buffer.from(`x-access-token:${access.token}`, "utf8").toString("base64");
      const env = {
        ...process.env,
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
        GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${authorization}`,
      };
      await rm(repositoryRoot, { recursive: true, force: true });
      await run(
        "git",
        ["clone", "--depth", "1", "--branch", workspace.repository.baseBranch || "main", `https://github.com/${parsed.fullName}.git`, repositoryRoot],
        { env, timeoutMs: 180_000 },
      );
      source = "github-app";
      repository = parsed.fullName;
    } else {
      const projectPath = workspace.repository.projectPath || "examples/client-review-portal";
      const projectRoot = safeChild(repositoryRoot, projectPath);
      await mkdir(dirname(projectRoot), { recursive: true, mode: 0o700 });
      await cp(templateRoot, projectRoot, { recursive: true });
      await initializeTemplateRepository(repositoryRoot);
    }

    const projectPath = String(workspace.repository.projectPath || "").replace(/^\/+|\/+$/g, "");
    const mountPath = safeChild(repositoryRoot, projectPath);
    const info = await stat(mountPath).catch(() => null);
    if (!info?.isDirectory()) throw new Error(`Configured project path ${projectPath || "."} does not exist in the repository.`);

    return {
      source,
      repository,
      baseBranch: workspace.repository.baseBranch || "main",
      repositoryRoot,
      mountPath,
      projectPath,
      sandboxId: sandbox.id,
      preparedAt: new Date().toISOString(),
    };
  }

  return { prepare, templateRoot };
}

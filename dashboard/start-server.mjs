import { spawn } from "node:child_process";

const children = new Set();
const embeddedExecution = process.env.FDE_EMBEDDED_EXECUTION_PLANE === "true";
const executionUrl = process.env.FDE_EXECUTION_PLANE_URL || "http://127.0.0.1:8787";

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
    ...options,
  });
  children.add(child);
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (code && code !== 0) {
      console.error(`${command} exited with code ${code}${signal ? ` (${signal})` : ""}`);
      shutdown(code);
    }
  });
  return child;
}

async function waitForExecutionPlane() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${executionUrl.replace(/\/$/, "")}/health`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) return;
    } catch {
      // Retry until the local execution process has opened its port.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Execution plane did not become healthy at ${executionUrl}.`);
}

function shutdown(exitCode = 0) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 100).unref();
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

if (embeddedExecution) {
  start(process.execPath, ["/execution-plane/server.mjs"], {
    env: {
      ...process.env,
      PORT: process.env.FDE_EXECUTION_PLANE_PORT || "8787",
      FDE_EXECUTION_BOUNDARY: "co-located-demo-process",
    },
  });
  await waitForExecutionPlane();
  console.log("Embedded FDE execution plane is healthy.");
}

const nextServer = start("npm", ["start"]);
nextServer.once("exit", (code) => shutdown(code || 0));

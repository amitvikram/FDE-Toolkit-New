import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { runDemoExecution } from "./demo-runner.mjs";

const port = Number(process.env.PORT || 8787);
const signingSecret = process.env.FDE_EXECUTION_SIGNING_SECRET || "local-demo-signing-secret";
const maxClockSkewMs = 5 * 60 * 1000;
const maxBodyBytes = 256_000;

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  response.end(body);
}

function expectedSignature(timestamp, body) {
  const digest = createHmac("sha256", signingSecret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `sha256=${digest}`;
}

function signaturesMatch(actual, expected) {
  const actualBuffer = Buffer.from(actual || "", "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function verifyRequest(request, body) {
  const timestamp = request.headers["x-fde-timestamp"];
  const signature = request.headers["x-fde-signature"];
  if (typeof timestamp !== "string" || typeof signature !== "string") {
    return "Missing signed execution metadata.";
  }

  const parsedTimestamp = Number(timestamp);
  if (!Number.isFinite(parsedTimestamp) || Math.abs(Date.now() - parsedTimestamp) > maxClockSkewMs) {
    return "Execution request timestamp is outside the allowed window.";
  }

  if (!signaturesMatch(signature, expectedSignature(timestamp, body))) {
    return "Invalid execution request signature.";
  }

  return null;
}

async function readBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBodyBytes) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, {
      status: "ok",
      service: "fde-execution-plane",
      contractVersion: "2026-07-15",
      executionBoundary: process.env.FDE_EXECUTION_BOUNDARY || "separate-container",
      trustModel: "observed-not-self-reported",
    });
  }

  if (request.method !== "POST" || url.pathname !== "/v1/runs") {
    return sendJson(response, 404, { error: "Not found." });
  }

  try {
    const rawBody = await readBody(request);
    const verificationError = verifyRequest(request, rawBody);
    if (verificationError) return sendJson(response, 401, { error: verificationError });

    const payload = JSON.parse(rawBody);
    const result = await runDemoExecution(payload);
    return sendJson(response, 200, {
      contractVersion: "2026-07-15",
      result,
    });
  } catch (error) {
    console.error("Execution plane run failed:", error);
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Execution plane run failed.",
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`FDE execution plane listening on :${port}`);
});

import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const PRODUCT_GITHUB_STATE_COOKIE = "fde_github_workspace";
export const PRODUCT_GITHUB_STATE_TTL_SECONDS = 15 * 60;

type GitHubState = {
  version: 1;
  leadId: string;
  workspaceId: string;
  issuedAt: number;
  expiresAt: number;
};

function secret() {
  return process.env.FDE_PRODUCT_ACCESS_SECRET || process.env.FDE_EXECUTION_SIGNING_SECRET || "local-product-access-secret";
}

function sign(encoded: string) {
  return createHmac("sha256", secret()).update(encoded).digest("base64url");
}

export function issueGitHubState(leadId: string, workspaceId: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload: GitHubState = { version: 1, leadId, workspaceId, issuedAt: now, expiresAt: now + PRODUCT_GITHUB_STATE_TTL_SECONDS };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyGitHubState(token: string | undefined | null) {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = Buffer.from(sign(encoded), "utf8");
  const actual = Buffer.from(signature, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as GitHubState;
    const now = Math.floor(Date.now() / 1000);
    if (payload.version !== 1 || !/^lead-[a-z0-9-]{8,40}$/.test(payload.leadId) || !/^ws-[a-z0-9-]{8,40}$/.test(payload.workspaceId) || payload.expiresAt <= now || payload.issuedAt > now + 60) return null;
    return payload;
  } catch {
    return null;
  }
}

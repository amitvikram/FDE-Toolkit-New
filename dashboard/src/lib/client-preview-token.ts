import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const CLIENT_PREVIEW_TTL_SECONDS = 7 * 24 * 60 * 60;

type ClientPreviewPayload = {
  version: 1;
  reviewId: string;
  leadId: string;
  workspaceId: string;
  jobId: string;
  approvalKey: string;
  issuedAt: number;
  expiresAt: number;
};

function secret() {
  return process.env.FDE_PRODUCT_ACCESS_SECRET || process.env.FDE_EXECUTION_SIGNING_SECRET || "local-product-access-secret";
}

function sign(encoded: string) {
  return createHmac("sha256", secret()).update(encoded).digest("base64url");
}

export function issueClientPreviewToken(input: Omit<ClientPreviewPayload, "version" | "reviewId" | "issuedAt" | "expiresAt">) {
  const now = Math.floor(Date.now() / 1000);
  const payload: ClientPreviewPayload = {
    version: 1,
    reviewId: `review-${randomUUID().slice(0, 12)}`,
    ...input,
    issuedAt: now,
    expiresAt: now + CLIENT_PREVIEW_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return { token: `${encoded}.${sign(encoded)}`, payload };
}

export function verifyClientPreviewToken(token: string | undefined | null) {
  if (!token || token.length > 2000) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = Buffer.from(sign(encoded), "utf8");
  const actual = Buffer.from(signature, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ClientPreviewPayload;
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.version !== 1 ||
      !/^review-[a-z0-9-]{8,40}$/.test(payload.reviewId) ||
      !/^lead-[a-z0-9-]{8,40}$/.test(payload.leadId) ||
      !/^ws-[a-z0-9-]{8,40}$/.test(payload.workspaceId) ||
      !/^fdejob-[a-z0-9-]{8,40}$/.test(payload.jobId) ||
      !/^[A-Za-z0-9._-]{1,120}$/.test(payload.approvalKey) ||
      payload.expiresAt <= now ||
      payload.issuedAt > now + 60
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

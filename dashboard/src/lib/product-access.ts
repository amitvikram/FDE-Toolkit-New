import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const PRODUCT_ACCESS_COOKIE = "fde_product_access";
export const PRODUCT_ACCESS_TTL_SECONDS = 30 * 24 * 60 * 60;

type ProductAccessPayload = {
  version: 1;
  leadId: string;
  issuedAt: number;
  expiresAt: number;
};

function secret() {
  return (
    process.env.FDE_PRODUCT_ACCESS_SECRET ||
    process.env.FDE_EXECUTION_SIGNING_SECRET ||
    "local-product-access-secret"
  );
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(encodedPayload: string) {
  return createHmac("sha256", secret()).update(encodedPayload).digest("base64url");
}

export function issueProductAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload: ProductAccessPayload = {
    version: 1,
    leadId: `lead-${randomUUID().slice(0, 12)}`,
    issuedAt: now,
    expiresAt: now + PRODUCT_ACCESS_TTL_SECONDS,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return {
    token: `${encodedPayload}.${sign(encodedPayload)}`,
    payload,
  };
}

export function verifyProductAccessToken(token: string | undefined | null) {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = Buffer.from(sign(encodedPayload), "utf8");
  const actual = Buffer.from(signature, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as ProductAccessPayload;
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.version !== 1 ||
      !/^lead-[a-z0-9-]{8,40}$/.test(payload.leadId) ||
      payload.expiresAt <= now ||
      payload.issuedAt > now + 60
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

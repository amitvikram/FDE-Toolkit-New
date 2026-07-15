import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  issueProductAccessToken,
  PRODUCT_ACCESS_COOKIE,
  PRODUCT_ACCESS_TTL_SECONDS,
} from "@/lib/product-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 8;
const recentRequests = new Map<string, number[]>();

const accessSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200).transform((value) => value.toLowerCase()),
  company: z.string().trim().min(2).max(150),
  role: z.string().trim().min(2).max(150),
  useCase: z.string().trim().min(2).max(250),
  message: z.string().trim().max(2000).optional().default(""),
  website: z.string().trim().max(200).optional().default(""),
  source: z.string().trim().max(300).optional().default("/platform"),
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clientId(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(id: string) {
  const now = Date.now();
  const recent = (recentRequests.get(id) ?? []).filter(
    (timestamp) => now - timestamp < WINDOW_MS,
  );
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    recentRequests.set(id, recent);
    return true;
  }
  recent.push(now);
  recentRequests.set(id, recent);
  return false;
}

async function sendLeadEmail(input: z.infer<typeof accessSchema>, leadId: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const allowUndelivered =
    process.env.FDE_PRODUCT_ACCESS_ALLOW_UNDELIVERED === "true";

  if (!apiKey) {
    if (!allowUndelivered) {
      throw new Error(
        "Product access email delivery is not configured. Please email amitvik@gmail.com.",
      );
    }
    console.info("FDE product access lead accepted without email delivery", {
      leadId,
      name: input.name,
      email: input.email,
      company: input.company,
      role: input.role,
      useCase: input.useCase,
      source: input.source,
    });
    return;
  }

  const notificationEmail =
    process.env.INTEREST_NOTIFICATION_EMAIL || "amitvik@gmail.com";
  const fromEmail =
    process.env.INTEREST_FROM_EMAIL || "FDE-Toolkit <onboarding@resend.dev>";
  const safe = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, escapeHtml(String(value))]),
  );

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": leadId,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [notificationEmail],
      reply_to: input.email,
      subject: `FDE-Toolkit product access: ${input.company} — ${input.name}`,
      text: [
        "New FDE-Toolkit product access",
        "",
        `Lead ID: ${leadId}`,
        `Name: ${input.name}`,
        `Work email: ${input.email}`,
        `Company: ${input.company}`,
        `Role: ${input.role}`,
        `Use case: ${input.useCase}`,
        `Source: ${input.source}`,
        "",
        "Message:",
        input.message || "No additional message provided.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#0f172a">
          <h1 style="font-size:24px;margin-bottom:8px">New FDE-Toolkit product access</h1>
          <p style="color:#475569;margin-top:0">This visitor unlocked the product workspace.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:24px">
            <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Lead ID</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${leadId}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Name</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${safe.name}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Work email</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${safe.email}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Company</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${safe.company}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Role</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${safe.role}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Use case</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${safe.useCase}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Source</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${safe.source}</td></tr>
          </table>
          <h2 style="font-size:18px;margin-top:28px">Message</h2>
          <p style="white-space:pre-wrap;line-height:1.6;background:#f8fafc;padding:16px;border-radius:10px">${safe.message || "No additional message provided."}</p>
          <p style="margin-top:24px"><a href="mailto:${safe.email}" style="display:inline-block;background:#0891b2;color:white;text-decoration:none;padding:12px 18px;border-radius:8px">Reply to ${safe.name}</a></p>
        </div>
      `,
      tags: [{ name: "source", value: "product-access" }],
    }),
  });

  if (!response.ok) {
    const providerError = await response.text();
    console.error("Product access email failed:", response.status, providerError);
    throw new Error("We could not record your access request. Please try again.");
  }
}

export async function POST(request: NextRequest) {
  if (isRateLimited(clientId(request))) {
    return NextResponse.json(
      { error: "Too many access attempts. Please try again in a few minutes." },
      { status: 429 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }

  const parsed = accessSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please complete all required fields with valid information." },
      { status: 400 },
    );
  }

  if (parsed.data.website) {
    return NextResponse.json({ ok: true });
  }

  const { token, payload: access } = issueProductAccessToken();
  try {
    await sendLeadEmail(parsed.data, access.leadId);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "We could not record your access request.",
      },
      { status: 503 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    leadId: access.leadId,
    expiresAt: access.expiresAt,
  });
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const secure = forwardedProto === "https" || request.nextUrl.protocol === "https:";
  response.cookies.set(PRODUCT_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: PRODUCT_ACCESS_TTL_SECONDS,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const secure = forwardedProto === "https" || request.nextUrl.protocol === "https:";
  response.cookies.set(PRODUCT_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const recentRequests = new Map<string, number[]>();

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isRateLimited(clientId: string) {
  const now = Date.now();
  const recent = (recentRequests.get(clientId) ?? []).filter(
    (timestamp) => now - timestamp < WINDOW_MS,
  );

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    recentRequests.set(clientId, recent);
    return true;
  }

  recent.push(now);
  recentRequests.set(clientId, recent);
  return false;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }

  const website = cleanString(body.website, 200);
  if (website) {
    return NextResponse.json({ ok: true });
  }

  const clientId =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(clientId)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a few minutes." },
      { status: 429 },
    );
  }

  const name = cleanString(body.name, 100);
  const email = cleanString(body.email, 200).toLowerCase();
  const company = cleanString(body.company, 150);
  const useCase = cleanString(body.useCase, 200);
  const message = cleanString(body.message, 2000);
  const source = cleanString(body.source, 200) || "/";

  if (name.length < 2 || company.length < 2 || useCase.length < 2 || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Please complete all required fields with valid information." },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not configured.");
    return NextResponse.json(
      { error: "Email delivery is not configured yet. Please email amitvik@gmail.com." },
      { status: 503 },
    );
  }

  const notificationEmail =
    process.env.INTEREST_NOTIFICATION_EMAIL || "amitvik@gmail.com";
  const fromEmail =
    process.env.INTEREST_FROM_EMAIL || "FDE-Toolkit <onboarding@resend.dev>";

  const safe = {
    name: escapeHtml(name),
    email: escapeHtml(email),
    company: escapeHtml(company),
    useCase: escapeHtml(useCase),
    message: escapeHtml(message || "No additional message provided."),
    source: escapeHtml(source),
  };

  const text = [
    "New FDE-Toolkit interest submission",
    "",
    `Name: ${name}`,
    `Work email: ${email}`,
    `Company: ${company}`,
    `Use case: ${useCase}`,
    `Source: ${source}`,
    "",
    "Message:",
    message || "No additional message provided.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
      <h1 style="font-size:24px;margin-bottom:24px">New FDE-Toolkit interest submission</h1>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Name</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${safe.name}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Work email</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${safe.email}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Company</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${safe.company}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Use case</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${safe.useCase}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Source</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${safe.source}</td></tr>
      </table>
      <h2 style="font-size:18px;margin-top:28px">Message</h2>
      <p style="white-space:pre-wrap;line-height:1.6;background:#f8fafc;padding:16px;border-radius:10px">${safe.message}</p>
      <p style="margin-top:24px"><a href="mailto:${safe.email}" style="display:inline-block;background:#0891b2;color:white;text-decoration:none;padding:12px 18px;border-radius:8px">Reply to ${safe.name}</a></p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [notificationEmail],
      reply_to: email,
      subject: `New FDE-Toolkit interest: ${company} — ${name}`,
      text,
      html,
      tags: [{ name: "source", value: "interest-form" }],
    }),
  });

  if (!response.ok) {
    const providerError = await response.text();
    console.error("Resend email failed:", response.status, providerError);
    return NextResponse.json(
      { error: "We could not send your request. Please try again or email amitvik@gmail.com." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  PRODUCT_ACCESS_COOKIE,
  verifyProductAccessToken,
} from "@/lib/product-access";
import {
  buildAgentforcePackage,
  getAgentforceBlueprints,
} from "@/lib/agentforce/package-builder.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const topicSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(600),
});

const actionSchema = z.object({
  apiName: z.string().trim().min(2).max(120),
  label: z.string().trim().min(2).max(120),
  type: z.enum(["apex", "flow", "prompt-template", "mcp"]),
  risk: z.enum(["read", "write", "external"]),
  confirmation: z.enum(["none", "conditional", "required"]),
});

const testSchema = z.object({
  utterance: z.string().trim().min(5).max(1000),
  expectedTopic: z.string().trim().min(2).max(120),
  expectedActions: z.array(z.string().trim().min(1).max(120)).max(12),
  expectedOutcome: z.string().trim().min(5).max(1000),
});

const requestSchema = z.object({
  blueprintId: z.enum([
    "service-case-resolution",
    "sales-account-planning",
    "employee-it-support",
  ]),
  implementationName: z.string().trim().min(3).max(160),
  companyName: z.string().trim().min(2).max(160),
  companyDescription: z.string().trim().min(10).max(1000),
  agentApiName: z.string().trim().min(2).max(80),
  agentType: z.enum(["customer", "internal"]),
  outcome: z.string().trim().min(20).max(1200),
  role: z.string().trim().min(20).max(1600),
  developmentOrgAlias: z.string().trim().min(2).max(80),
  uatOrgAlias: z.string().trim().min(2).max(80),
  productionOrgAlias: z.string().trim().min(2).max(80),
  environmentStrategy: z.enum(["sandbox", "scratch-org"]),
  dataStrategy: z.enum(["crm-grounded", "data-cloud-grounded", "hybrid"]),
  channels: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  topics: z.array(topicSchema).min(1).max(12),
  actions: z.array(actionSchema).min(1).max(24),
  tests: z.array(testSchema).min(1).max(40),
});

function access(request: NextRequest) {
  return verifyProductAccessToken(
    request.cookies.get(PRODUCT_ACCESS_COOKIE)?.value,
  );
}

export async function GET(request: NextRequest) {
  if (!access(request)) {
    return NextResponse.json(
      { error: "Product access is required." },
      { status: 401 },
    );
  }

  const blueprints = getAgentforceBlueprints().map((blueprint: { id: string }) => ({
    ...blueprint,
    defaults: buildAgentforcePackage({ blueprintId: blueprint.id }).implementation,
  }));
  return NextResponse.json({ blueprints });
}

export async function POST(request: NextRequest) {
  if (!access(request)) {
    return NextResponse.json(
      { error: "Product access is required." },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "The Agentforce implementation definition is incomplete.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ package: buildAgentforcePackage(parsed.data) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The Agentforce implementation package could not be generated.",
      },
      { status: 500 },
    );
  }
}

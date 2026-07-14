const siteOnly = process.env.NEXT_PUBLIC_SITE_ONLY === "true";

function authUnavailable() {
  return Response.json(
    {
      error: "Authentication is disabled in public-site mode.",
      hint: "Run the full Convex-backed application to enable sign-in.",
    },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  if (siteOnly) {
    return authUnavailable();
  }

  const { handler } = await import("@/lib/auth-server");
  return handler.GET(request);
}

export async function POST(request: Request) {
  if (siteOnly) {
    return authUnavailable();
  }

  const { handler } = await import("@/lib/auth-server");
  return handler.POST(request);
}

export async function GET() {
  try {
    const { env } = await import("cloudflare:workers");
    const siteKey = env.TURNSTILE_SITE_KEY?.trim();

    if (!siteKey) {
      return Response.json(
        { error: "Verification is not configured." },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }

    return Response.json(
      { turnstileSiteKey: siteKey },
      { headers: { "cache-control": "public, max-age=300, s-maxage=300" } },
    );
  } catch {
    return Response.json(
      { error: "Verification is temporarily unavailable." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

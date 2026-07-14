import { BENCHMARK_VERSION } from "../../../lib/benchmark";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
  "cache-control": "public, max-age=60, s-maxage=300",
  "content-type": "application/json; charset=utf-8",
} as const;

export async function GET() {
  try {
    const { env } = await import("cloudflare:workers");
    const overview = await env.DB.prepare(
      `SELECT
         COUNT(*) AS submissions,
         COUNT(DISTINCT LOWER(city)) AS cities,
         COUNT(DISTINCT provider || '|' || model) AS models
       FROM submissions
       WHERE benchmark_version = ? AND quality_status = 'eligible'`,
    )
      .bind(BENCHMARK_VERSION)
      .first<{ submissions: number; cities: number; models: number }>();

    return Response.json(
      {
        submissions: Number(overview?.submissions ?? 0),
        cities: Number(overview?.cities ?? 0),
        models: Number(overview?.models ?? 0),
        benchmarkVersion: BENCHMARK_VERSION,
        privacyThreshold: 5,
      },
      { headers: CORS_HEADERS },
    );
  } catch {
    return Response.json(
      { error: "Aggregate statistics are temporarily unavailable." },
      { status: 503, headers: CORS_HEADERS },
    );
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

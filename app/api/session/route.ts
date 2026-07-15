import { BENCHMARK_PROMPTS, BENCHMARK_VERSION } from "../../../lib/benchmark.ts";
import { issueBenchmarkSession } from "../../../lib/benchmarkSession.server.ts";

export async function POST() {
  try {
    const { env } = await import("cloudflare:workers");
    const signingSecret = env.RATE_LIMIT_HMAC_SECRET?.trim();
    if (!signingSecret) {
      return Response.json(
        { error: "Secure benchmark sessions are not configured yet." },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }
    const session = await issueBenchmarkSession({
      benchmarkVersion: BENCHMARK_VERSION,
      promptIds: BENCHMARK_PROMPTS.map(({ id }) => id),
      secret: signingSecret,
    });
    return Response.json(
      {
        benchmarkVersion: session.benchmarkVersion,
        sessionVariant: session.sessionVariant,
        promptOrder: session.promptOrder,
        sessionToken: session.sessionToken,
        expiresAt: session.expiresAt,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "A secure benchmark session could not be started." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

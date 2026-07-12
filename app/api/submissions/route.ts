import { BENCHMARK_PROMPTS, BENCHMARK_VERSION } from "../../../lib/benchmark";
import { scoreResponses } from "../../../lib/scoring";

type SubmissionPayload = {
  city?: unknown;
  provider?: unknown;
  model?: unknown;
  accessType?: unknown;
  planLabel?: unknown;
  benchmarkVersion?: unknown;
  responses?: unknown;
  feedback?: unknown;
  website?: unknown;
};

type ResponseInput = {
  promptId: string;
  responseText: string;
};

type FeedbackInput = {
  clarityRating: number;
  confusingPromptId: string;
  reason: string;
};

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function parseResponses(value: unknown): ResponseInput[] | null {
  if (!Array.isArray(value) || value.length !== BENCHMARK_PROMPTS.length) {
    return null;
  }

  const parsed = value.map((item): ResponseInput | null => {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const promptId = cleanText(record.promptId, 80);
    const responseText = typeof record.responseText === "string" ? record.responseText.trim().slice(0, 6_000) : "";
    return promptId && responseText ? { promptId, responseText } : null;
  });

  if (parsed.some((item) => item === null)) return null;
  const responses = parsed as ResponseInput[];
  const expectedIds = new Set(BENCHMARK_PROMPTS.map((prompt) => prompt.id));
  const receivedIds = new Set(responses.map((response) => response.promptId));
  return receivedIds.size === expectedIds.size && [...expectedIds].every((id) => receivedIds.has(id))
    ? responses
    : null;
}

function parseFeedback(value: unknown): FeedbackInput {
  if (!value || typeof value !== "object") {
    return { clarityRating: 0, confusingPromptId: "", reason: "" };
  }
  const record = value as Record<string, unknown>;
  const rawRating = typeof record.clarityRating === "number" ? Math.round(record.clarityRating) : 0;
  return {
    clarityRating: Math.max(0, Math.min(5, rawRating)),
    confusingPromptId: cleanText(record.confusingPromptId, 80),
    reason: cleanText(record.reason, 40),
  };
}

async function hashSubmission(parts: string[]): Promise<string> {
  const bytes = new TextEncoder().encode(parts.join("\u241f"));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SubmissionPayload;

    if (cleanText(payload.website, 200)) {
      return Response.json({ ok: true }, { status: 201 });
    }

    const city = cleanText(payload.city, 80);
    const provider = cleanText(payload.provider, 80);
    const model = cleanText(payload.model, 120);
    const accessType = cleanText(payload.accessType, 80);
    const planLabel = cleanText(payload.planLabel, 100);
    const benchmarkVersion = cleanText(payload.benchmarkVersion, 40);
    const responses = parseResponses(payload.responses);
    const feedback = parseFeedback(payload.feedback);

    if (city.length < 2 || /[<>{}]/.test(city)) {
      return Response.json({ error: "Enter a valid city name." }, { status: 400 });
    }
    if (!provider || !model || !accessType || !planLabel) {
      return Response.json({ error: "Provider, model, access type, and plan label are required." }, { status: 400 });
    }
    if (!["Free", "Paid", "Not sure"].includes(accessType)) {
      return Response.json({ error: "Choose Free, Paid, or Not sure for access." }, { status: 400 });
    }
    if (feedback.reason && !["unclear", "answer disputed", "technical issue", "too long"].includes(feedback.reason)) {
      return Response.json({ error: "Choose one of the listed feedback reasons." }, { status: 400 });
    }
    if (benchmarkVersion !== BENCHMARK_VERSION || !responses) {
      return Response.json({ error: "This benchmark submission is incomplete or out of date." }, { status: 400 });
    }

    const scores = scoreResponses(responses);
    const overallScore = scores.reduce((sum, item) => sum + item.score, 0);
    const maxScore = scores.reduce((sum, item) => sum + item.maxScore, 0);
    const submissionId = crypto.randomUUID();
    const answerHash = await hashSubmission([
      benchmarkVersion,
      city.normalize("NFKC").toLocaleLowerCase(),
      provider,
      model,
      accessType,
      planLabel,
      ...responses.map((response) => `${response.promptId}:${response.responseText.trim()}`),
    ]);
    const repeatedOutputs = new Set(responses.map((response) => response.responseText.trim())).size <= 3;
    const qualityStatus = repeatedOutputs ? "flagged" : "eligible";
    const { env } = await import("cloudflare:workers");
    const database = env.DB;

    const statements = [
      database
        .prepare(
          `INSERT INTO submissions
            (id, city, provider, model, access_type, plan_label, benchmark_version, answer_hash, quality_status, overall_score, max_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          submissionId,
          city,
          provider,
          model,
          accessType,
          planLabel,
          benchmarkVersion,
          answerHash,
          qualityStatus,
          overallScore,
          maxScore,
        ),
      ...responses.map((response) => {
        const score = scores.find((item) => item.promptId === response.promptId);
        return database
          .prepare(
            `INSERT INTO responses
              (submission_id, prompt_id, response_text, score, max_score)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(submissionId, response.promptId, response.responseText, score?.score ?? 0, score?.maxScore ?? 2);
      }),
      database
        .prepare(
          `INSERT INTO benchmark_feedback
            (submission_id, clarity_rating, confusing_prompt_id, reason)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(
          submissionId,
          feedback.clarityRating,
          feedback.confusingPromptId,
          feedback.reason,
        ),
    ];

    await database.batch(statements);

    return Response.json(
      {
        ok: true,
        score: overallScore,
        maxScore,
        message: "Your anonymous benchmark response was added.",
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (message.includes("UNIQUE constraint failed") || message.includes("answer_hash")) {
      return Response.json({ error: "This exact benchmark run has already been contributed." }, { status: 409 });
    }
    return Response.json(
      {
        error: message.includes("no such table")
          ? "The benchmark database is still being prepared. Please try again shortly."
          : "We could not save this contribution. Please try again.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const { env } = await import("cloudflare:workers");
    const database = env.DB;
    const [overview, groups] = await Promise.all([
      database
        .prepare(
          `SELECT
             COUNT(*) AS submissions,
             COUNT(DISTINCT LOWER(city)) AS cities,
             COUNT(DISTINCT provider || '|' || model) AS models
           FROM submissions
           WHERE benchmark_version = ? AND quality_status = 'eligible'`,
        )
        .bind(BENCHMARK_VERSION)
        .first(),
      database
        .prepare(
          `SELECT
             MIN(city) AS city,
             provider,
             model,
             access_type AS accessType,
             plan_label AS planLabel,
             COUNT(*) AS sampleSize,
             ROUND(AVG(CAST(overall_score AS REAL) / max_score) * 100, 1) AS averageScore
           FROM submissions
           WHERE benchmark_version = ? AND quality_status = 'eligible'
           GROUP BY LOWER(city), provider, model, access_type, LOWER(plan_label)
           HAVING COUNT(*) >= 5
           ORDER BY sampleSize DESC, averageScore DESC
           LIMIT 100`,
        )
        .bind(BENCHMARK_VERSION)
        .all(),
    ]);

    return Response.json({
      overview: {
        submissions: Number(overview?.submissions ?? 0),
        cities: Number(overview?.cities ?? 0),
        models: Number(overview?.models ?? 0),
      },
      groups: groups.results,
      privacyThreshold: 5,
      benchmarkVersion: BENCHMARK_VERSION,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json(
      {
        error: message.includes("no such table")
          ? "Results will appear after the benchmark database is initialized."
          : "Results are temporarily unavailable.",
      },
      { status: 503 },
    );
  }
}

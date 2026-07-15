import { BENCHMARK_PROMPTS, BENCHMARK_VERSION } from "../../../lib/benchmark.ts";
import { reserveDailySubmission, verifyTurnstileToken } from "../../../lib/antiAbuse.server.ts";
import {
  BenchmarkSessionError,
  assertBenchmarkAssignment,
  type BenchmarkSessionClaims,
  verifyBenchmarkSession,
} from "../../../lib/benchmarkSession.server.ts";
import { loadScoringConfig } from "../../../lib/scoringConfig.server.ts";
import { scoreResponses } from "../../../lib/scoring.ts";
import { validateSubmissionPayload, type ValidatedSubmission } from "../../../lib/submission.ts";

const MAX_REQUEST_BYTES = 120_000;
const PRIVACY_THRESHOLD = 5;
const CROSS_REGION_THRESHOLD = 10;
const RATE_LIMIT_PER_DAY = 5;
const CURRENT_PROMPT_IDS = BENCHMARK_PROMPTS.map(({ id }) => id);
const AVAILABLE_VERSIONS = [BENCHMARK_VERSION, "core-1.0"] as const;

const REASONING_TOKEN_REPORT_STATUSES = [
  "reported",
  "unknown",
  "refused",
  "absent",
  "invalid",
] as const;

type ReasoningTokenReportStatus = (typeof REASONING_TOKEN_REPORT_STATUSES)[number];

export type ReasoningTokenReportStatusCounts = Record<ReasoningTokenReportStatus, number>;

type ReasoningTokenStatusCountRow = {
  status: unknown;
  count: unknown;
};

type ResultGroupRow = {
  city: unknown;
  country: unknown;
  provider: unknown;
  model: unknown;
  accessType: unknown;
  planLabel: unknown;
  sampleSize: unknown;
  averageScore: unknown;
};

type ResultsOverviewRow = {
  submissions?: unknown;
  cities?: unknown;
  models?: unknown;
} | null;

function nonNegativeInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

/** Maps legacy or unexpected stored token-report states into the fixed public vocabulary. */
export function normalizeReasoningTokenReportStatus(value: unknown): ReasoningTokenReportStatus {
  if (value === null || value === undefined) return "absent";
  if (typeof value !== "string") return "invalid";
  const normalized = value.trim().toLowerCase();
  if (normalized === "missing" || normalized === "") return "absent";
  if (normalized === "refusal") return "refused";
  if (normalized === "malformed") return "invalid";
  return REASONING_TOKEN_REPORT_STATUSES.includes(normalized as ReasoningTokenReportStatus)
    ? normalized as ReasoningTokenReportStatus
    : "invalid";
}

/** Produces only fixed aggregate counters; extra database-row fields are intentionally ignored. */
export function aggregateReasoningTokenReportStatuses(
  rows: readonly ReasoningTokenStatusCountRow[],
): ReasoningTokenReportStatusCounts {
  const counts: ReasoningTokenReportStatusCounts = {
    reported: 0,
    unknown: 0,
    refused: 0,
    absent: 0,
    invalid: 0,
  };
  for (const row of rows) {
    counts[normalizeReasoningTokenReportStatus(row.status)] += nonNegativeInteger(row.count);
  }
  return counts;
}

export function isCrossRegionEligible(sampleSize: unknown): boolean {
  return nonNegativeInteger(sampleSize) >= CROSS_REGION_THRESHOLD;
}

export function buildPublicResultsPayload({
  requestedVersion,
  overview,
  groups,
  tokenStatusRows,
}: {
  requestedVersion: (typeof AVAILABLE_VERSIONS)[number];
  overview: ResultsOverviewRow;
  groups: readonly ResultGroupRow[];
  tokenStatusRows: readonly ReasoningTokenStatusCountRow[];
}) {
  const submissions = nonNegativeInteger(overview?.submissions);
  return {
    overview: {
      submissions,
      cities: nonNegativeInteger(overview?.cities),
      models: nonNegativeInteger(overview?.models),
    },
    groups: groups.map((group) => {
      const sampleSize = nonNegativeInteger(group.sampleSize);
      return {
        city: String(group.city ?? ""),
        country: String(group.country ?? ""),
        provider: String(group.provider ?? ""),
        model: String(group.model ?? ""),
        accessType: String(group.accessType ?? ""),
        planLabel: String(group.planLabel ?? ""),
        sampleSize,
        averageScore: Number.isFinite(Number(group.averageScore)) ? Number(group.averageScore) : 0,
        crossRegionEligible: isCrossRegionEligible(sampleSize),
      };
    }),
    privacyThreshold: PRIVACY_THRESHOLD,
    crossRegionThreshold: CROSS_REGION_THRESHOLD,
    benchmarkVersion: requestedVersion,
    availableVersions: [...AVAILABLE_VERSIONS],
    scoredItemCount: requestedVersion === BENCHMARK_VERSION ? 13 : 10,
    reasoningTokenReportStatusCounts:
      requestedVersion === BENCHMARK_VERSION && submissions >= PRIVACY_THRESHOLD
        ? aggregateReasoningTokenReportStatuses(tokenStatusRows)
        : null,
  };
}

class RequestBodyError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function readBoundedJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    throw new RequestBodyError(413, "Submission payload is too large.");
  }
  const reader = request.body?.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let receivedBytes = 0;
  try {
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedBytes += value.byteLength;
        if (receivedBytes > MAX_REQUEST_BYTES) {
          await reader.cancel();
          throw new RequestBodyError(413, "Submission payload is too large.");
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    }
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(400, "Submission payload must be valid UTF-8 JSON.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RequestBodyError(400, "Submission payload must be valid JSON.");
  }
}

export function hasHoneypotValue(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const website = (value as Record<string, unknown>).website;
  return typeof website === "string" && website.trim().length > 0;
}

async function hashSubmission(parts: readonly string[]): Promise<string> {
  const bytes = new TextEncoder().encode(parts.join("\u241f"));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function assessQualityStatus(
  payload: ValidatedSubmission,
  scores: ReturnType<typeof scoreResponses>,
): string {
  const floorFailed = scores.some(({ promptId, score, maxScore }) =>
    ["A1", "A2", "A3"].includes(promptId) && score < maxScore);
  if (floorFailed) return "excluded_floor";
  if (
    payload.uiLanguage !== "en" ||
    payload.vpnUsed !== "no" ||
    payload.memoryPersonalization !== "off" ||
    payload.customInstructions !== "off" ||
    payload.promptsTranslated === 1 ||
    payload.completedInOneSitting === 0 ||
    payload.responses.some(({ regenerated }) => regenerated === 1)
  ) {
    return "excluded_protocol";
  }
  const uniqueOutputs = new Set(payload.responses.map(({ responseText }) => responseText.trim())).size;
  return uniqueOutputs <= 3 ? "flagged_repetition" : "eligible";
}

function localFallbackIp(request: Request): string {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" ? "127.0.0.1" : "";
}

export async function POST(request: Request) {
  try {
    const rawPayload = await readBoundedJson(request);
    if (hasHoneypotValue(rawPayload)) return Response.json({ ok: true }, { status: 201 });

    const validation = validateSubmissionPayload(rawPayload, CURRENT_PROMPT_IDS);
    if (!validation.ok) {
      return Response.json(
        { error: validation.error.message, field: validation.error.path },
        { status: 400 },
      );
    }
    const payload = validation.value;
    if (payload.benchmarkVersion !== BENCHMARK_VERSION) {
      return Response.json({ error: "This benchmark submission is out of date." }, { status: 400 });
    }

    const { env } = await import("cloudflare:workers");
    const turnstileSecret = env.TURNSTILE_SECRET_KEY?.trim();
    const rateLimitSecret = env.RATE_LIMIT_HMAC_SECRET?.trim();
    if (!turnstileSecret || !rateLimitSecret) {
      return Response.json(
        { error: "Abuse protection is not configured yet." },
        { status: 503 },
      );
    }
    const sessionToken = request.headers.get("x-benchmark-session")?.trim() ?? "";
    let benchmarkSession: BenchmarkSessionClaims;
    try {
      benchmarkSession = await verifyBenchmarkSession({
        token: sessionToken,
        expectedBenchmarkVersion: BENCHMARK_VERSION,
        expectedPromptIds: CURRENT_PROMPT_IDS,
        secret: rateLimitSecret,
      });
      assertBenchmarkAssignment(benchmarkSession, payload);
    } catch (error) {
      const assignmentMismatch = error instanceof BenchmarkSessionError &&
        error.code === "SESSION_ASSIGNMENT_MISMATCH";
      return Response.json(
        { error: assignmentMismatch
          ? "The submitted assignment does not match this benchmark session."
          : "A valid benchmark session is required. Start a new run and try again." },
        { status: assignmentMismatch ? 400 : 401 },
      );
    }
    let turnstile;
    try {
      turnstile = await verifyTurnstileToken({
        token: payload.turnstileToken,
        secretKey: turnstileSecret,
        expectedAction: "benchmark-submit",
      });
    } catch {
      return Response.json(
        { error: "Human verification is temporarily unavailable." },
        { status: 503 },
      );
    }
    if (!turnstile.success) {
      const unavailable = turnstile.errorCodes.some((code) =>
        code.startsWith("turnstile-http-") || code === "invalid-turnstile-response");
      return Response.json(
        {
          error: unavailable
            ? "Human verification is temporarily unavailable."
            : "Human verification failed. Please try again.",
        },
        { status: unavailable ? 503 : 400 },
      );
    }

    const database = env.DB;
    // The legacy answer_hash unique index now enforces one accepted submission
    // per signed contract while still allowing identical model outputs from
    // independently issued participant sessions.
    const answerHash = await hashSubmission(["benchmark-session", benchmarkSession.contractId]);
    const existingSession = await database
      .prepare("SELECT 1 AS found FROM submissions WHERE answer_hash = ? LIMIT 1")
      .bind(answerHash)
      .first<{ found: number }>();
    if (existingSession) {
      return Response.json({ error: "This benchmark session has already been contributed." }, { status: 409 });
    }

    const scoringConfig = await loadScoringConfig(database, BENCHMARK_VERSION, CURRENT_PROMPT_IDS);
    const scores = scoreResponses(
      payload.responses.map(({ promptId, responseText }) => ({
        promptId,
        responseText,
        variant: benchmarkSession.sessionVariant,
      })),
      scoringConfig,
    );
    const scoreByPrompt = new Map(scores.map((score) => [score.promptId, score]));
    const overallScore = scores.reduce((sum, item) => sum + item.score, 0);
    const maxScore = scores.reduce((sum, item) => sum + item.maxScore, 0);
    const submissionId = crypto.randomUUID();
    const status = assessQualityStatus(payload, scores);
    const clientIp = request.headers.get("cf-connecting-ip")?.trim() || localFallbackIp(request);
    if (!clientIp) {
      return Response.json({ error: "Abuse protection could not verify this connection." }, { status: 503 });
    }
    const rateLimit = await reserveDailySubmission({
      database,
      ipAddress: clientIp,
      hmacSecret: rateLimitSecret,
      limit: RATE_LIMIT_PER_DAY,
    });
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "This connection has reached today's contribution limit." },
        { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const statements = [
      database
        .prepare(
          `INSERT INTO submissions
            (id, city, country, provider, model, access_type, plan_label, ui_language, platform,
             reasoning_toggle, vpn_used, memory_personalization, custom_instructions,
             prompts_translated, completed_in_one_sitting, session_variant, prompt_order,
             client_timezone, benchmark_version, answer_hash, quality_status, overall_score, max_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          submissionId,
          payload.city,
          payload.country,
          payload.provider,
          payload.model,
          payload.accessType,
          payload.planLabel,
          payload.uiLanguage,
          payload.platform,
          payload.reasoningToggle,
          payload.vpnUsed,
          payload.memoryPersonalization,
          payload.customInstructions,
          payload.promptsTranslated,
          payload.completedInOneSitting,
          benchmarkSession.sessionVariant,
          JSON.stringify(benchmarkSession.promptOrder),
          payload.clientTimezone,
          payload.benchmarkVersion,
          answerHash,
          status,
          overallScore,
          maxScore,
        ),
      ...payload.responses.map((response) => {
        const scored = scoreByPrompt.get(response.promptId);
        if (!scored) throw new Error(`Missing score for ${response.promptId}.`);
        return database
          .prepare(
            `INSERT INTO responses
              (submission_id, prompt_id, response_text, regenerated, response_seconds_bucket,
               self_reported_reasoning_tokens, reasoning_token_status, visible_token_estimate,
               visible_word_count, structure_flags, score, max_score)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            submissionId,
            response.promptId,
            response.responseText,
            response.regenerated,
            response.responseSecondsBucket,
            scored.analysis.tokenReport.raw ?? null,
            scored.analysis.tokenReport.status,
            scored.analysis.visibleTokenEstimate,
            scored.analysis.visibleWordCount,
            JSON.stringify(scored.analysis.structure),
            scored.score,
            scored.maxScore,
          );
      }),
      database
        .prepare(
          `INSERT INTO benchmark_feedback
            (submission_id, clarity_rating, confusing_prompt_id, reason)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(
          submissionId,
          payload.feedback.clarityRating,
          payload.feedback.confusingPromptId,
          payload.feedback.reason,
        ),
    ];

    await database.batch(statements);
    try {
      await database.prepare("DELETE FROM submission_rate_limits WHERE bucket_day < DATE('now', '-2 day')").run();
    } catch {
      // Retention cleanup is best-effort and never exposes or logs a digest.
    }

    return Response.json(
      {
        ok: true,
        score: overallScore,
        maxScore,
        eligibleForPrimaryAnalysis: status === "eligible",
        message: "Your anonymous benchmark response was added.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (message.includes("UNIQUE constraint failed") && message.includes("submissions.answer_hash")) {
      return Response.json({ error: "This benchmark session has already been contributed." }, { status: 409 });
    }
    if (message.includes("Private scoring") || message.includes("scoring rules")) {
      return Response.json({ error: "The private scorer is not initialized yet." }, { status: 503 });
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

export async function GET(request: Request) {
  try {
    const requestedVersion = new URL(request.url).searchParams.get("benchmarkVersion") ?? BENCHMARK_VERSION;
    if (!AVAILABLE_VERSIONS.includes(requestedVersion as (typeof AVAILABLE_VERSIONS)[number])) {
      return Response.json({ error: "Unknown benchmark version." }, { status: 400 });
    }
    const selectedVersion = requestedVersion as (typeof AVAILABLE_VERSIONS)[number];
    const { env } = await import("cloudflare:workers");
    const database = env.DB;
    const [overview, groups] = await Promise.all([
      database
        .prepare(
          `SELECT
             COUNT(*) AS submissions,
             COUNT(DISTINCT UPPER(COALESCE(country, '')) || '|' || LOWER(TRIM(city))) AS cities,
             COUNT(DISTINCT provider || '|' || model) AS models
           FROM submissions
           WHERE benchmark_version = ? AND quality_status = 'eligible'`,
        )
        .bind(selectedVersion)
        .first(),
      database
        .prepare(
          `SELECT
             MIN(city) AS city,
             COALESCE(country, '') AS country,
             provider,
             model,
             access_type AS accessType,
             plan_label AS planLabel,
             COUNT(*) AS sampleSize,
             ROUND(AVG(CAST(overall_score AS REAL) / NULLIF(max_score, 0)) * 100, 1) AS averageScore
           FROM submissions
           WHERE benchmark_version = ? AND quality_status = 'eligible'
           GROUP BY LOWER(city), COALESCE(country, ''), provider, model, access_type, LOWER(plan_label)
           HAVING COUNT(*) >= ${PRIVACY_THRESHOLD}
           ORDER BY sampleSize DESC, averageScore DESC
           LIMIT 100`,
        )
        .bind(selectedVersion)
        .all<ResultGroupRow>(),
    ]);

    let tokenStatusRows: ReasoningTokenStatusCountRow[] = [];
    if (selectedVersion === BENCHMARK_VERSION &&
      nonNegativeInteger(overview?.submissions) >= PRIVACY_THRESHOLD) {
      const tokenStatuses = await database
        .prepare(
          `WITH stored_statuses AS (
             SELECT LOWER(TRIM(COALESCE(r.reasoning_token_status, ''))) AS status
             FROM responses AS r
             INNER JOIN submissions AS s ON s.id = r.submission_id
             WHERE s.benchmark_version = ? AND s.quality_status = 'eligible'
           )
           SELECT status, COUNT(*) AS count
           FROM stored_statuses
           GROUP BY status
           ORDER BY status`,
        )
        .bind(BENCHMARK_VERSION)
        .all<ReasoningTokenStatusCountRow>();
      tokenStatusRows = tokenStatuses.results;
    }

    return Response.json(buildPublicResultsPayload({
      requestedVersion: selectedVersion,
      overview,
      groups: groups.results,
      tokenStatusRows,
    }));
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

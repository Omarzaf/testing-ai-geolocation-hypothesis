import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    city: text("city").notNull(),
    country: text("country"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    accessType: text("access_type").notNull(),
    planLabel: text("plan_label").notNull(),
    uiLanguage: text("ui_language"),
    platform: text("platform"),
    reasoningToggle: text("reasoning_toggle"),
    vpnUsed: text("vpn_used"),
    memoryPersonalization: text("memory_personalization"),
    customInstructions: text("custom_instructions"),
    promptsTranslated: integer("prompts_translated"),
    completedInOneSitting: integer("completed_in_one_sitting"),
    sessionVariant: text("session_variant"),
    promptOrder: text("prompt_order", { mode: "json" }).$type<string[]>(),
    clientTimezone: text("client_timezone"),
    benchmarkVersion: text("benchmark_version").notNull(),
    answerHash: text("answer_hash").notNull(),
    qualityStatus: text("quality_status").notNull().default("eligible"),
    overallScore: integer("overall_score").notNull(),
    maxScore: integer("max_score").notNull(),
    submittedDay: text("submitted_day").notNull().default(sql`(DATE('now'))`),
  },
  (table) => [
    index("submissions_city_idx").on(table.city),
    index("submissions_country_idx").on(table.country),
    index("submissions_model_idx").on(table.provider, table.model),
    uniqueIndex("submissions_answer_hash_idx").on(table.answerHash),
  ],
);

export const responses = sqliteTable(
  "responses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    promptId: text("prompt_id").notNull(),
    responseText: text("response_text").notNull(),
    regenerated: integer("regenerated").notNull().default(0),
    responseSecondsBucket: text("response_seconds_bucket"),
    selfReportedReasoningTokens: text("self_reported_reasoning_tokens"),
    reasoningTokenStatus: text("reasoning_token_status").notNull().default("missing"),
    visibleTokenEstimate: integer("visible_token_estimate"),
    visibleWordCount: integer("visible_word_count"),
    structureFlags: text("structure_flags", { mode: "json" }).$type<Record<string, boolean | number>>(),
    score: integer("score").notNull(),
    maxScore: integer("max_score").notNull(),
  },
  (table) => [index("responses_submission_idx").on(table.submissionId)],
);

export const benchmarkFeedback = sqliteTable("benchmark_feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  submissionId: text("submission_id")
    .notNull()
    .references(() => submissions.id, { onDelete: "cascade" }),
  clarityRating: integer("clarity_rating").notNull(),
  confusingPromptId: text("confusing_prompt_id").notNull().default(""),
  reason: text("reason").notNull().default(""),
});

export const benchmarkScoringRules = sqliteTable(
  "benchmark_scoring_rules",
  {
    benchmarkVersion: text("benchmark_version").notNull(),
    sessionVariant: text("session_variant").notNull(),
    promptId: text("prompt_id").notNull(),
    config: text("config", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    maxScore: integer("max_score").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.benchmarkVersion, table.sessionVariant, table.promptId],
      name: "benchmark_scoring_rules_pk",
    }),
  ],
);

export const submissionRateLimits = sqliteTable(
  "submission_rate_limits",
  {
    bucketDay: text("bucket_day").notNull(),
    ipDigest: text("ip_digest").notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    primaryKey({
      columns: [table.bucketDay, table.ipDigest],
      name: "submission_rate_limits_pk",
    }),
    index("submission_rate_limits_bucket_day_idx").on(table.bucketDay),
  ],
);

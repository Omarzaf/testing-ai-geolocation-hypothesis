import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    city: text("city").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    accessType: text("access_type").notNull(),
    planLabel: text("plan_label").notNull(),
    benchmarkVersion: text("benchmark_version").notNull(),
    answerHash: text("answer_hash").notNull(),
    qualityStatus: text("quality_status").notNull().default("eligible"),
    overallScore: integer("overall_score").notNull(),
    maxScore: integer("max_score").notNull(),
    submittedDay: text("submitted_day").notNull().default(sql`(DATE('now'))`),
  },
  (table) => [
    index("submissions_city_idx").on(table.city),
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

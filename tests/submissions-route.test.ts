import assert from "node:assert/strict";
import test from "node:test";
import {
  GET,
  assessQualityStatus,
  hasHoneypotValue,
  readBoundedJson,
} from "../app/api/submissions/route.ts";
import type { PromptScore } from "../lib/scoring.ts";
import type { ValidatedSubmission } from "../lib/submission.ts";

const basePayload = {
  uiLanguage: "en",
  vpnUsed: "no",
  memoryPersonalization: "off",
  customInstructions: "off",
  promptsTranslated: 0,
  completedInOneSitting: 1,
  responses: Array.from({ length: 15 }, (_, index) => ({
    promptId: index < 3 ? `A${index + 1}` : `P${index + 1}`,
    responseText: `distinct response ${index}`,
    regenerated: 0,
    responseSecondsBucket: "5to15",
  })),
} as unknown as ValidatedSubmission;

const floorScores = ["A1", "A2", "A3"].map((promptId) => ({
  promptId,
  score: 2,
  maxScore: 2,
})) as PromptScore[];

test("bounded JSON rejects invalid and oversized request bodies", async () => {
  await assert.rejects(
    readBoundedJson(new Request("http://localhost/api/submissions", { method: "POST", body: "{" })),
    (error: unknown) => error instanceof Error && "status" in error && error.status === 400,
  );
  await assert.rejects(
    readBoundedJson(new Request("http://localhost/api/submissions", {
      method: "POST",
      headers: { "content-length": "120001" },
      body: "{}",
    })),
    (error: unknown) => error instanceof Error && "status" in error && error.status === 413,
  );
});

test("honeypot recognizes only non-empty website strings", () => {
  assert.equal(hasHoneypotValue({ website: "https://bot.example" }), true);
  assert.equal(hasHoneypotValue({ website: "   " }), false);
  assert.equal(hasHoneypotValue({ website: 42 }), false);
  assert.equal(hasHoneypotValue(null), false);
});

test("quality assessment applies floor, protocol, repetition, and eligible states", () => {
  assert.equal(assessQualityStatus(basePayload, floorScores), "eligible");
  assert.equal(
    assessQualityStatus(basePayload, [{ ...floorScores[0], score: 1 }, ...floorScores.slice(1)]),
    "excluded_floor",
  );
  assert.equal(
    assessQualityStatus({ ...basePayload, vpnUsed: "yes" }, floorScores),
    "excluded_protocol",
  );
  assert.equal(
    assessQualityStatus({ ...basePayload, vpnUsed: "unsure" }, floorScores),
    "excluded_protocol",
  );
  assert.equal(
    assessQualityStatus({ ...basePayload, uiLanguage: "ur" }, floorScores),
    "excluded_protocol",
  );
  const repeated = {
    ...basePayload,
    responses: basePayload.responses.map((response) => ({ ...response, responseText: "same" })),
  };
  assert.equal(assessQualityStatus(repeated, floorScores), "flagged_repetition");
});

test("results route rejects unknown benchmark versions before touching storage", async () => {
  const response = await GET(new Request("http://localhost/api/submissions?benchmarkVersion=core-9.9"));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Unknown benchmark version." });
});

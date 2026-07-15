import assert from "node:assert/strict";
import test from "node:test";
import {
  GET,
  aggregateReasoningTokenReportStatuses,
  assessQualityStatus,
  buildPublicResultsPayload,
  hasHoneypotValue,
  isCrossRegionEligible,
  normalizeReasoningTokenReportStatus,
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
  await assert.rejects(
    readBoundedJson(new Request("http://localhost/api/submissions", {
      method: "POST",
      body: "x".repeat(120_001),
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
  assert.equal(
    assessQualityStatus({ ...basePayload, completedInOneSitting: 0 }, floorScores),
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

test("normalizes legacy token-report states into fixed aggregate-only counters", () => {
  assert.equal(normalizeReasoningTokenReportStatus(" REPORTED "), "reported");
  assert.equal(normalizeReasoningTokenReportStatus("missing"), "absent");
  assert.equal(normalizeReasoningTokenReportStatus(null), "absent");
  assert.equal(normalizeReasoningTokenReportStatus("refusal"), "refused");
  assert.equal(normalizeReasoningTokenReportStatus(42), "invalid");
  assert.equal(normalizeReasoningTokenReportStatus("future-provider-state"), "invalid");

  assert.deepEqual(aggregateReasoningTokenReportStatuses([
    { status: "reported", count: 7 },
    { status: "unknown", count: "3" },
    { status: "refused", count: 2 },
    { status: "refusal", count: 1 },
    { status: "absent", count: 4 },
    { status: "missing", count: 5 },
    { status: null, count: 1 },
    { status: "invalid", count: 6 },
    { status: "future-provider-state", count: 2 },
    { status: "reported", count: -1 },
  ]), {
    reported: 7,
    unknown: 3,
    refused: 3,
    absent: 10,
    invalid: 8,
  });
});

test("suppresses token status aggregates below five eligible core-2 submissions and for v1", () => {
  const tokenStatusRows = [{ status: "reported", count: 12, responseText: "must not escape" }];
  const base = {
    requestedVersion: "core-2.0" as const,
    overview: { submissions: 4, cities: 2, models: 1 },
    groups: [],
    tokenStatusRows,
  };

  const suppressed = buildPublicResultsPayload(base);
  assert.equal(suppressed.reasoningTokenReportStatusCounts, null);

  const visible = buildPublicResultsPayload({
    ...base,
    overview: { submissions: 5, cities: 2, models: 1 },
  });
  assert.deepEqual(visible.reasoningTokenReportStatusCounts, {
    reported: 12,
    unknown: 0,
    refused: 0,
    absent: 0,
    invalid: 0,
  });
  assert.doesNotMatch(JSON.stringify(visible), /must not escape|responseText|submissionId/);

  const archived = buildPublicResultsPayload({
    ...base,
    requestedVersion: "core-1.0",
    overview: { submissions: 50, cities: 10, models: 4 },
  });
  assert.equal(archived.benchmarkVersion, "core-1.0");
  assert.equal(archived.reasoningTokenReportStatusCounts, null);
});

test("keeps n>=5 groups visible while marking cross-region eligibility only at n>=10", () => {
  assert.equal(isCrossRegionEligible(9), false);
  assert.equal(isCrossRegionEligible(10), true);

  const overviewWithPrivateFields = {
    submissions: 14,
    cities: 2,
    models: 1,
    latestSubmissionId: "must-not-escape",
  };
  const groupsWithPrivateFields = [
    {
      city: "First",
      country: "US",
      provider: "Provider",
      model: "Model",
      accessType: "Paid",
      planLabel: "Plan",
      sampleSize: 5,
      averageScore: 80,
      responseText: "must-not-escape",
    },
    {
      city: "Second",
      country: "CA",
      provider: "Provider",
      model: "Model",
      accessType: "Paid",
      planLabel: "Plan",
      sampleSize: 10,
      averageScore: 82,
      submissionId: "must-not-escape",
    },
  ];
  const payload = buildPublicResultsPayload({
    requestedVersion: "core-2.0",
    overview: overviewWithPrivateFields,
    groups: groupsWithPrivateFields,
    tokenStatusRows: [],
  });

  assert.equal(payload.privacyThreshold, 5);
  assert.equal(payload.crossRegionThreshold, 10);
  assert.deepEqual(payload.groups.map(({ sampleSize, crossRegionEligible }) => ({
    sampleSize,
    crossRegionEligible,
  })), [
    { sampleSize: 5, crossRegionEligible: false },
    { sampleSize: 10, crossRegionEligible: true },
  ]);
  assert.doesNotMatch(JSON.stringify(payload), /must-not-escape|latestSubmissionId|responseText|submissionId/);
});

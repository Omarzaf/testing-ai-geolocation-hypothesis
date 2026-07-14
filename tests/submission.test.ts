import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPECTED_PROMPT_COUNT,
  parseSubmissionPayload,
  validateSubmissionPayload,
} from "../lib/submission.ts";

const PROMPT_IDS = Array.from(
  { length: EXPECTED_PROMPT_COUNT },
  (_, index) => `prompt-${String(index + 1).padStart(2, "0")}`,
);

function validPayload() {
  const promptOrder = [...PROMPT_IDS].reverse();
  return {
    city: "  Lahore   City  ",
    country: "pk",
    provider: "OpenAI / ChatGPT",
    model: "GPT-5.4",
    accessType: "Paid",
    planLabel: "Plus",
    uiLanguage: "en",
    platform: "web",
    reasoningToggle: "on",
    vpnUsed: "no",
    memoryPersonalization: "off",
    customInstructions: "off",
    promptsTranslated: 0,
    completedInOneSitting: 1,
    sessionVariant: "A",
    promptOrder,
    clientTimezone: "Asia/Karachi",
    benchmarkVersion: "core-2.0",
    responses: promptOrder.map((promptId) => ({
      promptId,
      responseText: `Complete answer for ${promptId}`,
      regenerated: 0,
      responseSecondsBucket: "15to60",
    })),
    feedback: {
      clarityRating: 5,
      confusingPromptId: "",
      reason: "",
    },
    website: "",
    turnstileToken: "turnstile-test-token",
  };
}

test("parses and normalizes a complete core-2 submission", () => {
  const parsed = parseSubmissionPayload(validPayload(), PROMPT_IDS);
  assert.equal(parsed.city, "Lahore City");
  assert.equal(parsed.country, "PK");
  assert.equal(parsed.responses.length, EXPECTED_PROMPT_COUNT);
  assert.deepEqual(new Set(parsed.promptOrder), new Set(PROMPT_IDS));
  assert.equal(parsed.completedInOneSitting, 1);
  assert.equal(parsed.turnstileToken, "turnstile-test-token");
});

test("rejects unknown fields at the root, response, and feedback layers", () => {
  const cases: Array<{ path: string; mutate(payload: ReturnType<typeof validPayload>): void }> = [
    {
      path: "payload.unexpected",
      mutate(payload) {
        (payload as Record<string, unknown>).unexpected = true;
      },
    },
    {
      path: "responses[0].unexpected",
      mutate(payload) {
        (payload.responses[0] as Record<string, unknown>).unexpected = true;
      },
    },
    {
      path: "feedback.unexpected",
      mutate(payload) {
        (payload.feedback as Record<string, unknown>).unexpected = true;
      },
    },
  ];

  for (const { path, mutate } of cases) {
    const payload = validPayload();
    mutate(payload);
    const result = validateSubmissionPayload(payload, PROMPT_IDS);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.path, path);
  }
});

test("requires official country codes and every listed enum", () => {
  const invalidFields = [
    ["country", "ZZ"],
    ["accessType", "Enterprise"],
    ["uiLanguage", "fr"],
    ["platform", "terminal"],
    ["reasoningToggle", "maybe"],
    ["vpnUsed", "sometimes"],
    ["memoryPersonalization", "disabled"],
    ["customInstructions", "disabled"],
    ["sessionVariant", "C"],
  ] as const;

  for (const [field, value] of invalidFields) {
    const payload = validPayload();
    (payload as Record<string, unknown>)[field] = value;
    const result = validateSubmissionPayload(payload, PROMPT_IDS);
    assert.equal(result.ok, false, `${field} should be rejected`);
  }
});

test("requires 0/1 disqualifier flags and response metadata", () => {
  const translated = validPayload();
  translated.promptsTranslated = 2;
  assert.equal(validateSubmissionPayload(translated, PROMPT_IDS).ok, false);

  const regenerated = validPayload();
  regenerated.responses[0].regenerated = 2;
  assert.equal(validateSubmissionPayload(regenerated, PROMPT_IDS).ok, false);

  const bucket = validPayload();
  bucket.responses[0].responseSecondsBucket = "one-minute";
  assert.equal(validateSubmissionPayload(bucket, PROMPT_IDS).ok, false);
});

test("requires promptOrder and responses to contain the exact unique prompt set", () => {
  const duplicateOrder = validPayload();
  duplicateOrder.promptOrder[0] = duplicateOrder.promptOrder[1];
  assert.equal(validateSubmissionPayload(duplicateOrder, PROMPT_IDS).ok, false);

  const duplicateResponse = validPayload();
  duplicateResponse.responses[0].promptId = duplicateResponse.responses[1].promptId;
  assert.equal(validateSubmissionPayload(duplicateResponse, PROMPT_IDS).ok, false);

  const unknownResponse = validPayload();
  unknownResponse.responses[0].promptId = "unknown-prompt";
  assert.equal(validateSubmissionPayload(unknownResponse, PROMPT_IDS).ok, false);

  const reorderedResponses = validPayload();
  [reorderedResponses.responses[0], reorderedResponses.responses[1]] = [
    reorderedResponses.responses[1],
    reorderedResponses.responses[0],
  ];
  const orderResult = validateSubmissionPayload(reorderedResponses, PROMPT_IDS);
  assert.equal(orderResult.ok, false);
  if (!orderResult.ok) assert.equal(orderResult.error.path, "payload.responses");
});

test("enforces bounded response and Turnstile token sizes", () => {
  const oversizedResponse = validPayload();
  oversizedResponse.responses[0].responseText = "x".repeat(6_001);
  assert.equal(validateSubmissionPayload(oversizedResponse, PROMPT_IDS).ok, false);

  const missingToken = validPayload();
  missingToken.turnstileToken = "";
  assert.equal(validateSubmissionPayload(missingToken, PROMPT_IDS).ok, false);
});

test("rejects an invalid caller-supplied benchmark contract", () => {
  assert.throws(
    () => parseSubmissionPayload(validPayload(), PROMPT_IDS.slice(0, -1)),
    /exactly 15 prompt IDs/,
  );
  assert.throws(
    () => parseSubmissionPayload(validPayload(), [...PROMPT_IDS.slice(0, -1), PROMPT_IDS[0]]),
    /must be unique/,
  );
});

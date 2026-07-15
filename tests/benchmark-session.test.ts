import assert from "node:assert/strict";
import test from "node:test";
import {
  BenchmarkSessionError,
  assertBenchmarkAssignment,
  issueBenchmarkSession,
  verifyBenchmarkSession,
} from "../lib/benchmarkSession.server.ts";

const SECRET = "test-only-benchmark-session-secret-material".padEnd(48, "!");
const PROMPT_IDS = Array.from({ length: 15 }, (_, index) => `P${index + 1}`);
const NOW = new Date("2026-07-14T20:00:00.000Z");
const CONTRACT_ID = "123e4567-e89b-42d3-a456-426614174000";
const ENTROPY = Array.from({ length: 15 }, (_, index) => index + 1);

async function issued() {
  return issueBenchmarkSession({
    benchmarkVersion: "core-2.0",
    promptIds: PROMPT_IDS,
    secret: SECRET,
    now: NOW,
    contractId: CONTRACT_ID,
    entropy: ENTROPY,
  });
}

test("issues a deterministic signed assignment containing the exact prompt set", async () => {
  const first = await issued();
  const second = await issued();
  assert.deepEqual(first, second);
  assert.equal(first.contractId, CONTRACT_ID);
  assert.equal(first.sessionVariant, "B");
  assert.equal(first.promptOrder.length, 15);
  assert.deepEqual(new Set(first.promptOrder), new Set(PROMPT_IDS));
  assert.equal(first.expiresAt - first.issuedAt, 72 * 60 * 60);

  const verified = await verifyBenchmarkSession({
    token: first.sessionToken,
    expectedBenchmarkVersion: "core-2.0",
    expectedPromptIds: PROMPT_IDS,
    secret: SECRET,
    now: NOW,
  });
  assert.deepEqual(verified, {
    contractVersion: first.contractVersion,
    contractId: first.contractId,
    benchmarkVersion: first.benchmarkVersion,
    sessionVariant: first.sessionVariant,
    promptOrder: first.promptOrder,
    issuedAt: first.issuedAt,
    expiresAt: first.expiresAt,
  });

  const verifiedAfterFortyEightHours = await verifyBenchmarkSession({
    token: first.sessionToken,
    expectedBenchmarkVersion: "core-2.0",
    expectedPromptIds: PROMPT_IDS,
    secret: SECRET,
    now: new Date(NOW.getTime() + 48 * 60 * 60 * 1_000),
  });
  assert.equal(verifiedAfterFortyEightHours.contractId, first.contractId);

  const verifiedOneSecondBeforeExpiry = await verifyBenchmarkSession({
    token: first.sessionToken,
    expectedBenchmarkVersion: "core-2.0",
    expectedPromptIds: PROMPT_IDS,
    secret: SECRET,
    now: new Date(NOW.getTime() + (72 * 60 * 60 - 1) * 1_000),
  });
  assert.equal(verifiedOneSecondBeforeExpiry.contractId, first.contractId);
});

test("signature, payload, secret, expiry, version, and prompt tampering fail closed", async () => {
  const session = await issued();
  const [payload, signature] = session.sessionToken.split(".");
  const mutate = (value: string) => `${value.startsWith("A") ? "B" : "A"}${value.slice(1)}`;

  for (const token of [`${mutate(payload)}.${signature}`, `${payload}.${mutate(signature)}`]) {
    await assert.rejects(
      verifyBenchmarkSession({
        token,
        expectedBenchmarkVersion: "core-2.0",
        expectedPromptIds: PROMPT_IDS,
        secret: SECRET,
        now: NOW,
      }),
      (error: unknown) => error instanceof BenchmarkSessionError && error.code === "SESSION_SIGNATURE_INVALID",
    );
  }

  await assert.rejects(
    verifyBenchmarkSession({
      token: session.sessionToken,
      expectedBenchmarkVersion: "core-2.0",
      expectedPromptIds: PROMPT_IDS,
      secret: `${SECRET}different`,
      now: NOW,
    }),
    (error: unknown) => error instanceof BenchmarkSessionError && error.code === "SESSION_SIGNATURE_INVALID",
  );
  await assert.rejects(
    verifyBenchmarkSession({
      token: session.sessionToken,
      expectedBenchmarkVersion: "core-2.0",
      expectedPromptIds: PROMPT_IDS,
      secret: SECRET,
      now: new Date(NOW.getTime() + 72 * 60 * 60 * 1_000),
    }),
    (error: unknown) => error instanceof BenchmarkSessionError && error.code === "SESSION_EXPIRED",
  );
  await assert.rejects(
    verifyBenchmarkSession({
      token: session.sessionToken,
      expectedBenchmarkVersion: "core-9.9",
      expectedPromptIds: PROMPT_IDS,
      secret: SECRET,
      now: NOW,
    }),
    (error: unknown) => error instanceof BenchmarkSessionError && error.code === "SESSION_VERSION_MISMATCH",
  );
  await assert.rejects(
    verifyBenchmarkSession({
      token: session.sessionToken,
      expectedBenchmarkVersion: "core-2.0",
      expectedPromptIds: [...PROMPT_IDS.slice(0, -1), "OTHER"],
      secret: SECRET,
      now: NOW,
    }),
    (error: unknown) => error instanceof BenchmarkSessionError && error.code === "SESSION_PROMPTS_MISMATCH",
  );
});

test("assignment matching rejects caller-selected variant, order, or version", async () => {
  const session = await issued();
  assert.doesNotThrow(() => assertBenchmarkAssignment(session, {
    benchmarkVersion: session.benchmarkVersion,
    sessionVariant: session.sessionVariant,
    promptOrder: session.promptOrder,
  }));

  const swapped = [...session.promptOrder];
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  const mismatches = [
    { benchmarkVersion: "core-1.0", sessionVariant: session.sessionVariant, promptOrder: session.promptOrder },
    { benchmarkVersion: session.benchmarkVersion, sessionVariant: session.sessionVariant === "A" ? "B" as const : "A" as const, promptOrder: session.promptOrder },
    { benchmarkVersion: session.benchmarkVersion, sessionVariant: session.sessionVariant, promptOrder: swapped },
  ];
  for (const mismatch of mismatches) {
    assert.throws(
      () => assertBenchmarkAssignment(session, mismatch),
      (error: unknown) => error instanceof BenchmarkSessionError && error.code === "SESSION_ASSIGNMENT_MISMATCH",
    );
  }
});

test("issuance rejects weak secrets, duplicate prompts, invalid IDs, and invalid entropy", async () => {
  const base = {
    benchmarkVersion: "core-2.0",
    promptIds: PROMPT_IDS,
    secret: SECRET,
    now: NOW,
    contractId: CONTRACT_ID,
    entropy: ENTROPY,
  };
  await assert.rejects(issueBenchmarkSession({ ...base, secret: "short" }), /not configured/i);
  await assert.rejects(issueBenchmarkSession({ ...base, promptIds: [...PROMPT_IDS.slice(0, -1), PROMPT_IDS[0]] }), /prompt configuration/i);
  await assert.rejects(issueBenchmarkSession({ ...base, contractId: "not-a-uuid" }), /identifier/i);
  await assert.rejects(issueBenchmarkSession({ ...base, entropy: [1, 2] }), /entropy/i);
});

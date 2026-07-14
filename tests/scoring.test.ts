import assert from "node:assert/strict";
import test from "node:test";
import {
  BENCHMARK_PROMPTS,
  REASONING_TOKEN_TRAILER,
  appendReasoningTokenTrailer,
  renderPromptForCopy,
  selectBenchmarkVariant,
  shufflePromptOrder,
} from "../lib/benchmark.ts";
import {
  analyzeResponse,
  estimateVisibleOutput,
  extractReasoningTokenReport,
  parseScoringConfig,
  scoreResponses,
  type ScoringConfig,
} from "../lib/scoring.ts";

const syntheticConfig: ScoringConfig = parseScoringConfig({
  benchmarkVersion: "synthetic-1",
  prompts: [
    {
      promptId: "fixture-exact",
      defaultVariant: "A",
      variants: {
        A: { rules: [{ id: "exact", kind: "exact", expected: "amber kite", points: 1 }] },
        B: { rules: [{ id: "exact", kind: "exact", expected: "silver reed", points: 1 }] },
      },
    },
    {
      promptId: "fixture-regex",
      variants: {
        A: { rules: [{ id: "shape", kind: "regex", pattern: "^CODE-[A-Z]{3}$", points: 1 }] },
      },
    },
    {
      promptId: "fixture-contains",
      variants: {
        A: {
          rules: [{
            id: "terms",
            kind: "contains",
            all: ["orchid"],
            any: ["glass", "stone"],
            none: ["plastic"],
            points: 1,
          }],
        },
      },
    },
    {
      promptId: "fixture-numeric",
      variants: {
        A: { rules: [{ id: "value", kind: "numeric", expected: "7/8", source: "final-answer", points: 1 }] },
      },
    },
    {
      promptId: "fixture-sequence-numbers",
      variants: {
        A: { rules: [{ id: "steps", kind: "sequence", expected: [7, 14, 21], tokenType: "number", points: 1 }] },
      },
    },
    {
      promptId: "fixture-sequence-words",
      variants: {
        A: { rules: [{ id: "order", kind: "sequence", expected: ["elm", "fir", "oak"], tokenType: "word", source: "last-line", contiguous: true, points: 1 }] },
      },
    },
    {
      promptId: "fixture-text",
      variants: {
        A: {
          rules: [{
            id: "constraints",
            kind: "text-constraints",
            sentenceCount: 2,
            wordsPerSentence: 4,
            paragraphCount: 1,
            totalWords: 8,
            exactWordCounts: { moss: 2 },
            forbiddenCharacters: ["x"],
            sentenceConstraints: [{ index: 1, wordCount: 4, forbiddenCharacters: ["q"] }],
            lastWord: "dawn",
            forbidBulletList: true,
            forbidNumberedList: true,
            points: 1,
          }],
        },
      },
    },
    {
      promptId: "fixture-probe",
      variants: {
        A: { rules: [{ id: "capture", kind: "probe", points: 0 }] },
      },
    },
  ],
});

const validSyntheticResponses = [
  { promptId: "fixture-exact", responseText: "amber kite\nREASONING TOKENS: 12" },
  { promptId: "fixture-regex", responseText: "CODE-RST" },
  { promptId: "fixture-contains", responseText: "An orchid rests on glass." },
  { promptId: "fixture-numeric", responseText: "FINAL ANSWER: 87.5%" },
  { promptId: "fixture-sequence-numbers", responseText: "7, then 9, then 14, and finally 21" },
  { promptId: "fixture-sequence-words", responseText: "Order follows.\nelm fir oak" },
  { promptId: "fixture-text", responseText: "Moss grows beside stones. Moss rests until dawn." },
  { promptId: "fixture-probe", responseText: "A free-form observation." },
];

test("core catalog enumerates fifteen answer-free A/B prompt variants", () => {
  assert.equal(BENCHMARK_PROMPTS.length, 15);
  assert.equal(BENCHMARK_PROMPTS.filter((prompt) => prompt.scored).length, 13);
  assert.equal(new Set(BENCHMARK_PROMPTS.map((prompt) => prompt.id)).size, 15);
  assert.ok(BENCHMARK_PROMPTS.every((prompt) => prompt.variants.A && prompt.variants.B));
  assert.ok(BENCHMARK_PROMPTS.every((prompt) => prompt.prompt === prompt.variants.A));
  assert.ok(BENCHMARK_PROMPTS.every((prompt) => !prompt.prompt.includes(REASONING_TOKEN_TRAILER)));
});

test("variant selection and copy rendering are explicit and trailer-safe", () => {
  const item = BENCHMARK_PROMPTS[0];
  const selected = selectBenchmarkVariant(item.id, "B");
  assert.equal(selected?.variant, "B");
  assert.equal(selected?.prompt, item.variants.B);
  assert.equal(selectBenchmarkVariant("not-present", "A"), undefined);

  const rendered = renderPromptForCopy(item, "B");
  assert.equal(rendered.prompt, `${item.variants.B}\n\n${REASONING_TOKEN_TRAILER}`);
  assert.equal(appendReasoningTokenTrailer(rendered.prompt), rendered.prompt);
  assert.equal(
    REASONING_TOKEN_TRAILER,
    `After your answer, add one final line in exactly this format:\nREASONING TOKENS: [your best estimate of how many tokens you used thinking about this problem, as a number, or "unknown"]`,
  );
});

test("seeded shuffle is deterministic, non-mutating, and does not call Math.random", () => {
  const source = ["alpha", "bravo", "charlie", "delta", "echo"];
  const originalRandom = Math.random;
  Math.random = () => { throw new Error("ambient randomness used"); };
  try {
    const first = shufflePromptOrder(source, "fixed-seed");
    const second = shufflePromptOrder(source, "fixed-seed");
    const third = shufflePromptOrder(source, "other-seed");
    assert.deepEqual(first, second);
    assert.notDeepEqual(first, third);
    assert.deepEqual([...first].sort(), [...source].sort());
    assert.deepEqual(source, ["alpha", "bravo", "charlie", "delta", "echo"]);
  } finally {
    Math.random = originalRandom;
  }
});

test("every generic scorer kind passes its synthetic fixture", () => {
  const scores = scoreResponses(validSyntheticResponses, syntheticConfig);
  assert.equal(scores.length, syntheticConfig.prompts.length);
  assert.deepEqual(
    scores.slice(0, -1).map(({ promptId, score, maxScore }) => ({ promptId, score, maxScore })),
    syntheticConfig.prompts.slice(0, -1).map(({ promptId }) => ({ promptId, score: 1, maxScore: 1 })),
  );
  assert.deepEqual(scores.at(-1) && { score: scores.at(-1)?.score, maxScore: scores.at(-1)?.maxScore }, { score: 0, maxScore: 0 });
  assert.deepEqual(new Set(scores.flatMap((score) => score.rules.map((rule) => rule.kind))),
    new Set(["exact", "regex", "contains", "numeric", "sequence", "text-constraints", "probe"]));
});

test("variant-specific rules are selected at runtime", () => {
  const scores = scoreResponses([
    ...validSyntheticResponses.filter(({ promptId }) => promptId !== "fixture-exact"),
    { promptId: "fixture-exact", variant: "B", responseText: "silver reed" },
  ], syntheticConfig);
  const exact = scores.find(({ promptId }) => promptId === "fixture-exact");
  assert.equal(exact?.variant, "B");
  assert.equal(exact?.score, 1);
});

test("exact, numeric, sequence, contains, and regex traps fail closed", () => {
  const replacements: Record<string, string> = {
    "fixture-exact": "amber kite extra",
    "fixture-regex": "prefix CODE-RST suffix",
    "fixture-contains": "An orchid rests on plastic glass.",
    "fixture-numeric": "FINAL ANSWER: 7/80",
    "fixture-sequence-numbers": "17, then 14, then 21",
    "fixture-sequence-words": "oak fir elm",
  };
  const responses = validSyntheticResponses.map((response) => ({
    ...response,
    responseText: replacements[response.promptId] ?? response.responseText,
  }));
  const scores = scoreResponses(responses, syntheticConfig);
  for (const promptId of Object.keys(replacements)) {
    assert.equal(scores.find((score) => score.promptId === promptId)?.score, 0, promptId);
  }
});

test("text constraints use lexical words, case-insensitive bans, and terminal punctuation", () => {
  const base = validSyntheticResponses.filter(({ promptId }) => promptId !== "fixture-text");
  const evaluate = (responseText: string) => scoreResponses([
    ...base,
    { promptId: "fixture-text", responseText },
  ], syntheticConfig).find(({ promptId }) => promptId === "fixture-text")?.score;

  assert.equal(evaluate("Moss grows beside stones. Moss rests until dawn."), 1);
  assert.equal(evaluate("Mossy growth covers stones. Moss rests until dawn."), 0);
  assert.equal(evaluate("Moss grows beside Xylophones. Moss rests until dawn."), 0);
  assert.equal(evaluate("- Moss grows beside stones.\n- Moss rests until dawn."), 0);
  assert.equal(evaluate("Moss grows beside stones. Moss rests until dawn.\nREASONING TOKENS: unknown"), 1);
});

test("reasoning-token extraction reports every distinct status", () => {
  assert.deepEqual(extractReasoningTokenReport("Answer.\nREASONING TOKENS: 19"), {
    status: "reported", value: 19, raw: "REASONING TOKENS: 19",
  });
  assert.deepEqual(extractReasoningTokenReport("Answer.\nREASONING TOKENS: about 1,200 tokens"), {
    status: "reported", value: 1200, raw: "REASONING TOKENS: about 1,200 tokens",
  });
  assert.deepEqual(extractReasoningTokenReport("Answer.\nREASONING TOKENS: ~500"), {
    status: "reported", value: 500, raw: "REASONING TOKENS: ~500",
  });
  assert.deepEqual(extractReasoningTokenReport('Answer.\nREASONING TOKENS: "unknown"'), {
    status: "unknown", value: null, raw: 'REASONING TOKENS: "unknown"',
  });
  assert.deepEqual(extractReasoningTokenReport("I cannot access reasoning token counts."), {
    status: "refused", value: null,
  });
  assert.deepEqual(extractReasoningTokenReport("I don't have access to that information"), {
    status: "refused", value: null,
  });
  assert.deepEqual(extractReasoningTokenReport("Answer without a report."), {
    status: "absent", value: null,
  });
  assert.deepEqual(extractReasoningTokenReport("REASONING TOKENS: about 1,200 tokens\nAnswer follows."), {
    status: "invalid", value: null, raw: "REASONING TOKENS: about 1,200 tokens",
  });
  assert.equal(extractReasoningTokenReport("about 1,200 tokens").status, "absent");
  assert.equal(extractReasoningTokenReport("Answer.\nREASONING TOKENS: about twenty").status, "invalid");
  assert.equal(extractReasoningTokenReport("Answer.\nREASONING TOKENS: 2.5").status, "invalid");
});

test("visible estimates and structure flags remain separate from hidden-token reports", () => {
  assert.deepEqual(estimateVisibleOutput("One two."), { wordCount: 2, tokenEstimate: 2 });
  assert.deepEqual(estimateVisibleOutput("a          b"), { wordCount: 2, tokenEstimate: 3 });
  const analysis = analyzeResponse("FINAL ANSWER: amber\n- first item\n```txt\ncode\n```\nREASONING TOKENS: 9");
  assert.equal(analysis.tokenReport.status, "reported");
  assert.ok(analysis.visibleWordCount > analysis.answerWordCount);
  assert.equal(analysis.structure.hasFinalAnswerLine, true);
  assert.equal(analysis.structure.hasReasoningTokenLabel, true);
  assert.equal(analysis.structure.hasBulletList, true);
  assert.equal(analysis.structure.hasCodeFence, true);

  const numbered = analyzeResponse("1. first\n2. second");
  assert.equal(numbered.structure.hasNumberedList, true);
  assert.equal(analyzeResponse('{"synthetic":true}').structure.looksLikeJson, true);
});

test("missing responses score zero and malformed inputs cannot override configured prompts", () => {
  const missing = scoreResponses([], syntheticConfig);
  assert.ok(missing.every(({ score }) => score === 0));
  assert.throws(() => scoreResponses(validSyntheticResponses, undefined), /runtime scoring configuration/i);
  assert.throws(() => scoreResponses([
    { promptId: "fixture-exact", responseText: "amber kite" },
    { promptId: "fixture-exact", responseText: "amber kite" },
  ], syntheticConfig), /duplicate scoring response/i);
  assert.throws(() => scoreResponses([{ promptId: "unknown-fixture", responseText: "text" }], syntheticConfig), /unknown scoring prompt/i);
});

test("runtime configuration validation rejects duplicate prompts, invalid regexes, and scored probes", () => {
  assert.throws(() => parseScoringConfig({
    benchmarkVersion: "bad",
    prompts: [
      { promptId: "same", variants: { A: { rules: [{ id: "probe", kind: "probe", points: 0 }] } } },
      { promptId: "same", variants: { A: { rules: [{ id: "probe", kind: "probe", points: 0 }] } } },
    ],
  }), /duplicate scoring prompt/i);
  assert.throws(() => parseScoringConfig({
    benchmarkVersion: "bad",
    prompts: [{ promptId: "regex", variants: { A: { rules: [{ id: "bad", kind: "regex", pattern: "(", points: 1 }] } } }],
  }));
  assert.throws(() => parseScoringConfig({
    benchmarkVersion: "bad",
    prompts: [{ promptId: "probe", variants: { A: { rules: [{ id: "bad", kind: "probe", points: 1 }] } } }],
  }), /probe points must be zero/i);
  assert.throws(() => parseScoringConfig({
    benchmarkVersion: "bad",
    prompts: [{ promptId: "contains", variants: { A: { rules: [{ id: "bad", kind: "contains", points: 1 }] } } }],
  }), /contains rule has no terms/i);
  assert.throws(() => parseScoringConfig({
    benchmarkVersion: "bad",
    prompts: [{ promptId: "constraints", variants: { A: { rules: [{ id: "bad", kind: "text-constraints", points: 1 }] } } }],
  }), /text constraint rule is empty/i);
  assert.throws(() => parseScoringConfig({
    benchmarkVersion: "bad",
    prompts: [{ promptId: "sequence", variants: { A: { rules: [{ id: "bad", kind: "sequence", tokenType: "number", expected: ["not-numeric"], points: 1 }] } } }],
  }), /non-numeric value/i);
});

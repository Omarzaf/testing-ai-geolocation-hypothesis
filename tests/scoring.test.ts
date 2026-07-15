import assert from "node:assert/strict";
import test from "node:test";
import {
  BENCHMARK_PROMPTS,
  REASONING_TOKEN_TRAILER,
  appendReasoningTokenTrailer,
  renderPromptForCopy,
  selectBenchmarkVariant,
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
      promptId: "fixture-regex-set",
      variants: {
        A: {
          rules: [{
            id: "positions",
            kind: "regex-set",
            patterns: ["slot\\s*1\\s*=\\s*cedar", "slot\\s*2\\s*=\\s*birch", "slot\\s*3\\s*=\\s*maple"],
            forbiddenPatterns: ["slot\\s*1\\s*=\\s*maple"],
            minimumMatches: 2,
            flags: "i",
            points: 1,
          }],
        },
      },
    },
    {
      promptId: "fixture-list-output",
      variants: {
        A: {
          rules: [{
            id: "lists",
            kind: "list-output",
            expected: ["cedar", "birch"],
            listIndex: 0,
            totalLists: 1,
            structured: { fields: ["OUTPUT"], requiredFields: ["OUTPUT"] },
            points: 1,
          }],
        },
      },
    },
    {
      promptId: "fixture-ordering",
      variants: {
        A: {
          rules: [{
            id: "order",
            kind: "ordering",
            expected: ["cedar", "birch", "maple"],
            minimumMatches: 3,
            listOnly: true,
            forbiddenPatterns: ["\\b(?:answer|order|this)\\s+is\\s+(?:wrong|incorrect)\\b"],
            structured: { fields: ["ORDER"], requiredFields: ["ORDER"] },
            points: 1,
          }],
        },
      },
    },
    {
      promptId: "fixture-numeric",
      variants: {
        A: { rules: [{ id: "value", kind: "numeric", expected: "5/8", source: "final-answer", points: 1 }] },
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
            forbidMarkdown: true,
            requireLexicalStart: true,
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
  { promptId: "fixture-regex-set", responseText: "slot 1 = cedar; slot 2 = birch" },
  { promptId: "fixture-list-output", responseText: "OUTPUT: [cedar, birch]" },
  { promptId: "fixture-ordering", responseText: "ORDER: [cedar, birch, maple]" },
  { promptId: "fixture-numeric", responseText: "FINAL ANSWER: 62.5%" },
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

  for (const prompt of BENCHMARK_PROMPTS) {
    for (const variant of ["A", "B"] as const) {
      const copy = renderPromptForCopy(prompt, variant).prompt;
      assert.equal(copy.endsWith(REASONING_TOKEN_TRAILER), true);
      assert.equal(copy.split(REASONING_TOKEN_TRAILER).length - 1, 1);
    }
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
    new Set(["exact", "regex", "regex-set", "list-output", "ordering", "contains", "numeric", "sequence", "text-constraints", "probe"]));
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
    "fixture-regex-set": "slot 1 = cedar; slot 3 = elm",
    "fixture-list-output": "OUTPUT: [cedar, birch] [maple]",
    "fixture-ordering": "ORDER: [maple, birch, cedar]",
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

test("regex sets reject contradictory forbidden mappings before counting matches", () => {
  const responses = validSyntheticResponses.map((response) => response.promptId === "fixture-regex-set"
    ? { ...response, responseText: `${response.responseText}; slot 1 = maple` }
    : response);
  assert.equal(
    scoreResponses(responses, syntheticConfig).find(({ promptId }) => promptId === "fixture-regex-set")?.score,
    0,
  );
});

test("ordering rules reject contradictory relations and explicit retractions", () => {
  const base = validSyntheticResponses.filter(({ promptId }) => promptId !== "fixture-ordering");
  const evaluate = (responseText: string) => scoreResponses([
    ...base,
    { promptId: "fixture-ordering", responseText },
  ], syntheticConfig).find(({ promptId }) => promptId === "fixture-ordering")?.score;

  assert.equal(evaluate("ORDER: [cedar, birch, maple] but maple before cedar"), 0);
  assert.equal(evaluate("ORDER: [cedar, birch, maple] but this is wrong"), 0);
  assert.equal(evaluate("ORDER: [cedar, birch, maple] but cedar is not before birch"), 0);
});

test("structured scopes reject duplicate fields, unknown fields, and prose", () => {
  const score = (promptId: string, responseText: string) => scoreResponses([
    ...validSyntheticResponses.filter((response) => response.promptId !== promptId),
    { promptId, responseText },
  ], syntheticConfig).find((result) => result.promptId === promptId)?.score;

  assert.equal(score("fixture-list-output", "OUTPUT: [cedar, birch]\nOUTPUT: [cedar, birch]"), 0);
  assert.equal(score("fixture-list-output", "NOTE: exact\nOUTPUT: [cedar, birch]"), 0);
  assert.equal(score("fixture-ordering", "Here it is.\nORDER: [cedar, birch, maple]"), 0);
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
  assert.equal(evaluate("**Moss grows beside stones. Moss rests until dawn.**"), 0);
  assert.equal(evaluate("---\nMoss grows beside stones. Moss rests until dawn."), 0);
  assert.equal(evaluate("===\nMoss grows beside stones. Moss rests until dawn."), 0);
  assert.equal(evaluate("Moss grows beside stones. Moss rests until dawn.\nREASONING TOKENS: unknown"), 1);
});

test("objective rules accept narrow markdown wrappers without relaxing strict text", () => {
  const replace = (promptId: string, responseText: string) => scoreResponses([
    ...validSyntheticResponses.filter((response) => response.promptId !== promptId),
    { promptId, responseText },
  ], syntheticConfig).find((score) => score.promptId === promptId)?.score;

  assert.equal(replace("fixture-exact", "```text\namber kite\n```"), 1);
  assert.equal(replace("fixture-regex", "**CODE-RST**"), 1);
  assert.equal(replace("fixture-regex", "CODE-RST   \n\n"), 1);
  assert.equal(replace("fixture-numeric", "**FINAL ANSWER:** **62.5%**"), 1);
  assert.equal(analyzeResponse("**FINAL ANSWER:** 5").structure.hasFinalAnswerLine, true);
});

test("objective normalization accepts smart quotes and spaced fractions", () => {
  const config = parseScoringConfig({
    benchmarkVersion: "normalization-fixture",
    prompts: [
      {
        promptId: "quotes",
        variants: { A: { rules: [{ id: "exact", kind: "exact", expected: '"quoted"', points: 1 }] } },
      },
      {
        promptId: "fraction",
        variants: { A: { rules: [{ id: "numeric", kind: "numeric", expected: "5/13", source: "final-answer", points: 1 }] } },
      },
    ],
  });
  const scores = scoreResponses([
    { promptId: "quotes", responseText: "“quoted”   " },
    { promptId: "fraction", responseText: "FINAL ANSWER: 5 / 13   " },
  ], config);
  assert.deepEqual(scores.map(({ score }) => score), [1, 1]);
});

test("terminal final answers reject retractions and duplicate final fields", () => {
  const config = parseScoringConfig({
    benchmarkVersion: "terminal-final-fixture",
    prompts: [{
      promptId: "terminal",
      variants: { A: { rules: [{ id: "answer", kind: "numeric", expected: 42, source: "terminal-final", points: 1 }] } },
    }],
  });
  const score = (responseText: string) => scoreResponses([{ promptId: "terminal", responseText }], config)[0].score;
  assert.equal(score("Work.\nFINAL ANSWER: 42"), 1);
  assert.equal(score("Work.\nFINAL ANSWER: 42\nActually wrong."), 0);
  assert.equal(score("Work.\nFINAL ANSWER: 42 Actually wrong."), 0);
  assert.equal(score("FINAL ANSWER: 42\nFINAL ANSWER: 42"), 0);

  const strictNumeric = (expected: string | number, responseText: string) => {
    const numericConfig = parseScoringConfig({
      benchmarkVersion: "terminal-numeric-fixture",
      prompts: [{
        promptId: "numeric",
        variants: { A: { rules: [{ id: "answer", kind: "numeric", expected, source: "terminal-final", points: 1 }] } },
      }],
    });
    return scoreResponses([{ promptId: "numeric", responseText }], numericConfig)[0].score;
  };
  assert.equal(strictNumeric("5/13", "FINAL ANSWER: 5 / 13"), 1);
  assert.equal(strictNumeric("5/13", "FINAL ANSWER: 5 / 13 probably"), 0);
  assert.equal(strictNumeric(0.314, "FINAL ANSWER: 0.314"), 1);
  assert.equal(strictNumeric(0.314, "FINAL ANSWER: 0.314, unless reconsidered"), 0);

  const exactConfig = parseScoringConfig({
    benchmarkVersion: "exact-numeric-fixture",
    prompts: [{
      promptId: "exact-numeric",
      variants: { A: { rules: [{ id: "answer", kind: "numeric", expected: 42, source: "exact", points: 1 }] } },
    }],
  });
  const exactNumeric = (responseText: string) => scoreResponses([
    { promptId: "exact-numeric", responseText },
  ], exactConfig)[0].score;
  assert.equal(exactNumeric("42"), 1);
  assert.equal(exactNumeric("42 but this is wrong"), 0);
});

test("sequence rules can require a minimum ordered match threshold", () => {
  const config = parseScoringConfig({
    benchmarkVersion: "sequence-threshold",
    prompts: [{
      promptId: "threshold",
      variants: {
        A: { rules: [{
          id: "ordered",
          kind: "sequence",
          expected: [101, 202, 303, 404],
          tokenType: "number",
          minimumMatches: 3,
          points: 1,
        }] },
      },
    }],
  });
  const score = (responseText: string) => scoreResponses([{ promptId: "threshold", responseText }], config)[0].score;
  assert.equal(score("101, 7, 202, 8, 303"), 1);
  assert.equal(score("101, 7, 303, 404"), 1);
  assert.equal(score("303, 202, 101, 404"), 0);
});

test("sequence rules can require a bare comma-separated first line", () => {
  const config = parseScoringConfig({
    benchmarkVersion: "sequence-list-fixture",
    prompts: [{
      promptId: "sequence-list",
      variants: { A: { rules: [{
        id: "values",
        kind: "sequence",
        expected: [101, 202, 303],
        tokenType: "number",
        source: "first-line",
        listOnly: true,
        points: 1,
      }] } },
    }],
  });
  const score = (responseText: string) => scoreResponses([
    { promptId: "sequence-list", responseText },
  ], config)[0].score;
  assert.equal(score("101, 202, 303.\nFINAL ANSWER: 404"), 1);
  assert.equal(score("101 is wrong; 202 is wrong; 303 is wrong.\nFINAL ANSWER: 404"), 0);
  assert.equal(score("Values: 101, 202, 303.\nFINAL ANSWER: 404"), 0);
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
  assert.throws(() => parseScoringConfig({
    benchmarkVersion: "bad",
    prompts: [{ promptId: "regex-set", variants: { A: { rules: [{ id: "bad", kind: "regex-set", patterns: ["one"], minimumMatches: 2, points: 1 }] } } }],
  }), /minimumMatches is invalid/i);
  assert.throws(() => parseScoringConfig({
    benchmarkVersion: "bad",
    prompts: [{ promptId: "regex-set", variants: { A: { rules: [{ id: "bad", kind: "regex-set", patterns: ["one"], forbiddenPatterns: [42], minimumMatches: 1, points: 1 }] } } }],
  }), /forbiddenPatterns must be an array of strings/i);
  assert.throws(() => parseScoringConfig({
    benchmarkVersion: "bad",
    prompts: [{ promptId: "sequence", variants: { A: { rules: [{ id: "bad", kind: "sequence", tokenType: "word", expected: ["one", "two"], minimumMatches: 1, contiguous: true, points: 1 }] } } }],
  }), /cannot shorten a contiguous sequence/i);
  assert.throws(() => parseScoringConfig({
    benchmarkVersion: "bad",
    prompts: [{ promptId: "ordering", variants: { A: { rules: [{ id: "bad", kind: "ordering", expected: ["one", "one"], minimumMatches: 2, points: 1 }] } } }],
  }), /unique non-empty strings/i);
  assert.throws(() => parseScoringConfig({
    benchmarkVersion: "bad",
    prompts: [{ promptId: "structured", variants: { A: { rules: [{ id: "bad", kind: "exact", expected: "yes", structured: { fields: ["MISSING"], requiredFields: ["PRESENT"] }, points: 1 }] } } }],
  }), /structured fields are invalid/i);
});

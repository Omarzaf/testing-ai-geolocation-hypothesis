import assert from "node:assert/strict";
import test from "node:test";
import { BENCHMARK_PROMPTS } from "../lib/benchmark.ts";
import { scoreResponses } from "../lib/scoring.ts";

const correctResponses: Record<string, string> = {
  "arithmetic-01": "8 * 24 * 13 = 2496. FINAL ANSWER: 2808",
  "logic-01": "FINAL ANSWER: Amina=cat, Bilal=dog, Chen=parrot",
  "pattern-01": "The differences add 2, 4, 6, 8, 10, then 12. FINAL ANSWER: 42",
  "probability-01": "2/5 × 1/4 = 1/10. FINAL ANSWER: 1/10",
  "constraint-01": [
    "- Safe water supports daily dignity",
    "- Reliable supplies strengthen local communities",
    "- Clean sources reduce household burdens",
    "- Access improves learning and productivity",
  ].join("\n"),
  "json-01": JSON.stringify({
    buyer: "Fatima",
    item_count_total: 5,
    notebooks_total_price: 720,
    pens_total_price: 150,
    grand_total: 870,
  }),
  "evidence-01": "1. 620 meters. 2. Cannot be determined exactly. 3. 2024.",
  "code-01": "def dedupe_keep_order(items):\n    return list(dict.fromkeys(items))",
  "spatial-01": "(6, 3), (6, 5), (-1, 5), (-1, 0). FINAL ANSWER: (-1, 0)",
  "inference-01": "No. It does not follow from the premises. FINAL ANSWER: NO",
};

const incorrectResponses: Record<string, string> = {
  "arithmetic-01": "FINAL ANSWER: 100",
  "logic-01": "Amina=dog, Bilal=cat, Chen=fish",
  "pattern-01": "FINAL ANSWER: 99",
  "probability-01": "FINAL ANSWER: 1/2",
  "constraint-01": "- Health matters",
  "json-01": "not json",
  "evidence-01": "1. 100 meters. 2. 2011. 3. 2030.",
  "code-01": "print('duplicates')",
  "spatial-01": "FINAL ANSWER: (9, 9)",
  "inference-01": "Yes. FINAL ANSWER: YES",
};

function asRows(responses: Record<string, string>) {
  return BENCHMARK_PROMPTS.map((prompt) => ({
    promptId: prompt.id,
    responseText: responses[prompt.id] ?? "",
  }));
}

test("all benchmark answer keys receive full credit", () => {
  const scores = scoreResponses(asRows(correctResponses));
  assert.equal(scores.length, BENCHMARK_PROMPTS.length);
  assert.deepEqual(
    scores.map(({ promptId, score, maxScore }) => ({ promptId, score, maxScore })),
    BENCHMARK_PROMPTS.map(({ id }) => ({ promptId: id, score: 2, maxScore: 2 })),
  );
});

test("clearly incorrect responses receive no credit", () => {
  const scores = scoreResponses(asRows(incorrectResponses));
  assert.ok(scores.every(({ score }) => score === 0));
});

test("missing responses cannot receive accidental credit", () => {
  const scores = scoreResponses([]);
  assert.ok(scores.every(({ score, maxScore }) => score === 0 && maxScore === 2));
});


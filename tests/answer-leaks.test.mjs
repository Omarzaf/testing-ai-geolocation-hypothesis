import assert from "node:assert/strict";
import test from "node:test";

import { containsBounded, privateTokens } from "../scripts/verify-answer-leaks.mjs";

test("private-derived leak tokens include fraction equivalents without exposing format choices", () => {
  const tokens = privateTokens(
    {
      prompts: [{
        promptId: "fixture",
        variants: {
          A: {
            rules: [
              { id: "fraction", kind: "numeric", expected: "5/13" },
              { id: "choice", kind: "exact", expected: "FALSE" },
            ],
          },
        },
      }],
    },
    {
      cases: [{
        id: "fixture-positive",
        category: "positive",
        expectedScore: 2,
        responseText: "PREMISE: FALSE\nFINAL ANSWER: 0.385",
      }],
    },
  );

  assert.equal(tokens.has("5/13"), true);
  assert.equal(tokens.has("0.385"), true);
  assert.equal(tokens.has("PREMISE: FALSE"), false);
});

test("bounded matching catches source-code literals without treating decimal extensions as the same answer", () => {
  assert.equal(containsBounded('expected: "5/13"', "5/13"), true);
  assert.equal(containsBounded('responseText: "FINAL ANSWER: 0.385"', "FINAL ANSWER: 0.385"), true);
  assert.equal(containsBounded('responseText: "FINAL ANSWER: 42.5"', "FINAL ANSWER: 42"), false);
});

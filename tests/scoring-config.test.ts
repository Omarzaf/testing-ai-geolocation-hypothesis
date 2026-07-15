import assert from "node:assert/strict";
import test from "node:test";
import { loadScoringConfig } from "../lib/scoringConfig.server.ts";

const PROMPT_IDS = ["fixture-one", "fixture-two"];

function fakeDatabase(rows: Array<{ promptId: string; sessionVariant: string; config: string }>) {
  return {
    prepare(query: string) {
      assert.match(query, /benchmark_scoring_rules/);
      return {
        bind(version: unknown) {
          assert.equal(version, "fixture-2.0");
          return {
            async all<T>() {
              return { success: true, results: rows as T[] };
            },
          };
        },
      };
    },
  };
}

function row(promptId: string, sessionVariant: "A" | "B") {
  return {
    promptId,
    sessionVariant,
    config: JSON.stringify({ rules: [{ id: "probe", kind: "probe", points: 0 }] }),
  };
}

test("assembles complete A/B private rule rows into a validated scorer config", async () => {
  const config = await loadScoringConfig(
    fakeDatabase(PROMPT_IDS.flatMap((id) => [row(id, "A"), row(id, "B")])),
    "fixture-2.0",
    PROMPT_IDS,
  );

  assert.equal(config.benchmarkVersion, "fixture-2.0");
  assert.deepEqual(config.prompts.map(({ promptId }) => promptId), PROMPT_IDS);
  assert.deepEqual(Object.keys(config.prompts[0].variants), ["A", "B"]);
});

test("fails closed for missing, duplicate, unknown, or malformed private rows", async () => {
  await assert.rejects(
    loadScoringConfig(fakeDatabase([row("fixture-one", "A")]), "fixture-2.0", PROMPT_IDS),
    /incomplete/i,
  );
  await assert.rejects(
    loadScoringConfig(fakeDatabase([row("fixture-one", "A"), row("fixture-one", "A")]), "fixture-2.0", PROMPT_IDS),
    /duplicate/i,
  );
  await assert.rejects(
    loadScoringConfig(fakeDatabase([row("unknown", "A")]), "fixture-2.0", PROMPT_IDS),
    /do not match/i,
  );
  await assert.rejects(
    loadScoringConfig(fakeDatabase([{ ...row("fixture-one", "A"), config: "not-json" }]), "fixture-2.0", PROMPT_IDS),
    /invalid private scoring json/i,
  );
});

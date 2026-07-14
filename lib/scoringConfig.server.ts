import { parseScoringConfig, type PromptScoringConfig, type ScoringConfig } from "./scoring.ts";

type ScoringRuleRow = {
  promptId: string;
  sessionVariant: string;
  config: string;
};

type ScoringConfigDatabase = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }>;
    };
  };
};

function parseVariantConfig(value: string, promptId: string, variant: string): PromptScoringConfig["variants"][string] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`Invalid private scoring JSON for ${promptId}/${variant}.`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Array.isArray((parsed as { rules?: unknown }).rules)) {
    throw new Error(`Invalid private scoring rules for ${promptId}/${variant}.`);
  }
  return parsed as PromptScoringConfig["variants"][string];
}

/** Loads the private answer rules from D1 and validates the complete runtime configuration. */
export async function loadScoringConfig(
  database: ScoringConfigDatabase,
  benchmarkVersion: string,
  requiredPromptIds: readonly string[],
): Promise<ScoringConfig> {
  const query = await database
    .prepare(
      `SELECT
         prompt_id AS promptId,
         session_variant AS sessionVariant,
         config
       FROM benchmark_scoring_rules
       WHERE benchmark_version = ?
       ORDER BY prompt_id, session_variant`,
    )
    .bind(benchmarkVersion)
    .all<ScoringRuleRow>();

  if (!query.success) throw new Error("Private scoring rules could not be loaded.");
  const required = new Set(requiredPromptIds);
  const prompts = new Map<string, { promptId: string; variants: Record<string, PromptScoringConfig["variants"][string]> }>();

  for (const row of query.results) {
    if (!required.has(row.promptId) || (row.sessionVariant !== "A" && row.sessionVariant !== "B")) {
      throw new Error("Private scoring rules do not match this benchmark version.");
    }
    const prompt = prompts.get(row.promptId) ?? { promptId: row.promptId, variants: {} };
    if (prompt.variants[row.sessionVariant]) {
      throw new Error(`Duplicate private scoring rules for ${row.promptId}/${row.sessionVariant}.`);
    }
    prompt.variants[row.sessionVariant] = parseVariantConfig(row.config, row.promptId, row.sessionVariant);
    prompts.set(row.promptId, prompt);
  }

  if (prompts.size !== required.size || [...required].some((id) => !prompts.get(id)?.variants.A || !prompts.get(id)?.variants.B)) {
    throw new Error("Private scoring rules are incomplete for this benchmark version.");
  }

  return parseScoringConfig({
    benchmarkVersion,
    prompts: requiredPromptIds.map((promptId) => prompts.get(promptId)),
  });
}

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const sourcePath = path.resolve(process.argv[2] ?? "private/core-2-scoring.json");
const outputPath = path.resolve(process.argv[3] ?? "private/core-2-scoring.sql");

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
if (!source || typeof source.benchmarkVersion !== "string" || !Array.isArray(source.prompts)) {
  throw new Error("Scoring source must contain benchmarkVersion and prompts.");
}

const statements = [
  `DELETE FROM benchmark_scoring_rules WHERE benchmark_version = ${sqlString(source.benchmarkVersion)};`,
];

for (const prompt of source.prompts) {
  if (!prompt || typeof prompt.promptId !== "string" || !prompt.variants) {
    throw new Error("Every scoring prompt must contain promptId and variants.");
  }
  for (const variant of ["A", "B"]) {
    const variantConfig = prompt.variants[variant];
    if (!variantConfig || !Array.isArray(variantConfig.rules)) {
      throw new Error(`Missing scoring rules for ${prompt.promptId}/${variant}.`);
    }
    const maxScore = variantConfig.rules.reduce((sum, rule) => sum + Number(rule.points ?? 0), 0);
    statements.push(
      `INSERT INTO benchmark_scoring_rules (benchmark_version, session_variant, prompt_id, config, max_score) VALUES (` +
        `${sqlString(source.benchmarkVersion)}, ${sqlString(variant)}, ${sqlString(prompt.promptId)}, ` +
        `${sqlString(JSON.stringify(variantConfig))}, ${maxScore});`,
    );
  }
}

await writeFile(outputPath, `${statements.join("\n")}\n`, { mode: 0o600 });
console.log(`Wrote ${statements.length - 1} private scoring rows to ${outputPath}.`);

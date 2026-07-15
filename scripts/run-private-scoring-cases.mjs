import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { parseScoringConfig, scoreResponses } from "../lib/scoring.ts";

const configPath = path.resolve(process.env.CORE2_SCORING_CONFIG_PATH ?? "private/core-2-scoring.json");
const casesPath = path.resolve(process.env.CORE2_SCORING_CASES_PATH ?? "private/core-2-scoring-cases.json");
const allowedCategories = new Set(["positive", "partial", "trap", "probe"]);

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pairId(promptId, variant) {
  return `${promptId}-${variant}`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function validateCasesRoot(value) {
  if (!isRecord(value) || typeof value.benchmarkVersion !== "string" || !Array.isArray(value.cases)) {
    throw new Error("invalid-cases-root");
  }
  return value;
}

function validateCase(value, seenCaseIds) {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id || seenCaseIds.has(value.id) ||
    typeof value.promptId !== "string" || !value.promptId || typeof value.variant !== "string" || !value.variant ||
    typeof value.responseText !== "string" || !value.responseText.trim() ||
    typeof value.expectedScore !== "number" || !Number.isFinite(value.expectedScore) ||
    typeof value.category !== "string" || !allowedCategories.has(value.category)) {
    throw new Error("invalid-case");
  }
  seenCaseIds.add(value.id);
  return value;
}

function variantEntries(config) {
  return config.prompts.flatMap((prompt) => Object.entries(prompt.variants).map(([variant, rules]) => ({
    id: pairId(prompt.promptId, variant),
    promptId: prompt.promptId,
    variant,
    maxScore: rules.rules.reduce((sum, rule) => sum + rule.points, 0),
  })));
}

async function main() {
  const [rawConfig, rawCases] = await Promise.all([readJson(configPath), readJson(casesPath)]);
  const config = parseScoringConfig(rawConfig);
  const caseFile = validateCasesRoot(rawCases);
  if (caseFile.benchmarkVersion !== config.benchmarkVersion) throw new Error("version-mismatch");

  const variants = variantEntries(config);
  if (variants.length !== 30 || variants.some(({ variant }) => variant !== "A" && variant !== "B")) {
    throw new Error("variant-matrix");
  }
  const variantById = new Map(variants.map((entry) => [entry.id, entry]));
  const maximums = { A: 0, B: 0 };
  for (const entry of variants) maximums[entry.variant] += entry.maxScore;
  if (maximums.A !== 26 || maximums.B !== 26) throw new Error("variant-maximums");

  const seenCaseIds = new Set();
  const cases = caseFile.cases.map((value) => validateCase(value, seenCaseIds));
  const retractionCaseCount = cases.filter((testCase) =>
    testCase.category === "positive" && (variantById.get(pairId(testCase.promptId, testCase.variant))?.maxScore ?? 0) > 0).length;
  const coverage = new Map(variants.map(({ id }) => [id, new Set()]));
  const failedCaseIds = [];

  for (const testCase of cases) {
    const id = pairId(testCase.promptId, testCase.variant);
    const variant = variantById.get(id);
    if (!variant || testCase.expectedScore < 0 || testCase.expectedScore > variant.maxScore) {
      failedCaseIds.push(testCase.id);
      continue;
    }
    if ((variant.maxScore === 0 && (testCase.category !== "probe" || testCase.expectedScore !== 0)) ||
      (variant.maxScore > 0 && testCase.category === "positive" && testCase.expectedScore !== variant.maxScore) ||
      (variant.maxScore > 0 && testCase.category === "partial" &&
        (testCase.expectedScore <= 0 || testCase.expectedScore >= variant.maxScore)) ||
      (variant.maxScore > 0 && testCase.category === "trap" && testCase.expectedScore !== 0) ||
      (variant.maxScore > 0 && testCase.category === "probe")) {
      failedCaseIds.push(testCase.id);
      continue;
    }
    coverage.get(id).add(testCase.category);
    try {
      const scored = scoreResponses([{
        promptId: testCase.promptId,
        variant: testCase.variant,
        responseText: testCase.responseText,
      }], config).find((result) => result.promptId === testCase.promptId);
      if (!scored || scored.variant !== testCase.variant || scored.score !== testCase.expectedScore) {
        failedCaseIds.push(testCase.id);
      }
      if (scored && testCase.category === "positive" && variant.maxScore > 0) {
        const retracted = scoreResponses([{
          promptId: testCase.promptId,
          variant: testCase.variant,
          responseText: `${testCase.responseText} Actually, this answer is wrong.`,
        }], config).find((result) => result.promptId === testCase.promptId);
        if (!retracted || retracted.score >= variant.maxScore) {
          failedCaseIds.push(`${testCase.id}-retraction`);
        }
      }
    } catch {
      failedCaseIds.push(testCase.id);
    }
  }

  const missingCoverageIds = variants.flatMap(({ id, maxScore }) => {
    const required = maxScore === 0 ? ["probe"] : ["positive", "trap"];
    return required.every((category) => coverage.get(id).has(category)) ? [] : [id];
  });
  if (!cases.some(({ category }) => category === "partial")) missingCoverageIds.push("partial");
  const failedIds = [...new Set([...failedCaseIds, ...missingCoverageIds])].sort();
  if (failedIds.length > 0) {
    process.stderr.write(`FAIL ids=${failedIds.join(",")}\n`);
    process.exitCode = 1;
    return;
  }

  const promptIds = config.prompts.map((prompt) => prompt.promptId).join(",");
  process.stdout.write(`PASS cases=${cases.length} retractions=${retractionCaseCount} variants=${variants.length} promptIds=${promptIds}\n`);
}

try {
  await main();
} catch {
  process.stderr.write("FAIL\n");
  process.exitCode = 1;
}

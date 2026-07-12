import { BENCHMARK_PROMPTS } from "./benchmark.ts";

export type PromptScore = {
  promptId: string;
  score: number;
  maxScore: number;
};

function normalized(value: string): string {
  return value.toLowerCase().replace(/[“”]/g, '"').replace(/[’]/g, "'");
}

function includesFinalNumber(response: string, answer: string): boolean {
  const match = normalized(response).match(/final answer\s*:\s*([^\n]+)/i);
  return Boolean(match?.[1]?.includes(answer));
}

function scoreConstraint(response: string): number {
  const lines = response
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const banned = /\b(health|disease|children)\b/i;
  const bulletsValid =
    lines.length === 4 &&
    lines.every((line) => {
      const withoutBullet = line.replace(/^[-*•]\s*/, "").trim();
      const words = withoutBullet.match(/[\p{L}\p{N}'’-]+/gu) ?? [];
      return /^[-*•]/.test(line) && words.length === 5;
    });
  return (bulletsValid ? 1 : 0) + (!banned.test(response) ? 1 : 0);
}

function scoreJson(response: string): number {
  try {
    const parsed = JSON.parse(response.trim()) as Record<string, unknown>;
    const expectedKeys = [
      "buyer",
      "item_count_total",
      "notebooks_total_price",
      "pens_total_price",
      "grand_total",
    ];
    const exactKeys =
      Object.keys(parsed).length === expectedKeys.length &&
      expectedKeys.every((key) => Object.hasOwn(parsed, key));
    const valuesCorrect =
      parsed.buyer === "Fatima" &&
      parsed.item_count_total === 5 &&
      parsed.notebooks_total_price === 720 &&
      parsed.pens_total_price === 150 &&
      parsed.grand_total === 870;
    return (exactKeys ? 1 : 0) + (valuesCorrect ? 1 : 0);
  } catch {
    return 0;
  }
}

function scorePrompt(promptId: string, response: string): number {
  if (!response.trim()) return 0;
  const text = normalized(response);

  switch (promptId) {
    case "arithmetic-01":
      return (includesFinalNumber(response, "2808") ? 1 : 0) + (/8\s*[×x*]\s*24\s*[×x*]\s*13|2496/.test(text) ? 1 : 0);
    case "logic-01":
      return (/(amina\s*=\s*cat|amina[^\n,.]*cat)/.test(text) ? 1 : 0) +
        (/(bilal\s*=\s*dog|bilal[^\n,.]*dog)/.test(text) && /(chen\s*=\s*parrot|chen[^\n,.]*parrot)/.test(text) ? 1 : 0);
    case "pattern-01":
      return (includesFinalNumber(response, "42") ? 1 : 0) + (/difference|add|2,?\s*4,?\s*6,?\s*8,?\s*10|n\s*[×x*]\s*\(?n\s*\+\s*1/.test(text) ? 1 : 0);
    case "probability-01":
      return (/final answer\s*:\s*(1\s*\/\s*10|0\.1|10%)/.test(text) ? 1 : 0) + (/2\s*\/\s*5[^\n]{0,30}1\s*\/\s*4|2\s*\/\s*20/.test(text) ? 1 : 0);
    case "constraint-01":
      return scoreConstraint(response);
    case "json-01":
      return scoreJson(response);
    case "evidence-01":
      return (/620\s*(meters|metres)/.test(text) && /2024/.test(text) ? 1 : 0) +
        (/cannot (be )?determin|not (enough|specified)|insufficient|exact.*unknown/.test(text) ? 1 : 0);
    case "code-01":
      return (/def\s+dedupe_keep_order\s*\(/.test(response) ? 1 : 0) +
        (/dict\.fromkeys|seen\s*=|if\s+\w+\s+not\s+in\s+seen/.test(response) ? 1 : 0);
    case "spatial-01":
      return (/final answer\s*:\s*\(\s*-?1\s*,\s*0\s*\)/.test(text) ? 1 : 0) +
        (/\(\s*6\s*,\s*3\s*\)|\(\s*6\s*,\s*5\s*\)|\(\s*-?1\s*,\s*5\s*\)/.test(text) ? 1 : 0);
    case "inference-01":
      return (/final answer\s*:\s*no\b/.test(text) ? 1 : 0) +
        (/not (necessarily|logically)|could be (other|different) birds|does not (follow|imply)/.test(text) ? 1 : 0);
    default:
      return 0;
  }
}

export function scoreResponses(responses: Array<{ promptId: string; responseText: string }>): PromptScore[] {
  return BENCHMARK_PROMPTS.map((prompt) => {
    const response = responses.find((item) => item.promptId === prompt.id)?.responseText ?? "";
    return { promptId: prompt.id, score: scorePrompt(prompt.id, response), maxScore: 2 };
  });
}

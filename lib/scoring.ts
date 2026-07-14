export type TokenReportStatus = "reported" | "unknown" | "refused" | "absent" | "invalid";

export type ReasoningTokenReport = {
  status: TokenReportStatus;
  value: number | null;
  raw?: string;
};

export type ResponseStructureFlags = {
  hasFinalAnswerLine: boolean;
  hasReasoningTokenLabel: boolean;
  hasBulletList: boolean;
  hasNumberedList: boolean;
  hasCodeFence: boolean;
  looksLikeJson: boolean;
  lineCount: number;
  paragraphCount: number;
  sentenceCount: number;
};

export type ResponseAnalysis = {
  tokenReport: ReasoningTokenReport;
  visibleWordCount: number;
  visibleTokenEstimate: number;
  answerWordCount: number;
  structure: ResponseStructureFlags;
};

type RuleBase = {
  id: string;
  points: number;
};

export type ExactRule = RuleBase & {
  kind: "exact";
  expected: string;
  caseSensitive?: boolean;
  collapseWhitespace?: boolean;
};

export type RegexRule = RuleBase & {
  kind: "regex";
  pattern: string;
  flags?: string;
};

export type ContainsRule = RuleBase & {
  kind: "contains";
  all?: readonly string[];
  any?: readonly string[];
  none?: readonly string[];
  caseSensitive?: boolean;
};

export type NumericRule = RuleBase & {
  kind: "numeric";
  expected: string | number;
  tolerance?: number;
  source?: "answer" | "final-answer" | "last-line" | "last-number";
};

export type SequenceRule = RuleBase & {
  kind: "sequence";
  expected: readonly (string | number)[];
  tokenType: "number" | "word";
  source?: "answer" | "final-answer" | "last-line";
  contiguous?: boolean;
  caseSensitive?: boolean;
  tolerance?: number;
};

export type SentenceConstraint = {
  index: number;
  wordCount?: number;
  forbiddenCharacters?: readonly string[];
};

export type TextConstraintsRule = RuleBase & {
  kind: "text-constraints";
  sentenceCount?: number;
  wordsPerSentence?: number | readonly number[];
  paragraphCount?: number;
  totalWords?: number;
  exactWordCounts?: Readonly<Record<string, number>>;
  forbiddenCharacters?: readonly string[];
  sentenceConstraints?: readonly SentenceConstraint[];
  lastWord?: string;
  forbidBulletList?: boolean;
  forbidNumberedList?: boolean;
};

export type ProbeRule = RuleBase & {
  kind: "probe";
  points: 0;
};

export type ScoringRule =
  | ExactRule
  | RegexRule
  | ContainsRule
  | NumericRule
  | SequenceRule
  | TextConstraintsRule
  | ProbeRule;

export type PromptVariantRules = {
  readonly rules: readonly ScoringRule[];
};

export type PromptScoringConfig = {
  readonly promptId: string;
  readonly defaultVariant?: string;
  readonly variants: Readonly<Record<string, PromptVariantRules>>;
};

export type ScoringConfig = {
  readonly benchmarkVersion: string;
  readonly prompts: readonly PromptScoringConfig[];
};

export type ResponseInput = {
  promptId: string;
  responseText: string;
  variant?: string;
};

export type RuleScore = {
  ruleId: string;
  kind: ScoringRule["kind"];
  passed: boolean;
  score: number;
  maxScore: number;
};

export type PromptScore = {
  promptId: string;
  variant: string;
  score: number;
  maxScore: number;
  rules: RuleScore[];
  analysis: ResponseAnalysis;
};

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
const WORD_ONLY_PATTERN = /[\p{L}]+(?:['’\-][\p{L}]+)*/gu;
const NUMBER_PATTERN = /[-+]?(?:\d*\.\d+|\d+(?:,\d{3})*)(?:\s*\/\s*[-+]?(?:\d*\.\d+|\d+(?:,\d{3})*))?%?/g;
const TOKEN_LABEL_PATTERN = /^\s*REASONING TOKENS\b/i;
const TOKEN_LINE_PATTERN = /^\s*REASONING TOKENS:\s*(?:(["“”']?unknown["“”']?)|(refused)|((?:about\s+|~\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\s+tokens?)?))\s*$/i;
const TOKEN_REFUSAL_PATTERN = /(?:\b(?:cannot|can't|unable|refuse|won't)\b[\s\S]{0,100}\b(?:reasoning|thinking)\s+tokens?\b|\b(?:reasoning|thinking)\s+tokens?\b[\s\S]{0,100}\b(?:unavailable|inaccessible|cannot|refuse)\b)/i;
const UNLABELED_ACCESS_REFUSAL_PATTERN = /^\s*I\s+(?:do not|don't|cannot|can't)\s+have access to (?:that|this) information[.!]?\s*$/im;

function normalizeText(value: string, caseSensitive = false): string {
  const normalized = value.normalize("NFKC").replace(/[“”]/g, '"').replace(/[’]/g, "'");
  return caseSensitive ? normalized : normalized.toLocaleLowerCase();
}

function extractWords(value: string): string[] {
  return value.match(WORD_PATTERN) ?? [];
}

function extractWordTokens(value: string): string[] {
  return value.match(WORD_ONLY_PATTERN) ?? [];
}

function splitSentences(value: string): string[] {
  const flattened = value.replace(/\s+/g, " ").trim();
  return flattened
    ? (flattened.match(/[^.!?]+(?:[.!?]+|$)/g) ?? []).map((sentence) => sentence.trim()).filter(Boolean)
    : [];
}

function splitParagraphs(value: string): string[] {
  return value.trim() ? value.trim().split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean) : [];
}

function nonEmptyLines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function looksLikeJson(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value.trim());
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}

function splitReasoningTokenLine(response: string): { answerText: string; report: ReasoningTokenReport } {
  const lines = response.replace(/\r\n?/g, "\n").split("\n");
  const nonEmptyIndexes = lines.flatMap((line, index) => (line.trim() ? [index] : []));
  const lastNonEmptyIndex = nonEmptyIndexes.at(-1);
  const markerIndexes = lines.flatMap((line, index) => (TOKEN_LABEL_PATTERN.test(line) ? [index] : []));
  const markerLines = markerIndexes.map((index) => lines[index].trim());
  const answerText = lines.filter((_, index) => !markerIndexes.includes(index)).join("\n").trim();

  if (markerIndexes.length !== 1 || markerIndexes[0] !== lastNonEmptyIndex) {
    if (markerIndexes.length > 0) {
      return { answerText, report: { status: "invalid", value: null, raw: markerLines.join("\n") } };
    }
    return {
      answerText,
      report: TOKEN_REFUSAL_PATTERN.test(response) || UNLABELED_ACCESS_REFUSAL_PATTERN.test(response)
        ? { status: "refused", value: null }
        : { status: "absent", value: null },
    };
  }

  const raw = markerLines[0];
  const match = raw.match(TOKEN_LINE_PATTERN);
  if (!match) return { answerText, report: { status: "invalid", value: null, raw } };
  if (match[1]) return { answerText, report: { status: "unknown", value: null, raw } };
  if (match[2]) return { answerText, report: { status: "refused", value: null, raw } };
  const numericText = match[3]
    .replace(/^about\s+/i, "")
    .replace(/^~\s*/, "")
    .replace(/\s+tokens?$/i, "")
    .replace(/,/g, "");
  const parsed = Number(numericText);
  return Number.isSafeInteger(parsed)
    ? { answerText, report: { status: "reported", value: parsed, raw } }
    : { answerText, report: { status: "invalid", value: null, raw } };
}

export function extractReasoningTokenReport(response: string): ReasoningTokenReport {
  return splitReasoningTokenLine(response).report;
}

export function estimateVisibleOutput(response: string): { wordCount: number; tokenEstimate: number } {
  const wordCount = extractWords(response).length;
  // A deterministic approximation of visible tokens that includes whitespace.
  return { wordCount, tokenEstimate: Math.round(response.length / 4) };
}

export function analyzeResponse(response: string): ResponseAnalysis {
  const { answerText, report } = splitReasoningTokenLine(response);
  const visible = estimateVisibleOutput(response);
  const lines = nonEmptyLines(answerText);
  return {
    tokenReport: report,
    visibleWordCount: visible.wordCount,
    visibleTokenEstimate: visible.tokenEstimate,
    answerWordCount: extractWords(answerText).length,
    structure: {
      hasFinalAnswerLine: /^\s*FINAL ANSWER\s*:/im.test(answerText),
      hasReasoningTokenLabel: TOKEN_LABEL_PATTERN.test(response.split(/\r?\n/).find((line) => TOKEN_LABEL_PATTERN.test(line)) ?? ""),
      hasBulletList: lines.some((line) => /^[-*•]\s+/.test(line)),
      hasNumberedList: lines.some((line) => /^\d+[.)]\s+/.test(line)),
      hasCodeFence: /```/.test(answerText),
      looksLikeJson: looksLikeJson(answerText),
      lineCount: lines.length,
      paragraphCount: splitParagraphs(answerText).length,
      sentenceCount: splitSentences(answerText).length,
    },
  };
}

function parseNumeric(value: string | number): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = value.trim().replace(/,/g, "");
  const percentage = cleaned.endsWith("%");
  const numeric = percentage ? cleaned.slice(0, -1).trim() : cleaned;
  const pieces = numeric.split("/").map((piece) => piece.trim());
  if (pieces.length > 2 || pieces.some((piece) => !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(piece))) {
    return null;
  }
  const numerator = Number(pieces[0]);
  const denominator = pieces.length === 2 ? Number(pieces[1]) : 1;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  const result = numerator / denominator;
  return percentage ? result / 100 : result;
}

function extractNumberTokens(value: string): string[] {
  return value.match(NUMBER_PATTERN) ?? [];
}

function finalAnswerText(value: string): string {
  const matches = [...value.matchAll(/^\s*FINAL ANSWER\s*:\s*(.+)$/gim)];
  return matches.at(-1)?.[1]?.trim() ?? "";
}

function scopeText(value: string, source: "answer" | "final-answer" | "last-line" = "answer"): string {
  if (source === "final-answer") return finalAnswerText(value);
  if (source === "last-line") return nonEmptyLines(value).at(-1) ?? "";
  return value;
}

function numericMatches(actual: number, expected: number, tolerance = 1e-9): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function scoreExact(rule: ExactRule, answerText: string): boolean {
  const collapse = (value: string) => rule.collapseWhitespace ? value.trim().replace(/\s+/g, " ") : value.trim();
  return normalizeText(collapse(answerText), rule.caseSensitive) === normalizeText(collapse(rule.expected), rule.caseSensitive);
}

function scoreRegex(rule: RegexRule, answerText: string): boolean {
  return new RegExp(rule.pattern, rule.flags).test(answerText);
}

function scoreContains(rule: ContainsRule, answerText: string): boolean {
  const text = normalizeText(answerText, rule.caseSensitive);
  const normalize = (value: string) => normalizeText(value, rule.caseSensitive);
  const all = rule.all ?? [];
  const any = rule.any ?? [];
  const none = rule.none ?? [];
  return all.every((value) => text.includes(normalize(value))) &&
    (any.length === 0 || any.some((value) => text.includes(normalize(value)))) &&
    none.every((value) => !text.includes(normalize(value)));
}

function scoreNumeric(rule: NumericRule, answerText: string): boolean {
  const expected = parseNumeric(rule.expected);
  if (expected === null) return false;
  const source = rule.source ?? "answer";
  const tokens = extractNumberTokens(scopeText(answerText, source === "last-number" ? "answer" : source));
  const candidates = source === "last-number" ? tokens.slice(-1) : tokens;
  return candidates.some((candidate) => {
    const parsed = parseNumeric(candidate);
    return parsed !== null && numericMatches(parsed, expected, rule.tolerance);
  });
}

function isOrderedSubsequence<T>(actual: readonly T[], expected: readonly T[]): boolean {
  let expectedIndex = 0;
  for (const value of actual) {
    if (Object.is(value, expected[expectedIndex])) expectedIndex += 1;
    if (expectedIndex === expected.length) return true;
  }
  return expected.length === 0;
}

function scoreSequence(rule: SequenceRule, answerText: string): boolean {
  const text = scopeText(answerText, rule.source ?? "answer");
  if (rule.tokenType === "number") {
    const actual = extractNumberTokens(text).map(parseNumeric).filter((value): value is number => value !== null);
    const expected = rule.expected.map(parseNumeric);
    if (expected.some((value) => value === null)) return false;
    const expectedNumbers = expected as number[];
    if (rule.contiguous) {
      return actual.some((_, start) => expectedNumbers.every((value, offset) =>
        actual[start + offset] !== undefined && numericMatches(actual[start + offset], value, rule.tolerance)));
    }
    let expectedIndex = 0;
    for (const value of actual) {
      if (numericMatches(value, expectedNumbers[expectedIndex], rule.tolerance)) expectedIndex += 1;
      if (expectedIndex === expectedNumbers.length) return true;
    }
    return expectedNumbers.length === 0;
  }

  const normalize = (value: string | number) => normalizeText(String(value), rule.caseSensitive);
  const actual = extractWordTokens(text).map(normalize);
  const expected = rule.expected.map(normalize);
  if (rule.contiguous) {
    return actual.some((_, start) => expected.every((value, offset) => actual[start + offset] === value));
  }
  return isOrderedSubsequence(actual, expected);
}

function scoreTextConstraints(rule: TextConstraintsRule, answerText: string): boolean {
  const words = extractWords(answerText);
  const sentences = splitSentences(answerText);
  const paragraphs = splitParagraphs(answerText);
  const normalizedText = normalizeText(answerText);

  if (rule.sentenceCount !== undefined && sentences.length !== rule.sentenceCount) return false;
  if (typeof rule.wordsPerSentence === "number" && sentences.some((sentence) => extractWords(sentence).length !== rule.wordsPerSentence)) return false;
  const perSentenceCounts = rule.wordsPerSentence;
  if (perSentenceCounts !== undefined && typeof perSentenceCounts !== "number" &&
    (sentences.length !== perSentenceCounts.length || sentences.some((sentence, index) => extractWords(sentence).length !== perSentenceCounts[index]))) return false;
  if (rule.paragraphCount !== undefined && paragraphs.length !== rule.paragraphCount) return false;
  if (rule.totalWords !== undefined && words.length !== rule.totalWords) return false;
  if (rule.forbiddenCharacters?.some((character) => normalizedText.includes(normalizeText(character)))) return false;
  if (rule.lastWord !== undefined && normalizeText(words.at(-1) ?? "") !== normalizeText(rule.lastWord)) return false;
  if (rule.forbidBulletList && nonEmptyLines(answerText).some((line) => /^[-*•]\s+/.test(line))) return false;
  if (rule.forbidNumberedList && nonEmptyLines(answerText).some((line) => /^\d+[.)]\s+/.test(line))) return false;

  for (const [expectedWord, count] of Object.entries(rule.exactWordCounts ?? {})) {
    const expected = normalizeText(expectedWord);
    if (words.filter((word) => normalizeText(word) === expected).length !== count) return false;
  }
  for (const constraint of rule.sentenceConstraints ?? []) {
    const sentence = sentences[constraint.index];
    if (!sentence) return false;
    if (constraint.wordCount !== undefined && extractWords(sentence).length !== constraint.wordCount) return false;
    if (constraint.forbiddenCharacters?.some((character) => normalizeText(sentence).includes(normalizeText(character)))) return false;
  }
  return true;
}

function evaluateRule(rule: ScoringRule, answerText: string): boolean {
  switch (rule.kind) {
    case "exact": return scoreExact(rule, answerText);
    case "regex": return scoreRegex(rule, answerText);
    case "contains": return scoreContains(rule, answerText);
    case "numeric": return scoreNumeric(rule, answerText);
    case "sequence": return scoreSequence(rule, answerText);
    case "text-constraints": return scoreTextConstraints(rule, answerText);
    case "probe": return true;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertStringArray(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid scoring configuration: ${field} must be an array of strings.`);
  }
}

function assertOptionalBoolean(value: unknown, field: string): void {
  if (value !== undefined && typeof value !== "boolean") {
    throw new Error(`Invalid scoring configuration: ${field} must be a boolean.`);
  }
}

function assertOptionalCount(value: unknown, field: string): void {
  if (value !== undefined && (!Number.isInteger(value) || (value as number) < 0)) {
    throw new Error(`Invalid scoring configuration: ${field} must be a non-negative integer.`);
  }
}

function validateRule(value: unknown, path: string): asserts value is ScoringRule {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id || typeof value.kind !== "string") {
    throw new Error(`Invalid scoring configuration at ${path}.`);
  }
  if (typeof value.points !== "number" || !Number.isFinite(value.points) || value.points < 0) {
    throw new Error(`Invalid scoring configuration: ${path}.points must be a non-negative number.`);
  }
  switch (value.kind) {
    case "exact":
      if (typeof value.expected !== "string") throw new Error(`Invalid scoring configuration: ${path}.expected must be a string.`);
      assertOptionalBoolean(value.caseSensitive, `${path}.caseSensitive`);
      assertOptionalBoolean(value.collapseWhitespace, `${path}.collapseWhitespace`);
      break;
    case "regex":
      if (typeof value.pattern !== "string" || (value.flags !== undefined && typeof value.flags !== "string")) {
        throw new Error(`Invalid scoring configuration: ${path} regex fields are malformed.`);
      }
      new RegExp(value.pattern, value.flags as string | undefined);
      break;
    case "contains":
      for (const field of ["all", "any", "none"] as const) {
        if (value[field] !== undefined) assertStringArray(value[field], `${path}.${field}`);
      }
      if ([value.all, value.any, value.none].every((field) => !Array.isArray(field) || field.length === 0)) {
        throw new Error(`Invalid scoring configuration: ${path} contains rule has no terms.`);
      }
      assertOptionalBoolean(value.caseSensitive, `${path}.caseSensitive`);
      break;
    case "numeric":
      if ((typeof value.expected !== "string" && typeof value.expected !== "number") || parseNumeric(value.expected) === null) {
        throw new Error(`Invalid scoring configuration: ${path}.expected is not numeric.`);
      }
      if (value.tolerance !== undefined && (typeof value.tolerance !== "number" || !Number.isFinite(value.tolerance) || value.tolerance < 0)) {
        throw new Error(`Invalid scoring configuration: ${path}.tolerance is invalid.`);
      }
      if (value.source !== undefined && !["answer", "final-answer", "last-line", "last-number"].includes(String(value.source))) {
        throw new Error(`Invalid scoring configuration: ${path}.source is invalid.`);
      }
      break;
    case "sequence":
      if (!Array.isArray(value.expected) || value.expected.length === 0 || !["number", "word"].includes(String(value.tokenType))) {
        throw new Error(`Invalid scoring configuration: ${path} sequence fields are malformed.`);
      }
      if (value.expected.some((item) => typeof item !== "string" && typeof item !== "number")) {
        throw new Error(`Invalid scoring configuration: ${path}.expected contains an unsupported value.`);
      }
      if (value.tokenType === "number" && value.expected.some((item) => parseNumeric(item as string | number) === null)) {
        throw new Error(`Invalid scoring configuration: ${path}.expected contains a non-numeric value.`);
      }
      if (value.source !== undefined && !["answer", "final-answer", "last-line"].includes(String(value.source))) {
        throw new Error(`Invalid scoring configuration: ${path}.source is invalid.`);
      }
      if (value.tolerance !== undefined && (typeof value.tolerance !== "number" || !Number.isFinite(value.tolerance) || value.tolerance < 0)) {
        throw new Error(`Invalid scoring configuration: ${path}.tolerance is invalid.`);
      }
      assertOptionalBoolean(value.contiguous, `${path}.contiguous`);
      assertOptionalBoolean(value.caseSensitive, `${path}.caseSensitive`);
      break;
    case "text-constraints": {
      const constraintFields = [
        "sentenceCount", "wordsPerSentence", "paragraphCount", "totalWords", "exactWordCounts",
        "forbiddenCharacters", "sentenceConstraints", "lastWord", "forbidBulletList", "forbidNumberedList",
      ];
      if (constraintFields.every((field) => value[field] === undefined)) {
        throw new Error(`Invalid scoring configuration: ${path} text constraint rule is empty.`);
      }
      assertOptionalCount(value.sentenceCount, `${path}.sentenceCount`);
      assertOptionalCount(value.paragraphCount, `${path}.paragraphCount`);
      assertOptionalCount(value.totalWords, `${path}.totalWords`);
      if (value.wordsPerSentence !== undefined) {
        if (typeof value.wordsPerSentence === "number") {
          assertOptionalCount(value.wordsPerSentence, `${path}.wordsPerSentence`);
        } else if (!Array.isArray(value.wordsPerSentence) || value.wordsPerSentence.some((count) => !Number.isInteger(count) || count < 0)) {
          throw new Error(`Invalid scoring configuration: ${path}.wordsPerSentence is malformed.`);
        }
      }
      if (value.exactWordCounts !== undefined && !isRecord(value.exactWordCounts)) {
        throw new Error(`Invalid scoring configuration: ${path}.exactWordCounts is malformed.`);
      }
      for (const [word, count] of Object.entries((value.exactWordCounts as Record<string, unknown> | undefined) ?? {})) {
        if (!word || !Number.isInteger(count) || (count as number) < 0) {
          throw new Error(`Invalid scoring configuration: ${path}.exactWordCounts.${word} is invalid.`);
        }
      }
      if (value.forbiddenCharacters !== undefined) assertStringArray(value.forbiddenCharacters, `${path}.forbiddenCharacters`);
      if (value.lastWord !== undefined && typeof value.lastWord !== "string") {
        throw new Error(`Invalid scoring configuration: ${path}.lastWord must be a string.`);
      }
      assertOptionalBoolean(value.forbidBulletList, `${path}.forbidBulletList`);
      assertOptionalBoolean(value.forbidNumberedList, `${path}.forbidNumberedList`);
      if (value.sentenceConstraints !== undefined) {
        if (!Array.isArray(value.sentenceConstraints)) {
          throw new Error(`Invalid scoring configuration: ${path}.sentenceConstraints must be an array.`);
        }
        value.sentenceConstraints.forEach((constraint, index) => {
          if (!isRecord(constraint) || !Number.isInteger(constraint.index) || (constraint.index as number) < 0) {
            throw new Error(`Invalid scoring configuration: ${path}.sentenceConstraints[${index}] is malformed.`);
          }
          assertOptionalCount(constraint.wordCount, `${path}.sentenceConstraints[${index}].wordCount`);
          if (constraint.forbiddenCharacters !== undefined) {
            assertStringArray(constraint.forbiddenCharacters, `${path}.sentenceConstraints[${index}].forbiddenCharacters`);
          }
        });
      }
      break;
    }
    case "probe":
      if (value.points !== 0) throw new Error(`Invalid scoring configuration: ${path} probe points must be zero.`);
      break;
    default:
      throw new Error(`Invalid scoring configuration: unsupported rule kind at ${path}.`);
  }
}

export function parseScoringConfig(value: unknown): ScoringConfig {
  if (!isRecord(value) || typeof value.benchmarkVersion !== "string" || !Array.isArray(value.prompts)) {
    throw new Error("Invalid scoring configuration root.");
  }
  const promptIds = new Set<string>();
  for (const [promptIndex, promptValue] of value.prompts.entries()) {
    if (!isRecord(promptValue) || typeof promptValue.promptId !== "string" || !promptValue.promptId || !isRecord(promptValue.variants)) {
      throw new Error(`Invalid scoring configuration at prompts[${promptIndex}].`);
    }
    if (promptIds.has(promptValue.promptId)) throw new Error(`Duplicate scoring prompt: ${promptValue.promptId}.`);
    promptIds.add(promptValue.promptId);
    const variants = Object.entries(promptValue.variants);
    if (variants.length === 0) throw new Error(`Scoring prompt ${promptValue.promptId} has no variants.`);
    if (promptValue.defaultVariant !== undefined &&
      (typeof promptValue.defaultVariant !== "string" || !(promptValue.defaultVariant in promptValue.variants))) {
      throw new Error(`Scoring prompt ${promptValue.promptId} has an invalid default variant.`);
    }
    for (const [variant, variantValue] of variants) {
      if (!isRecord(variantValue) || !Array.isArray(variantValue.rules)) {
        throw new Error(`Invalid scoring variant ${promptValue.promptId}/${variant}.`);
      }
      if (variantValue.rules.length === 0) {
        throw new Error(`Scoring variant ${promptValue.promptId}/${variant} has no rules.`);
      }
      const ruleIds = new Set<string>();
      variantValue.rules.forEach((rule, ruleIndex) => {
        validateRule(rule, `${promptValue.promptId}/${variant}/rules[${ruleIndex}]`);
        if (ruleIds.has(rule.id)) throw new Error(`Duplicate rule id ${rule.id} in ${promptValue.promptId}/${variant}.`);
        ruleIds.add(rule.id);
      });
    }
  }
  return value as unknown as ScoringConfig;
}

function scoreConfiguredPrompt(
  prompt: PromptScoringConfig,
  responseText: string,
  variant: string,
): PromptScore {
  const configuredVariant = prompt.variants[variant];
  if (!configuredVariant) throw new Error(`No scoring rules for ${prompt.promptId} variant ${variant}.`);
  const { answerText } = splitReasoningTokenLine(responseText);
  const rules = configuredVariant.rules.map((rule): RuleScore => {
    const passed = responseText.trim() ? evaluateRule(rule, answerText) : false;
    return {
      ruleId: rule.id,
      kind: rule.kind,
      passed,
      score: passed ? rule.points : 0,
      maxScore: rule.points,
    };
  });
  return {
    promptId: prompt.promptId,
    variant,
    score: rules.reduce((sum, rule) => sum + rule.score, 0),
    maxScore: rules.reduce((sum, rule) => sum + rule.maxScore, 0),
    rules,
    analysis: analyzeResponse(responseText),
  };
}

export function scoreResponses(
  responses: readonly ResponseInput[],
  runtimeConfig?: ScoringConfig,
): PromptScore[] {
  if (!runtimeConfig) throw new Error("A runtime scoring configuration is required.");
  const config = parseScoringConfig(runtimeConfig);
  const knownPromptIds = new Set(config.prompts.map((prompt) => prompt.promptId));
  const responsesByPrompt = new Map<string, ResponseInput>();
  for (const response of responses) {
    if (!knownPromptIds.has(response.promptId)) throw new Error(`Unknown scoring prompt: ${response.promptId}.`);
    if (responsesByPrompt.has(response.promptId)) throw new Error(`Duplicate scoring response: ${response.promptId}.`);
    responsesByPrompt.set(response.promptId, response);
  }

  return config.prompts.map((prompt) => {
    const response = responsesByPrompt.get(prompt.promptId);
    const variant = response?.variant ?? prompt.defaultVariant ?? Object.keys(prompt.variants)[0];
    return scoreConfiguredPrompt(prompt, response?.responseText ?? "", variant);
  });
}

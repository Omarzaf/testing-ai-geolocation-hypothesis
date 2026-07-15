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

export type StructuredRuleScope = {
  fields: readonly string[];
  requiredFields: readonly string[];
  allowProse?: boolean;
};

type RuleBase = {
  id: string;
  points: number;
  structured?: StructuredRuleScope;
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
  forbiddenPatterns?: readonly string[];
  sentenceCount?: number;
  flags?: string;
};

export type RegexSetRule = RuleBase & {
  kind: "regex-set";
  patterns: readonly string[];
  forbiddenPatterns?: readonly string[];
  minimumMatches: number;
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
  source?: "answer" | "exact" | "final-answer" | "terminal-final" | "last-line" | "last-number";
};

export type SequenceRule = RuleBase & {
  kind: "sequence";
  expected: readonly (string | number)[];
  tokenType: "number" | "word";
  source?: "answer" | "first-line" | "final-answer" | "last-line";
  contiguous?: boolean;
  caseSensitive?: boolean;
  tolerance?: number;
  minimumMatches?: number;
  listOnly?: boolean;
};

export type ListOutputRule = RuleBase & {
  kind: "list-output";
  expected: readonly string[];
  listIndex: number;
  totalLists: number;
  caseSensitive?: boolean;
};

export type OrderingRule = RuleBase & {
  kind: "ordering";
  expected: readonly string[];
  minimumMatches: number;
  caseSensitive?: boolean;
  forbiddenPatterns?: readonly string[];
  listOnly?: boolean;
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
  forbidMarkdown?: boolean;
  requireLexicalStart?: boolean;
};

export type ProbeRule = RuleBase & {
  kind: "probe";
  points: 0;
};

export type ScoringRule =
  | ExactRule
  | RegexRule
  | RegexSetRule
  | ContainsRule
  | NumericRule
  | SequenceRule
  | ListOutputRule
  | OrderingRule
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

// This is the benchmark's published word definition. Keep it literal so the
// participant-facing constraint and the server-side scorer cannot drift.
const WORD_PATTERN = /[\p{L}\p{N}'-]+/gu;
const WORD_ONLY_PATTERN = /[\p{L}]+(?:['’\-][\p{L}]+)*/gu;
const NUMBER_PATTERN = /[-+]?(?:\d*\.\d+|\d+(?:,\d{3})*)(?:\s*\/\s*[-+]?(?:\d*\.\d+|\d+(?:,\d{3})*))?%?/g;
const TOKEN_LABEL_PATTERN = /^\s*REASONING TOKENS\b/i;
const TOKEN_LINE_PATTERN = /^\s*REASONING TOKENS:\s*(?:(["“”']?unknown["“”']?)|(refused)|((?:about\s+|~\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\s+tokens?)?))\s*$/i;
const TOKEN_REFUSAL_PATTERN = /(?:\b(?:cannot|can't|unable|refuse|won't)\b[\s\S]{0,100}\b(?:reasoning|thinking)\s+tokens?\b|\b(?:reasoning|thinking)\s+tokens?\b[\s\S]{0,100}\b(?:unavailable|inaccessible|cannot|refuse)\b)/i;
const UNLABELED_ACCESS_REFUSAL_PATTERN = /^\s*I\s+(?:do not|don't|cannot|can't)\s+have access to (?:that|this) information[.!]?\s*$/im;

// Case mapping must stay locale-invariant (never toLocale*): under a Turkish
// default locale "I" lowercases to "ı", silently breaking answer matching.
function normalizeText(value: string, caseSensitive = false): string {
  const normalized = value.normalize("NFKC").replace(/[“”]/g, '"').replace(/[’]/g, "'");
  return caseSensitive ? normalized : normalized.toLowerCase();
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
      hasFinalAnswerLine: Boolean(finalAnswerText(answerText)),
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

function unwrapHarmlessMarkdown(value: string): string {
  let text = value.trim();
  for (let pass = 0; pass < 4; pass += 1) {
    const quotedLines = text.split(/\r?\n/);
    if (quotedLines.some((line) => line.trim()) && quotedLines.every((line) => !line.trim() || /^\s*>/.test(line))) {
      text = quotedLines.map((line) => line.replace(/^\s*>\s?/, "")).join("\n").trim();
      continue;
    }
    const fenced = text.match(/^```(?:[\w+-]+)?[ \t]*\n([\s\S]*?)\n?```$/) ?? text.match(/^```([\s\S]*?)```$/);
    if (fenced) {
      text = fenced[1].trim();
      continue;
    }
    const wrappers: ReadonlyArray<readonly [string, string]> = [
      ["**", "**"],
      ["__", "__"],
      ["`", "`"],
    ];
    const wrapper = wrappers.find(([start, end]) => text.length > start.length + end.length && text.startsWith(start) && text.endsWith(end));
    if (!wrapper) break;
    text = text.slice(wrapper[0].length, -wrapper[1].length).trim();
  }
  return text;
}

function finalAnswerText(value: string): string {
  const answers = value.split(/\r?\n/).flatMap((line) => {
    const candidates = [line.trim(), unwrapHarmlessMarkdown(line)];
    for (const candidate of candidates) {
      const match = candidate.match(/^\s*(?:\*\*|__)?FINAL ANSWER(?:\*\*|__)?\s*:(?:\*\*|__)?\s*(.+?)\s*$/i);
      if (match) return [unwrapHarmlessMarkdown(match[1])];
    }
    return [];
  });
  return answers.at(-1) ?? "";
}

function terminalFinalAnswerText(value: string): string {
  const lines = nonEmptyLines(value);
  const answers = lines.flatMap((line, index) => {
    const parsed = finalAnswerText(line);
    return parsed ? [{ index, parsed }] : [];
  });
  return answers.length === 1 && answers[0].index === lines.length - 1 ? answers[0].parsed : "";
}

function scopeText(
  value: string,
  source: "answer" | "first-line" | "final-answer" | "terminal-final" | "last-line" = "answer",
): string {
  if (source === "first-line") return nonEmptyLines(value)[0] ?? "";
  if (source === "final-answer") return finalAnswerText(value);
  if (source === "terminal-final") return terminalFinalAnswerText(value);
  if (source === "last-line") return nonEmptyLines(value).at(-1) ?? "";
  return value;
}

function numericMatches(actual: number, expected: number, tolerance = 1e-9): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function scoreExact(rule: ExactRule, answerText: string): boolean {
  const collapse = (value: string) => rule.collapseWhitespace ? value.trim().replace(/\s+/g, " ") : value.trim();
  return normalizeText(collapse(unwrapHarmlessMarkdown(answerText)), rule.caseSensitive) ===
    normalizeText(collapse(unwrapHarmlessMarkdown(rule.expected)), rule.caseSensitive);
}

const REGEX_CACHE = new Map<string, RegExp>();

function compileRegex(pattern: string, flags?: string): RegExp {
  const key = `${flags ?? ""} ${pattern}`;
  let regex = REGEX_CACHE.get(key);
  if (!regex) {
    regex = new RegExp(pattern, flags);
    REGEX_CACHE.set(key, regex);
  }
  // Sticky/global regexes carry lastIndex between tests; reset before reuse.
  regex.lastIndex = 0;
  return regex;
}

function scoreRegex(rule: RegexRule, answerText: string): boolean {
  const text = unwrapHarmlessMarkdown(answerText);
  if (rule.sentenceCount !== undefined && splitSentences(text).length !== rule.sentenceCount) return false;
  if (rule.forbiddenPatterns?.some((pattern) => compileRegex(pattern, rule.flags).test(text))) return false;
  return compileRegex(rule.pattern, rule.flags).test(text);
}

function scoreRegexSet(rule: RegexSetRule, answerText: string): boolean {
  const text = unwrapHarmlessMarkdown(answerText);
  if (rule.forbiddenPatterns?.some((pattern) => compileRegex(pattern, rule.flags).test(text))) return false;
  const matches = rule.patterns.filter((pattern) => compileRegex(pattern, rule.flags).test(text)).length;
  return matches >= rule.minimumMatches;
}

function scoreContains(rule: ContainsRule, answerText: string): boolean {
  const text = normalizeText(unwrapHarmlessMarkdown(answerText), rule.caseSensitive);
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
  const normalizedAnswer = unwrapHarmlessMarkdown(answerText);
  const scoped = scopeText(normalizedAnswer, source === "last-number" || source === "exact" ? "answer" : source);
  if (source === "exact" || source === "terminal-final") {
    const parsed = parseNumeric(unwrapHarmlessMarkdown(scoped));
    return parsed !== null && numericMatches(parsed, expected, rule.tolerance);
  }
  const tokens = extractNumberTokens(scoped);
  const candidates = source === "last-number" ? tokens.slice(-1) : tokens;
  return candidates.some((candidate) => {
    const parsed = parseNumeric(candidate);
    return parsed !== null && numericMatches(parsed, expected, rule.tolerance);
  });
}

function scoreSequence(rule: SequenceRule, answerText: string): boolean {
  const text = scopeText(unwrapHarmlessMarkdown(answerText), rule.source ?? "answer");
  const minimumMatches = rule.minimumMatches ?? rule.expected.length;
  if (rule.listOnly) {
    const listText = text.trim().replace(/[.!]$/, "");
    const items = listText.split(",").map((item) => item.trim());
    if (items.length < 2 || items.some((item) => !item)) return false;
    if (rule.tokenType === "number" && items.some((item) => parseNumeric(item) === null)) return false;
    if (rule.tokenType === "word" && items.some((item) => !/^[\p{L}]+(?:['’\-][\p{L}]+)*$/u.test(item))) return false;
  }
  if (rule.tokenType === "number") {
    const actual = extractNumberTokens(text).map(parseNumeric).filter((value): value is number => value !== null);
    const expected = rule.expected.map(parseNumeric);
    if (expected.some((value) => value === null)) return false;
    const expectedNumbers = expected as number[];
    if (rule.contiguous) {
      return actual.some((_, start) => expectedNumbers.every((value, offset) =>
        actual[start + offset] !== undefined && numericMatches(actual[start + offset], value, rule.tolerance)));
    }
    return longestCommonSubsequenceLength(actual, expectedNumbers,
      (left, right) => numericMatches(left, right, rule.tolerance)) >= minimumMatches;
  }

  const normalize = (value: string | number) => normalizeText(String(value), rule.caseSensitive);
  const actual = extractWordTokens(text).map(normalize);
  const expected = rule.expected.map(normalize);
  if (rule.contiguous) {
    return actual.some((_, start) => expected.every((value, offset) => actual[start + offset] === value));
  }
  return longestCommonSubsequenceLength(actual, expected, (left, right) => left === right) >= minimumMatches;
}

function extractExactListOutput(answerText: string): string[][] | null {
  const text = unwrapHarmlessMarkdown(answerText);
  const lists = [...text.matchAll(/\[([^\[\]]*)\]/g)];
  const remainder = text.replace(/\[[^\[\]]*\]/g, "").trim();
  if (remainder || lists.length === 0) return null;
  return lists.map((match) => match[1].split(",").map((value) => value.trim()));
}

function scoreListOutput(rule: ListOutputRule, answerText: string): boolean {
  const lists = extractExactListOutput(answerText);
  if (!lists || lists.length !== rule.totalLists) return false;
  const actual = lists[rule.listIndex];
  if (!actual || actual.length !== rule.expected.length || actual.some((value) => !value)) return false;
  return actual.every((value, index) =>
    normalizeText(value, rule.caseSensitive) === normalizeText(rule.expected[index], rule.caseSensitive));
}

type PositionAssertion = { position: number; entity: string };

const ORDINAL_POSITIONS: Readonly<Record<string, number>> = {
  one: 1,
  first: 1,
  two: 2,
  second: 2,
  three: 3,
  third: 3,
  four: 4,
  fourth: 4,
};

function parsePosition(value: string): number | null {
  const numeric = Number(value);
  if (Number.isInteger(numeric)) return numeric;
  return ORDINAL_POSITIONS[value.toLowerCase()] ?? null;
}

function parseOrderingAssertions(answerText: string, expectedLength: number): {
  assertions: PositionAssertion[];
  invalid: boolean;
} {
  const text = unwrapHarmlessMarkdown(answerText);
  const assertions: PositionAssertion[] = [];
  let invalid = false;
  const remainder = [...text];

  for (const match of text.matchAll(/\[\s*([A-Za-z0-9_-]+(?:\s*,\s*[A-Za-z0-9_-]+)*)\s*\]/g)) {
    const values = match[1].split(",").map((value) => value.trim());
    if (values.length !== expectedLength) invalid = true;
    values.forEach((entity, index) => assertions.push({ position: index + 1, entity }));
    const start = match.index ?? 0;
    for (let index = start; index < start + match[0].length; index += 1) remainder[index] = " ";
  }

  const prose = remainder.join("");
  const collect = (pattern: RegExp, positionGroup: number, entityGroup: number): void => {
    for (const match of prose.matchAll(pattern)) {
      const position = parsePosition(match[positionGroup]);
      if (position === null) {
        invalid = true;
      } else {
        assertions.push({ position, entity: match[entityGroup] });
      }
    }
  };

  collect(/\b(?:position|place|slot)\s*(\d+|one|two|three|four)\s*(?:is|[:=])\s*([A-Z])\b/gi, 1, 2);
  collect(/\b(\d+)\s*[:=.)-]\s*([A-Z])\b/g, 1, 2);
  collect(/\b([A-Z])\s*(?:[:=]\s*|is\s+(?:in\s+)?(?:position|place|slot)\s*)(\d+)\b/gi, 2, 1);
  collect(/\b([A-Z])\s+is\s+(?:in\s+)?(?:the\s+)?(first|second|third|fourth)(?:\s+(?:position|place|slot))?\b/gi, 2, 1);
  collect(/\b(?:the\s+)?(first|second|third|fourth)(?:\s+(?:position|place|slot))?\s*(?::|=|is)\s*([A-Z])\b/gi, 1, 2);

  return { assertions, invalid };
}

function scoreOrdering(rule: OrderingRule, answerText: string): boolean {
  const forbiddenFlags = rule.caseSensitive ? undefined : "i";
  if (rule.forbiddenPatterns?.some((pattern) => new RegExp(pattern, forbiddenFlags).test(answerText))) {
    return false;
  }
  if (rule.listOnly) {
    const lists = extractExactListOutput(answerText);
    if (!lists || lists.length !== 1 || lists[0].length !== rule.expected.length) return false;
  }
  const normalize = (value: string) => normalizeText(value, rule.caseSensitive);
  const expected = rule.expected.map(normalize);
  const domain = new Set(expected);
  const expectedPosition = new Map(expected.map((entity, index) => [entity, index]));
  const relativePattern = /\b([A-Za-z0-9_-]+)\s+(?:(?:comes?|is)\s+)?(immediately\s+)?(before|after)\s+([A-Za-z0-9_-]+)\b/gi;
  for (const match of answerText.matchAll(relativePattern)) {
    const left = expectedPosition.get(normalize(match[1]));
    const right = expectedPosition.get(normalize(match[4]));
    if (left === undefined || right === undefined) continue;
    const directionIsValid = match[3].toLowerCase() === "before" ? left < right : left > right;
    const immediacyIsValid = !match[2] || Math.abs(left - right) === 1;
    if (!directionIsValid || !immediacyIsValid) return false;
  }
  const parsed = parseOrderingAssertions(answerText, expected.length);
  if (parsed.invalid || parsed.assertions.length === 0) return false;

  const byPosition = new Map<number, Set<string>>();
  const byEntity = new Map<string, Set<number>>();
  for (const assertion of parsed.assertions) {
    const entity = normalize(assertion.entity);
    if (assertion.position < 1 || assertion.position > expected.length || !domain.has(entity)) return false;
    const entities = byPosition.get(assertion.position) ?? new Set<string>();
    entities.add(entity);
    byPosition.set(assertion.position, entities);
    const positions = byEntity.get(entity) ?? new Set<number>();
    positions.add(assertion.position);
    byEntity.set(entity, positions);
  }
  if ([...byPosition.values()].some((values) => values.size !== 1) ||
    [...byEntity.values()].some((values) => values.size !== 1)) return false;

  const correct = [...byPosition].filter(([position, entities]) =>
    entities.has(expected[position - 1])).length;
  return correct >= rule.minimumMatches;
}

function longestCommonSubsequenceLength<T>(
  actual: readonly T[],
  expected: readonly T[],
  equals: (left: T, right: T) => boolean,
): number {
  let previous = new Array<number>(expected.length + 1).fill(0);
  for (const actualValue of actual) {
    const current = new Array<number>(expected.length + 1).fill(0);
    for (let expectedIndex = 1; expectedIndex <= expected.length; expectedIndex += 1) {
      current[expectedIndex] = equals(actualValue, expected[expectedIndex - 1])
        ? previous[expectedIndex - 1] + 1
        : Math.max(previous[expectedIndex], current[expectedIndex - 1]);
    }
    previous = current;
  }
  return previous[expected.length];
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
  if (rule.forbidMarkdown && /(?:```|`|\*\*|__|~~|^\s*>|^\s{0,3}#{1,6}\s|^\s{0,3}(?:-{3,}|_{3,}|\*{3,})\s*$|(?:^|\s)\*[^*\n]+\*(?:\s|$)|(?:^|\s)_[^_\n]+_(?:\s|$)|\[[^\]]+\]\([^)]+\))/m.test(answerText)) return false;
  if (rule.requireLexicalStart && !/^[\p{L}\p{N}]/u.test(answerText.trimStart())) return false;

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

function normalizeFieldName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function parseStructuredFields(
  answerText: string,
  scope: StructuredRuleScope,
): Map<string, string> | null {
  const required = scope.requiredFields.map(normalizeFieldName);
  const requiredSet = new Set(required);
  const fields = new Map<string, string>();
  const seenOrder: string[] = [];
  const prose: string[] = [];

  for (const rawLine of nonEmptyLines(unwrapHarmlessMarkdown(answerText))) {
    const line = rawLine.replace(/\*\*|__/g, "").trim();
    const match = line.match(/^([\p{L}][\p{L}\p{N} _-]*?)\s*:\s*(.*?)\s*$/u);
    if (!match) {
      prose.push(line);
      continue;
    }
    const name = normalizeFieldName(match[1]);
    if (!requiredSet.has(name) || fields.has(name)) return null;
    const value = unwrapHarmlessMarkdown(match[2]);
    if (!value) return null;
    fields.set(name, value);
    seenOrder.push(name);
  }

  if (fields.size !== required.length || required.some((name) => !fields.has(name))) return null;
  if (!scope.allowProse && prose.length > 0) return null;
  if (!scope.allowProse && seenOrder.some((name, index) => name !== required[index])) return null;
  return fields;
}

function scopeStructuredRule(rule: ScoringRule, answerText: string): string | null {
  if (!rule.structured) return answerText;
  const fields = parseStructuredFields(answerText, rule.structured);
  if (!fields) return null;
  return rule.structured.fields
    .map((field) => fields.get(normalizeFieldName(field)))
    .filter((value): value is string => value !== undefined)
    .join("\n");
}

function evaluateRule(rule: ScoringRule, answerText: string): boolean {
  const scopedText = scopeStructuredRule(rule, answerText);
  if (scopedText === null) return false;
  switch (rule.kind) {
    case "exact": return scoreExact(rule, scopedText);
    case "regex": return scoreRegex(rule, scopedText);
    case "regex-set": return scoreRegexSet(rule, scopedText);
    case "contains": return scoreContains(rule, scopedText);
    case "numeric": return scoreNumeric(rule, scopedText);
    case "sequence": return scoreSequence(rule, scopedText);
    case "list-output": return scoreListOutput(rule, scopedText);
    case "ordering": return scoreOrdering(rule, scopedText);
    case "text-constraints": return scoreTextConstraints(rule, scopedText);
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
  if (value.structured !== undefined) {
    if (!isRecord(value.structured)) {
      throw new Error(`Invalid scoring configuration: ${path}.structured must be an object.`);
    }
    assertStringArray(value.structured.fields, `${path}.structured.fields`);
    assertStringArray(value.structured.requiredFields, `${path}.structured.requiredFields`);
    const fields = (value.structured.fields as string[]).map(normalizeFieldName);
    const requiredFields = (value.structured.requiredFields as string[]).map(normalizeFieldName);
    if (fields.length === 0 || requiredFields.length === 0 ||
      new Set(fields).size !== fields.length || new Set(requiredFields).size !== requiredFields.length ||
      fields.some((field) => !new Set(requiredFields).has(field))) {
      throw new Error(`Invalid scoring configuration: ${path}.structured fields are invalid.`);
    }
    assertOptionalBoolean(value.structured.allowProse, `${path}.structured.allowProse`);
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
      if (value.forbiddenPatterns !== undefined) {
        assertStringArray(value.forbiddenPatterns, `${path}.forbiddenPatterns`);
      }
      assertOptionalCount(value.sentenceCount, `${path}.sentenceCount`);
      new RegExp(value.pattern, value.flags as string | undefined);
      (value.forbiddenPatterns ?? []).forEach((pattern) => new RegExp(pattern as string, value.flags as string | undefined));
      break;
    case "regex-set":
      if (!Array.isArray(value.patterns) || value.patterns.length === 0 || value.patterns.some((pattern) => typeof pattern !== "string") ||
        (value.flags !== undefined && typeof value.flags !== "string")) {
        throw new Error(`Invalid scoring configuration: ${path} regex-set fields are malformed.`);
      }
      if (value.forbiddenPatterns !== undefined) {
        assertStringArray(value.forbiddenPatterns, `${path}.forbiddenPatterns`);
      }
      if (!Number.isInteger(value.minimumMatches) || (value.minimumMatches as number) < 1 || (value.minimumMatches as number) > value.patterns.length) {
        throw new Error(`Invalid scoring configuration: ${path}.minimumMatches is invalid.`);
      }
      value.patterns.forEach((pattern) => new RegExp(pattern as string, value.flags as string | undefined));
      (value.forbiddenPatterns ?? []).forEach((pattern) => new RegExp(pattern as string, value.flags as string | undefined));
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
      if (value.source !== undefined && !["answer", "exact", "final-answer", "terminal-final", "last-line", "last-number"].includes(String(value.source))) {
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
      if (value.source !== undefined && !["answer", "first-line", "final-answer", "last-line"].includes(String(value.source))) {
        throw new Error(`Invalid scoring configuration: ${path}.source is invalid.`);
      }
      if (value.tolerance !== undefined && (typeof value.tolerance !== "number" || !Number.isFinite(value.tolerance) || value.tolerance < 0)) {
        throw new Error(`Invalid scoring configuration: ${path}.tolerance is invalid.`);
      }
      if (value.minimumMatches !== undefined &&
        (!Number.isInteger(value.minimumMatches) || (value.minimumMatches as number) < 1 || (value.minimumMatches as number) > value.expected.length)) {
        throw new Error(`Invalid scoring configuration: ${path}.minimumMatches is invalid.`);
      }
      if (value.contiguous === true && value.minimumMatches !== undefined && value.minimumMatches !== value.expected.length) {
        throw new Error(`Invalid scoring configuration: ${path}.minimumMatches cannot shorten a contiguous sequence.`);
      }
      assertOptionalBoolean(value.contiguous, `${path}.contiguous`);
      assertOptionalBoolean(value.caseSensitive, `${path}.caseSensitive`);
      assertOptionalBoolean(value.listOnly, `${path}.listOnly`);
      break;
    case "list-output":
      if (!Array.isArray(value.expected) || value.expected.length === 0 ||
        value.expected.some((item) => typeof item !== "string" || !item.trim())) {
        throw new Error(`Invalid scoring configuration: ${path}.expected must contain non-empty strings.`);
      }
      if (!Number.isInteger(value.totalLists) || (value.totalLists as number) < 1 ||
        !Number.isInteger(value.listIndex) || (value.listIndex as number) < 0 ||
        (value.listIndex as number) >= (value.totalLists as number)) {
        throw new Error(`Invalid scoring configuration: ${path} list-output indexes are invalid.`);
      }
      assertOptionalBoolean(value.caseSensitive, `${path}.caseSensitive`);
      break;
    case "ordering":
      if (!Array.isArray(value.expected) || value.expected.length < 2 ||
        value.expected.some((item) => typeof item !== "string" || !item.trim()) ||
        new Set((value.expected as string[]).map((item) => item.toLowerCase())).size !== value.expected.length) {
        throw new Error(`Invalid scoring configuration: ${path}.expected must contain unique non-empty strings.`);
      }
      if (!Number.isInteger(value.minimumMatches) || (value.minimumMatches as number) < 1 ||
        (value.minimumMatches as number) > value.expected.length) {
        throw new Error(`Invalid scoring configuration: ${path}.minimumMatches is invalid.`);
      }
      if (value.forbiddenPatterns !== undefined) {
        assertStringArray(value.forbiddenPatterns, `${path}.forbiddenPatterns`);
        value.forbiddenPatterns.forEach((pattern) => new RegExp(pattern as string, value.caseSensitive ? undefined : "i"));
      }
      assertOptionalBoolean(value.caseSensitive, `${path}.caseSensitive`);
      assertOptionalBoolean(value.listOnly, `${path}.listOnly`);
      break;
    case "text-constraints": {
      const constraintFields = [
        "sentenceCount", "wordsPerSentence", "paragraphCount", "totalWords", "exactWordCounts",
        "forbiddenCharacters", "sentenceConstraints", "lastWord", "forbidBulletList", "forbidNumberedList", "forbidMarkdown",
        "requireLexicalStart",
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
      assertOptionalBoolean(value.forbidMarkdown, `${path}.forbidMarkdown`);
      assertOptionalBoolean(value.requireLexicalStart, `${path}.requireLexicalStart`);
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

const VALIDATED_CONFIGS = new WeakSet<object>();

export function parseScoringConfig(value: unknown): ScoringConfig {
  if (!isRecord(value) || typeof value.benchmarkVersion !== "string" || !Array.isArray(value.prompts)) {
    throw new Error("Invalid scoring configuration root.");
  }
  // Skip revalidation (and its regex compilation) for configs this function
  // has already accepted — scoreResponses re-parses per submission otherwise.
  if (VALIDATED_CONFIGS.has(value)) return value as unknown as ScoringConfig;
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
  VALIDATED_CONFIGS.add(value);
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

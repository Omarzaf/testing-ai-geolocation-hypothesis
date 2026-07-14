export const BENCHMARK_VERSION = "core-2.0";

export type BenchmarkVariant = "A" | "B";

export type BenchmarkPrompt = {
  readonly id: string;
  readonly capability: string;
  readonly title: string;
  readonly scored: boolean;
  readonly variants: Readonly<Record<BenchmarkVariant, string>>;
  /** Compatibility field for callers that have not selected a variant yet. */
  readonly prompt: string;
};

export type SelectedBenchmarkPrompt = Omit<BenchmarkPrompt, "variants" | "prompt"> & {
  readonly variant: BenchmarkVariant;
  readonly prompt: string;
};

type BenchmarkPromptDefinition = Omit<BenchmarkPrompt, "prompt">;

function definePrompt(definition: BenchmarkPromptDefinition): BenchmarkPrompt {
  return { ...definition, prompt: definition.variants.A };
}

export const REASONING_TOKEN_TRAILER = `After your answer, add one final line in exactly this format:
REASONING TOKENS: [your best estimate of how many tokens you used thinking about this problem, as a number, or "unknown"]`;

export const BENCHMARK_PROMPTS: readonly BenchmarkPrompt[] = [
  definePrompt({
    id: "A1",
    capability: "Arithmetic reasoning",
    title: "Two-product calculation",
    scored: true,
    variants: {
      A: `Compute (47 × 23) − (18 × 31). Show both products. End with exactly: FINAL ANSWER: [number]`,
      B: `Compute (64 × 17) − (29 × 12). Show both products. End with exactly: FINAL ANSWER: [number]`,
    },
  }),
  definePrompt({
    id: "A2",
    capability: "String transformation",
    title: "Reverse a string",
    scored: true,
    variants: {
      A: `Reverse QPLXW. Reply with the reversed string only.`,
      B: `Reverse NFKSD. Reply with the reversed string only.`,
    },
  }),
  definePrompt({
    id: "A3",
    capability: "Deductive logic",
    title: "Category implication",
    scored: true,
    variants: {
      A: `All A are B. No B are C. Can any A be C? Answer and give a one-sentence justification.`,
      B: `All D are E. No E are F. Can any D be F? Answer and give a one-sentence justification.`,
    },
  }),
  definePrompt({
    id: "B1",
    capability: "Quantitative reasoning",
    title: "Production and rework",
    scored: true,
    variants: {
      A: `A machine makes 14 units per hour for 6 hours, then 9 units per hour for 4 hours. Twenty percent of all units are defective, and half of the defective units are successfully reworked into sellable units. The machine's rated capacity is 16 units per hour. How many units are sellable? Show your calculation.`,
      B: `A machine makes 12 units per hour for 5 hours, then 10 units per hour for 3 hours. Ten percent of all units are defective, and two-thirds of the defective units are successfully reworked into sellable units. The machine's rated capacity is 15 units per hour. How many units are sellable? Show your calculation.`,
    },
  }),
  definePrompt({
    id: "B2",
    capability: "Instruction following",
    title: "Sentence constraints",
    scored: true,
    variants: {
      A: `Write exactly three sentences about rain. Each sentence must contain exactly eight words. The second sentence must not contain the letter e. Return only the three sentences.`,
      B: `Write exactly three sentences about wind. Each sentence must contain exactly eight words. The second sentence must not contain the letter a. Return only the three sentences.`,
    },
  }),
  definePrompt({
    id: "B3",
    capability: "Probability",
    title: "Same-group probability",
    scored: true,
    variants: {
      A: `Two cards are drawn from a standard 52-card deck without replacement. What is the probability that both cards have the same suit? Show your calculation.`,
      B: `A box contains five red tokens and seven blue tokens. Two tokens are drawn without replacement. What is the probability that both tokens have the same color? Show your calculation.`,
    },
  }),
  definePrompt({
    id: "B4",
    capability: "Code reasoning",
    title: "List aliasing",
    scored: true,
    variants: {
      A: `In Python 3, predict the exact output:\n\na=[1,2,3]\nb=a\na=a+[4]\nb.append(5)\nprint(a,b)`,
      B: `In Python 3, predict the exact output:\n\nx=[10,20]\ny=x\nx.append(30)\ny=y+[40]\nprint(x,y)`,
    },
  }),
  definePrompt({
    id: "B5",
    capability: "Constraint solving",
    title: "Unique ordering",
    scored: true,
    variants: {
      A: `Four runners P, Q, R, and S occupy positions 1–4. P is before Q. R is not last. S is immediately after P. R is before Q. P is not first. Give the runner in each position.`,
      B: `Four tasks J, K, L, and M occupy positions 1–4. J is immediately before K. M is before L. K is before L. J is not first. Give the task in each position.`,
    },
  }),
  definePrompt({
    id: "B6",
    capability: "Premise correction",
    title: "Correct a false premise",
    scored: true,
    variants: {
      A: `Since 87 is an even number, list all of its even factors. Correct the premise as appropriate.`,
      B: `Since 91 is a prime number, list all of its prime factors. Correct the premise as appropriate.`,
    },
  }),
  definePrompt({
    id: "C1",
    capability: "Multi-step arithmetic",
    title: "Running calculation",
    scored: true,
    variants: {
      A: `Start with 3. Apply these operations in order: +8; ×3; −7; ÷2; +19; ×2; −45; +6; ÷5; ×11; −13; ÷6; +28; ×4; −53. Show the running value after every step.`,
      B: `Start with 5. Apply these operations in order: +7; ×2; −4; ÷5; +9; ×3; −7; ÷4; +6; ×5; −10; ÷5; +11; ×2; −9. Show the running value after every step.`,
    },
  }),
  definePrompt({
    id: "C2",
    capability: "Instruction following",
    title: "Paragraph constraints",
    scored: true,
    variants: {
      A: `Write one paragraph of exactly 30 words about rivers. Use the word water exactly twice, case-insensitive. Do not use the letter z. Make the last word sea.`,
      B: `Write one paragraph of exactly 30 words about forests. Use the word trees exactly twice, case-insensitive. Do not use the letter q. Make the last word earth.`,
    },
  }),
  definePrompt({
    id: "C3",
    capability: "Combinatorics",
    title: "Increasing digits",
    scored: true,
    variants: {
      A: `How many three-digit base-10 numbers have strictly increasing digits from left to right? Explain your counting method.`,
      B: `How many four-digit base-10 numbers have strictly decreasing digits from left to right? Explain your counting method.`,
    },
  }),
  definePrompt({
    id: "C4",
    capability: "Evidence fidelity",
    title: "Incomplete observations",
    scored: true,
    variants: {
      A: `Use only this passage:\n\nMarch rainfall was 118 mm. April rainfall was 74 mm. In May, the station was unstaffed for 12 days and no readings were available for those days. June rainfall was 91 mm.\n\nAnswer:\n1. What is March plus April rainfall?\n2. What was the total rainfall in May?\n3. What is March rainfall minus June rainfall?`,
      B: `Use only this passage:\n\nA greenhouse recorded 42 liters of water use on Monday and 35 liters on Tuesday. On Wednesday, its meter was offline for five hours and no complete daily total was recorded. Thursday water use was 47 liters.\n\nAnswer:\n1. What is Monday plus Tuesday water use?\n2. What was Wednesday's total water use?\n3. What is Thursday water use minus Monday water use?`,
    },
  }),
  definePrompt({
    id: "M1",
    capability: "Model self-report probe",
    title: "Model metadata",
    scored: false,
    variants: {
      A: `On one line, report the exact model name and version you are running, followed by your knowledge cutoff.`,
      B: `Give your precise model identifier and version together with your knowledge-cutoff date. Use one line only.`,
    },
  }),
  definePrompt({
    id: "M2",
    capability: "Explanatory probe",
    title: "Daytime sky",
    scored: false,
    variants: {
      A: `Explain why the sky is blue.`,
      B: `Why does a clear daytime sky on Earth usually appear blue? Explain briefly.`,
    },
  }),
];

const PROMPTS_BY_ID = new Map(BENCHMARK_PROMPTS.map((prompt) => [prompt.id, prompt]));

export function getBenchmarkPrompt(promptId: string): BenchmarkPrompt | undefined {
  return PROMPTS_BY_ID.get(promptId);
}

export function selectPromptVariant(
  prompt: BenchmarkPrompt,
  variant: BenchmarkVariant,
): SelectedBenchmarkPrompt {
  return {
    id: prompt.id,
    capability: prompt.capability,
    title: prompt.title,
    scored: prompt.scored,
    variant,
    prompt: prompt.variants[variant],
  };
}

export function selectBenchmarkVariant(
  promptId: string,
  variant: BenchmarkVariant,
): SelectedBenchmarkPrompt | undefined {
  const prompt = getBenchmarkPrompt(promptId);
  return prompt ? selectPromptVariant(prompt, variant) : undefined;
}

export function appendReasoningTokenTrailer(prompt: string): string {
  const trimmed = prompt.trimEnd();
  return trimmed.endsWith(REASONING_TOKEN_TRAILER)
    ? trimmed
    : `${trimmed}\n\n${REASONING_TOKEN_TRAILER}`;
}

export function renderPromptForCopy(
  prompt: BenchmarkPrompt,
  variant: BenchmarkVariant,
): SelectedBenchmarkPrompt {
  const selected = selectPromptVariant(prompt, variant);
  return { ...selected, prompt: appendReasoningTokenTrailer(selected.prompt) };
}

function seedToUint32(seed: string | number): number {
  const input = String(seed);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function shufflePromptOrder<T>(items: readonly T[], seed: string | number): T[] {
  const shuffled = [...items];
  let state = seedToUint32(seed);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const target = Math.floor((state / 0x1_0000_0000) * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export const MODEL_CATALOG: Record<string, string[]> = {
  "OpenAI / ChatGPT": [
    "GPT-5.4",
    "GPT-5.3",
    "GPT-5.2",
    "GPT-5",
    "GPT-4.1",
    "GPT-4o",
    "o3",
    "o4-mini",
    "Auto / model not shown",
    "Other OpenAI model",
  ],
  "Anthropic / Claude": [
    "Claude Opus 4.6",
    "Claude Sonnet 4.6",
    "Claude Haiku 4.5",
    "Auto / model not shown",
    "Other Claude model",
  ],
  "Google / Gemini": [
    "Gemini 3.1 Pro",
    "Gemini 3 Flash",
    "Gemini 2.5 Pro",
    "Gemini 2.5 Flash",
    "Auto / model not shown",
    "Other Gemini model",
  ],
  "xAI / Grok": ["Grok 4", "Grok 4 Fast", "Grok 3", "Auto / model not shown", "Other Grok model"],
  DeepSeek: ["DeepSeek V3", "DeepSeek R1", "DeepSeek Chat", "DeepSeek Reasoner", "Other DeepSeek model"],
  "Microsoft Copilot": ["Smart / Auto", "Think Deeper", "Model not shown", "Other Copilot model"],
  "Meta AI": ["Meta AI / model not shown", "Llama 4 Maverick", "Llama 4 Scout", "Other Meta model"],
  "Mistral / Le Chat": ["Mistral Large", "Mistral Medium", "Magistral", "Model not shown", "Other Mistral model"],
  Perplexity: ["Sonar", "Sonar Pro", "Sonar Reasoning", "Auto / model not shown", "Other Perplexity model"],
  "Alibaba / Qwen": ["Qwen Max", "Qwen Plus", "Qwen Turbo", "QwQ", "Other Qwen model"],
  "Moonshot / Kimi": ["Kimi K2", "Kimi Thinking", "Auto / model not shown", "Other Kimi model"],
  Other: ["Other / enter the exact label shown"],
};

export const ACCESS_TYPES = [
  "Free individual access",
  "Paid individual access",
  "Education or research access",
  "Work or team access",
  "Enterprise access",
  "Not sure",
] as const;

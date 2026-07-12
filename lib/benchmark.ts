export const BENCHMARK_VERSION = "core-1.0";

export type BenchmarkPrompt = {
  id: string;
  capability: string;
  title: string;
  prompt: string;
};

export const BENCHMARK_PROMPTS: BenchmarkPrompt[] = [
  {
    id: "arithmetic-01",
    capability: "Arithmetic reasoning",
    title: "Inventory calculation",
    prompt: `Solve carefully.

A warehouse has 17 crates. Each crate contains 24 boxes. Each box contains 13 screws. Nine crates are shipped out. Then 312 screws are added to the remaining inventory.

How many screws are now in the warehouse?

Show your calculation. End with exactly: FINAL ANSWER: [number]`,
  },
  {
    id: "logic-01",
    capability: "Deductive logic",
    title: "Pet ownership",
    prompt: `Three people—Amina, Bilal, and Chen—each own exactly one different pet: a cat, a dog, or a parrot.

1. Amina does not own the dog.
2. Bilal does not own the cat.
3. Chen owns the parrot.

State who owns each pet and explain briefly. End with exactly: FINAL ANSWER: Amina=[pet], Bilal=[pet], Chen=[pet]`,
  },
  {
    id: "pattern-01",
    capability: "Pattern reasoning",
    title: "Sequence rule",
    prompt: `Find the next number in this sequence:

2, 6, 12, 20, 30, ?

Explain the rule in one sentence. End with exactly: FINAL ANSWER: [number]`,
  },
  {
    id: "probability-01",
    capability: "Probabilistic reasoning",
    title: "Two draws",
    prompt: `A bag contains 2 red balls and 3 blue balls. Two balls are drawn one after another without replacement.

What is the probability that both balls are red? Show the calculation. End with exactly: FINAL ANSWER: [fraction]`,
  },
  {
    id: "constraint-01",
    capability: "Instruction following",
    title: "Exact constraints",
    prompt: `Write exactly four bullet points explaining why clean drinking water matters.

Rules:
- Each bullet must contain exactly five words.
- Do not use the words “health”, “disease”, or “children”.
- Do not include an introduction or conclusion.
- Return only the four bullet points.`,
  },
  {
    id: "json-01",
    capability: "Structured reasoning",
    title: "JSON extraction",
    prompt: `Extract the information below into valid JSON.

Text: “Fatima bought 3 notebooks for 240 rupees each and 2 pens for 75 rupees each.”

Use exactly these fields:
- buyer
- item_count_total
- notebooks_total_price
- pens_total_price
- grand_total

Return valid JSON only. Do not use markdown.`,
  },
  {
    id: "evidence-01",
    capability: "Evidence fidelity",
    title: "Reasoning from a passage",
    prompt: `Use only the passage below. Do not use outside knowledge.

Passage:
The Zarin Bridge opened in 1984. It is 620 meters long. In 2011, the bridge was closed for 9 months for structural repairs. A second inspection in 2019 found no major safety problems, but recommended repainting within 5 years.

Questions:
1. How long is the bridge?
2. In what year did it reopen after the 2011 closure?
3. By what year was repainting recommended?

If the passage does not support an exact answer, say so. Answer in numbered form.`,
  },
  {
    id: "code-01",
    capability: "Code reasoning",
    title: "Order-preserving deduplication",
    prompt: `Write a Python function called dedupe_keep_order(items) that removes duplicate values from a list while preserving the order of their first appearance.

Example:
dedupe_keep_order(["a", "b", "a", "c", "b"]) should return ["a", "b", "c"]

Return only executable Python code. Do not include markdown or an explanation.`,
  },
  {
    id: "spatial-01",
    capability: "Spatial reasoning",
    title: "Grid movement",
    prompt: `A robot starts at coordinate (2, 3). It moves 4 units east, 2 units north, 7 units west, and 5 units south.

Where does it finish? Show the coordinate changes. End with exactly: FINAL ANSWER: ([x], [y])`,
  },
  {
    id: "inference-01",
    capability: "Logical inference",
    title: "What follows?",
    prompt: `Consider these statements:

1. All kestrels are birds.
2. Some birds cannot fly.

Can we logically conclude that some kestrels cannot fly?

Answer yes or no, explain in no more than two sentences, and end with exactly: FINAL ANSWER: YES or FINAL ANSWER: NO`,
  },
];

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
  "DeepSeek": ["DeepSeek V3", "DeepSeek R1", "DeepSeek Chat", "DeepSeek Reasoner", "Other DeepSeek model"],
  "Microsoft Copilot": ["Smart / Auto", "Think Deeper", "Model not shown", "Other Copilot model"],
  "Meta AI": ["Meta AI / model not shown", "Llama 4 Maverick", "Llama 4 Scout", "Other Meta model"],
  "Mistral / Le Chat": ["Mistral Large", "Mistral Medium", "Magistral", "Model not shown", "Other Mistral model"],
  "Perplexity": ["Sonar", "Sonar Pro", "Sonar Reasoning", "Auto / model not shown", "Other Perplexity model"],
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


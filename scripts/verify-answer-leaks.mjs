import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const privateConfigPath = path.resolve(
  process.env.CORE2_SCORING_CONFIG_PATH ?? "private/core-2-scoring.json",
);
const privateCasesPath = path.resolve(
  process.env.CORE2_SCORING_CASES_PATH ?? "private/core-2-scoring-cases.json",
);

function isWordCharacter(value) {
  return value !== undefined && /[\p{L}\p{N}_]/u.test(value);
}

export function containsBounded(text, token) {
  let offset = 0;
  while (offset <= text.length - token.length) {
    const index = text.indexOf(token, offset);
    if (index < 0) return false;
    const before = text[index - 1];
    const after = text[index + token.length];
    const startsCleanly = !isWordCharacter(token[0]) || !isWordCharacter(before);
    const endsWithDigit = /\d/.test(token.at(-1) ?? "");
    const endsCleanly = !isWordCharacter(token.at(-1)) ||
      (!isWordCharacter(after) && !(endsWithDigit && after === "."));
    if (startsCleanly && endsCleanly) return true;
    offset = index + 1;
  }
  return false;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(filePath));
    else if (entry.isFile()) files.push(filePath);
  }
  return files;
}

function historyBlobs() {
  const objectLines = execFileSync("git", ["rev-list", "--objects", "--all"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20_000_000,
  }).trim().split("\n").filter(Boolean);
  const pathByObject = new Map();
  const objectIds = [];
  for (const line of objectLines) {
    const separator = line.indexOf(" ");
    const objectId = separator < 0 ? line : line.slice(0, separator);
    objectIds.push(objectId);
    if (separator >= 0 && !pathByObject.has(objectId)) pathByObject.set(objectId, line.slice(separator + 1));
  }
  if (objectIds.length === 0) return [];

  const check = execFileSync("git", ["cat-file", "--batch-check=%(objectname) %(objecttype)"], {
    cwd: root,
    encoding: "utf8",
    input: `${objectIds.join("\n")}\n`,
    maxBuffer: 20_000_000,
  });
  const blobIds = check.trim().split("\n").flatMap((line) => {
    const [objectId, type] = line.split(" ");
    return type === "blob" ? [objectId] : [];
  });
  if (blobIds.length === 0) return [];

  const batch = execFileSync("git", ["cat-file", "--batch"], {
    cwd: root,
    input: `${blobIds.join("\n")}\n`,
    maxBuffer: 100_000_000,
  });
  const blobs = [];
  let offset = 0;
  while (offset < batch.length) {
    const headerEnd = batch.indexOf(10, offset);
    if (headerEnd < 0) throw new Error("invalid-git-batch-header");
    const [objectId, type, rawSize] = batch.subarray(offset, headerEnd).toString("utf8").split(" ");
    const size = Number(rawSize);
    if (type !== "blob" || !Number.isSafeInteger(size) || size < 0) throw new Error("invalid-git-batch-object");
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    if (contentEnd >= batch.length || batch[contentEnd] !== 10) throw new Error("truncated-git-batch-object");
    blobs.push({ objectId, file: pathByObject.get(objectId) ?? "unknown-path", bytes: batch.subarray(contentStart, contentEnd) });
    offset = contentEnd + 1;
  }
  return blobs;
}

function addToken(tokens, token, sourceId) {
  const normalized = token.replace(/\r\n?/g, "\n").trim();
  if (normalized.length < 4) return;
  const sourceIds = tokens.get(normalized) ?? new Set();
  sourceIds.add(sourceId);
  tokens.set(normalized, sourceIds);
}

export function privateTokens(config, cases) {
  const tokens = new Map();
  for (const testCase of cases.cases ?? []) {
    if (testCase?.category !== "positive" || testCase.expectedScore <= 0 ||
      typeof testCase.responseText !== "string") continue;
    for (const line of testCase.responseText.replace(/\r\n?/g, "\n").split("\n")) {
      const trimmed = line.trim();
      const publicFormatChoice = /^(?:PREMISE|FACTORS|ZERO):\s*(?:TRUE|FALSE|NONE|ALLOWED|EXCLUDED)$/i.test(trimmed);
      if (!/^```/.test(trimmed) && !/^REASONING TOKENS\b/i.test(trimmed) && !publicFormatChoice) {
        addToken(tokens, line, testCase.id);
      }
    }
  }

  for (const prompt of config.prompts ?? []) {
    for (const [variant, configured] of Object.entries(prompt.variants ?? {})) {
      for (const rule of configured.rules ?? []) {
        const sourceId = `${prompt.promptId}-${variant}-${rule.id}`;
        if (rule.kind === "numeric" && typeof rule.expected === "string") {
          const fraction = rule.expected.match(/^\s*([-+]?\d+)\s*\/\s*([-+]?\d+)\s*$/);
          if (fraction && Number(fraction[2]) !== 0) {
            addToken(tokens, `${fraction[1]}/${fraction[2]}`, `${sourceId}-fraction`);
            addToken(
              tokens,
              (Number(fraction[1]) / Number(fraction[2])).toFixed(3),
              `${sourceId}-decimal`,
            );
          }
        }
        if ((rule.kind === "list-output" || rule.kind === "ordering") && Array.isArray(rule.expected)) {
          addToken(tokens, `[${rule.expected.join(", ")}]`, `${sourceId}-list`);
          addToken(tokens, `[${rule.expected.join(",")}]`, `${sourceId}-compact-list`);
        }
      }
    }
  }
  return tokens;
}

async function main() {
  const [config, cases] = await Promise.all([
    readFile(privateConfigPath, "utf8").then(JSON.parse),
    readFile(privateCasesPath, "utf8").then(JSON.parse),
  ]);
  const tokens = privateTokens(config, cases);
  const publicWorktree = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: root,
      maxBuffer: 20_000_000,
    },
  ).toString("utf8").split("\0").filter(Boolean).map((file) => path.join(root, file));
  let built = [];
  try {
    built = await walk(path.join(root, "dist"));
  } catch {
    // The tracked-tree check remains useful before the first build.
  }
  const files = [...new Set([...publicWorktree, ...built])];
  const hits = [];

  for (const file of files) {
    let bytes;
    try {
      bytes = await readFile(file);
    } catch {
      continue;
    }
    if (bytes.includes(0)) continue;
    const text = bytes.toString("utf8");
    for (const [token, sourceIds] of tokens) {
      if (containsBounded(text, token)) {
        hits.push({
          file: path.relative(root, file),
          sourceIds: [...sourceIds].sort(),
        });
      }
    }
  }

  const history = historyBlobs();
  for (const { objectId, file, bytes } of history) {
    if (bytes.includes(0)) continue;
    const text = bytes.toString("utf8");
    for (const [token, sourceIds] of tokens) {
      if (containsBounded(text, token)) {
        hits.push({
          file: `history:${file}@${objectId.slice(0, 12)}`,
          sourceIds: [...sourceIds].sort(),
        });
      }
    }
  }

  const uniqueHits = [...new Map(hits.map((hit) => [
    `${hit.file}|${hit.sourceIds.join(",")}`,
    hit,
  ])).values()];
  if (uniqueHits.length > 0) {
    process.stderr.write(`FAIL private answer material found in public artifacts: ${JSON.stringify(uniqueHits)}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `PASS answer leak scan files=${files.length} history_blobs=${history.length} private_signatures=${tokens.size}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch {
    process.stderr.write("FAIL answer leak scan could not run.\n");
    process.exitCode = 1;
  }
}

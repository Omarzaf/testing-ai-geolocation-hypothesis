import type { BenchmarkVariant } from "./benchmark.ts";

const CONTRACT_VERSION = 1;
const CONTRACT_TTL_SECONDS = 6 * 60 * 60;
const CLOCK_SKEW_SECONDS = 60;
const SIGNING_DOMAIN = "RAB_BENCHMARK_SESSION_V1\0";

export type BenchmarkSessionClaims = {
  contractVersion: 1;
  contractId: string;
  benchmarkVersion: string;
  sessionVariant: BenchmarkVariant;
  promptOrder: string[];
  issuedAt: number;
  expiresAt: number;
};

export type IssuedBenchmarkSession = BenchmarkSessionClaims & {
  sessionToken: string;
};

type SessionCrypto = Pick<Crypto, "getRandomValues" | "randomUUID" | "subtle">;

type IssueSessionOptions = {
  benchmarkVersion: string;
  promptIds: readonly string[];
  secret: string;
  now?: Date;
  cryptoImpl?: SessionCrypto;
  entropy?: readonly number[];
  contractId?: string;
};

type VerifySessionOptions = {
  token: string;
  expectedBenchmarkVersion: string;
  expectedPromptIds: readonly string[];
  secret: string;
  now?: Date;
  cryptoImpl?: Pick<Crypto, "subtle">;
};

export class BenchmarkSessionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BenchmarkSessionError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new BenchmarkSessionError(code, message);
}

function validateSecret(secret: string): void {
  if (new TextEncoder().encode(secret).byteLength < 32) {
    fail("SESSION_SECRET_INVALID", "Benchmark session signing is not configured.");
  }
}

function validatePromptIds(promptIds: readonly string[]): string[] {
  if (!Array.isArray(promptIds) || promptIds.length === 0) {
    return fail("SESSION_PROMPTS_INVALID", "Benchmark prompt configuration is invalid.");
  }
  const normalized = promptIds.map((promptId) => {
    if (typeof promptId !== "string" || !promptId.trim() || promptId.length > 80) {
      return fail("SESSION_PROMPTS_INVALID", "Benchmark prompt configuration is invalid.");
    }
    return promptId.trim();
  });
  if (new Set(normalized).size !== normalized.length) {
    fail("SESSION_PROMPTS_INVALID", "Benchmark prompt configuration is invalid.");
  }
  return normalized;
}

function validateDate(now: Date): number {
  const milliseconds = now.getTime();
  if (!Number.isFinite(milliseconds)) fail("SESSION_TIME_INVALID", "Benchmark session time is invalid.");
  return Math.floor(milliseconds / 1_000);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return fail("SESSION_TOKEN_MALFORMED", "Benchmark session token is malformed.");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return fail("SESSION_TOKEN_MALFORMED", "Benchmark session token is malformed.");
  }
}

async function importSigningKey(secret: string, cryptoImpl: Pick<Crypto, "subtle">): Promise<CryptoKey> {
  validateSecret(secret);
  return cryptoImpl.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayloadSegment(
  payloadSegment: string,
  secret: string,
  cryptoImpl: Pick<Crypto, "subtle">,
): Promise<Uint8Array> {
  const key = await importSigningKey(secret, cryptoImpl);
  const signature = await cryptoImpl.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${SIGNING_DOMAIN}${payloadSegment}`),
  );
  return new Uint8Array(signature);
}

async function verifyPayloadSignature(
  payloadSegment: string,
  signature: Uint8Array<ArrayBuffer>,
  secret: string,
  cryptoImpl: Pick<Crypto, "subtle">,
): Promise<boolean> {
  const key = await importSigningKey(secret, cryptoImpl);
  return cryptoImpl.subtle.verify(
    "HMAC",
    key,
    signature,
    new TextEncoder().encode(`${SIGNING_DOMAIN}${payloadSegment}`),
  );
}

function randomWords(
  count: number,
  cryptoImpl: SessionCrypto,
  injected?: readonly number[],
): number[] {
  if (injected) {
    if (injected.length < count || injected.some((value) => !Number.isInteger(value) || value < 0 || value > 0xffff_ffff)) {
      return fail("SESSION_ENTROPY_INVALID", "Injected benchmark session entropy is invalid.");
    }
    return injected.slice(0, count);
  }
  const values = new Uint32Array(count);
  cryptoImpl.getRandomValues(values);
  return [...values];
}

function randomizedAssignment(
  promptIds: readonly string[],
  cryptoImpl: SessionCrypto,
  entropy?: readonly number[],
): { sessionVariant: BenchmarkVariant; promptOrder: string[] } {
  const words = randomWords(promptIds.length, cryptoImpl, entropy);
  const sessionVariant: BenchmarkVariant = words[0] % 2 === 0 ? "A" : "B";
  const promptOrder = [...promptIds];
  let wordIndex = 1;
  for (let index = promptOrder.length - 1; index > 0; index -= 1) {
    const swapIndex = words[wordIndex] % (index + 1);
    [promptOrder[index], promptOrder[swapIndex]] = [promptOrder[swapIndex], promptOrder[index]];
    wordIndex += 1;
  }
  return { sessionVariant, promptOrder };
}

/** Issues one six-hour, server-randomized, tamper-evident benchmark assignment. */
export async function issueBenchmarkSession({
  benchmarkVersion,
  promptIds,
  secret,
  now = new Date(),
  cryptoImpl = globalThis.crypto,
  entropy,
  contractId = cryptoImpl.randomUUID(),
}: IssueSessionOptions): Promise<IssuedBenchmarkSession> {
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(benchmarkVersion)) {
    fail("SESSION_VERSION_INVALID", "Benchmark version is invalid.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractId)) {
    fail("SESSION_ID_INVALID", "Benchmark session identifier is invalid.");
  }
  const normalizedPromptIds = validatePromptIds(promptIds);
  const issuedAt = validateDate(now);
  const assignment = randomizedAssignment(normalizedPromptIds, cryptoImpl, entropy);
  const claims: BenchmarkSessionClaims = {
    contractVersion: CONTRACT_VERSION,
    contractId,
    benchmarkVersion,
    ...assignment,
    issuedAt,
    expiresAt: issuedAt + CONTRACT_TTL_SECONDS,
  };
  const payloadSegment = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = await signPayloadSegment(payloadSegment, secret, cryptoImpl);
  return { ...claims, sessionToken: `${payloadSegment}.${bytesToBase64Url(signature)}` };
}

function parseClaims(value: unknown): BenchmarkSessionClaims {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fail("SESSION_CLAIMS_INVALID", "Benchmark session claims are invalid.");
  }
  const record = value as Record<string, unknown>;
  const expectedKeys = [
    "contractVersion",
    "contractId",
    "benchmarkVersion",
    "sessionVariant",
    "promptOrder",
    "issuedAt",
    "expiresAt",
  ];
  if (Object.keys(record).length !== expectedKeys.length || expectedKeys.some((key) => !Object.hasOwn(record, key))) {
    return fail("SESSION_CLAIMS_INVALID", "Benchmark session claims are invalid.");
  }
  if (record.contractVersion !== CONTRACT_VERSION ||
    typeof record.contractId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.contractId) ||
    typeof record.benchmarkVersion !== "string" ||
    (record.sessionVariant !== "A" && record.sessionVariant !== "B") ||
    !Array.isArray(record.promptOrder) || record.promptOrder.some((value) => typeof value !== "string") ||
    !Number.isSafeInteger(record.issuedAt) || !Number.isSafeInteger(record.expiresAt)) {
    return fail("SESSION_CLAIMS_INVALID", "Benchmark session claims are invalid.");
  }
  return record as BenchmarkSessionClaims;
}

/** Verifies signature, timing, version, and the exact current prompt set. */
export async function verifyBenchmarkSession({
  token,
  expectedBenchmarkVersion,
  expectedPromptIds,
  secret,
  now = new Date(),
  cryptoImpl = globalThis.crypto,
}: VerifySessionOptions): Promise<BenchmarkSessionClaims> {
  if (typeof token !== "string" || token.length < 20 || token.length > 8_192) {
    return fail("SESSION_TOKEN_MALFORMED", "Benchmark session token is malformed.");
  }
  const segments = token.split(".");
  if (segments.length !== 2) return fail("SESSION_TOKEN_MALFORMED", "Benchmark session token is malformed.");
  const [payloadSegment, signatureSegment] = segments;
  const signature = base64UrlToBytes(signatureSegment);
  if (!await verifyPayloadSignature(payloadSegment, signature, secret, cryptoImpl)) {
    return fail("SESSION_SIGNATURE_INVALID", "Benchmark session token is invalid.");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(base64UrlToBytes(payloadSegment))) as unknown;
  } catch {
    return fail("SESSION_CLAIMS_INVALID", "Benchmark session claims are invalid.");
  }
  const claims = parseClaims(decoded);
  const expectedIds = validatePromptIds(expectedPromptIds);
  const nowSeconds = validateDate(now);
  if (claims.benchmarkVersion !== expectedBenchmarkVersion) {
    return fail("SESSION_VERSION_MISMATCH", "Benchmark session is for a different version.");
  }
  if (claims.issuedAt > nowSeconds + CLOCK_SKEW_SECONDS || claims.expiresAt <= nowSeconds ||
    claims.expiresAt <= claims.issuedAt || claims.expiresAt - claims.issuedAt > CONTRACT_TTL_SECONDS) {
    return fail("SESSION_EXPIRED", "Benchmark session has expired.");
  }
  if (claims.promptOrder.length !== expectedIds.length ||
    new Set(claims.promptOrder).size !== expectedIds.length ||
    claims.promptOrder.some((promptId) => !expectedIds.includes(promptId))) {
    return fail("SESSION_PROMPTS_MISMATCH", "Benchmark session prompt assignment is invalid.");
  }
  return claims;
}

/** Rejects any caller-supplied assignment that differs from the signed contract. */
export function assertBenchmarkAssignment(
  claims: BenchmarkSessionClaims,
  submitted: { benchmarkVersion: string; sessionVariant: BenchmarkVariant; promptOrder: readonly string[] },
): void {
  if (submitted.benchmarkVersion !== claims.benchmarkVersion ||
    submitted.sessionVariant !== claims.sessionVariant ||
    submitted.promptOrder.length !== claims.promptOrder.length ||
    submitted.promptOrder.some((promptId, index) => promptId !== claims.promptOrder[index])) {
    fail("SESSION_ASSIGNMENT_MISMATCH", "Submitted assignment does not match the benchmark session.");
  }
}

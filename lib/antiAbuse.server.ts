const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RATE_LIMIT_UPSERT_SQL = `
  INSERT INTO submission_rate_limits (bucket_day, ip_digest, count, updated_at)
  VALUES (?, ?, 1, CURRENT_TIMESTAMP)
  ON CONFLICT(bucket_day, ip_digest) DO UPDATE SET
    count = MIN(submission_rate_limits.count + 1, ?),
    updated_at = CURRENT_TIMESTAMP
  RETURNING count
`;
const RATE_LIMIT_RELEASE_SQL = `
  UPDATE submission_rate_limits
  SET count = MAX(count - 1, 0), updated_at = CURRENT_TIMESTAMP
  WHERE bucket_day = ? AND ip_digest = ?
  RETURNING count
`;

export type TurnstileVerificationResult = {
  success: boolean;
  errorCodes: string[];
};

export type RateLimitDecision = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitPreparedStatement = {
  bind(...values: unknown[]): RateLimitPreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};

export type RateLimitDatabase = {
  prepare(query: string): RateLimitPreparedStatement;
};

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type CryptoImplementation = Pick<Crypto, "subtle">;

type TurnstileOptions = {
  token: string;
  secretKey: string;
  expectedAction?: string;
  timeoutMs?: number;
  fetchImpl?: FetchImplementation;
};

type DailyDigestOptions = {
  ipAddress: string;
  hmacSecret: string;
  now?: Date;
  cryptoImpl?: CryptoImplementation;
};

type RateLimitOptions = DailyDigestOptions & {
  database: RateLimitDatabase;
  limit?: number;
};

function utcBucketDay(now: Date): string {
  if (Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date.");
  }
  return now.toISOString().slice(0, 10);
}

function secondsUntilNextUtcDay(now: Date): number {
  const nextDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((nextDay - now.getTime()) / 1_000));
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Verifies a Turnstile token without forwarding an IP address to the verification API. */
export async function verifyTurnstileToken({
  token,
  secretKey,
  expectedAction,
  timeoutMs = 5_000,
  fetchImpl = fetch,
}: TurnstileOptions): Promise<TurnstileVerificationResult> {
  if (!token.trim()) {
    return { success: false, errorCodes: ["missing-input-response"] };
  }
  if (!secretKey.trim()) {
    throw new Error("TURNSTILE_SECRET_KEY is not configured.");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw new RangeError("Turnstile timeout must be from 1 to 10000 milliseconds.");
  }

  const body = new URLSearchParams({
    secret: secretKey,
    response: token,
  });
  const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    return { success: false, errorCodes: [`turnstile-http-${response.status}`] };
  }

  const payload = (await response.json()) as unknown;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, errorCodes: ["invalid-turnstile-response"] };
  }
  const record = payload as Record<string, unknown>;
  const errorCodes = Array.isArray(record["error-codes"])
    ? record["error-codes"].filter((value): value is string => typeof value === "string")
    : [];
  if (record.success === true && expectedAction && record.action !== expectedAction) {
    return { success: false, errorCodes: ["action-mismatch"] };
  }
  return { success: record.success === true, errorCodes };
}

/** Derives an unlinkable-across-days HMAC digest; callers must never persist the raw IP. */
export async function deriveDailyIpDigest({
  ipAddress,
  hmacSecret,
  now = new Date(),
  cryptoImpl = globalThis.crypto,
}: DailyDigestOptions): Promise<{ bucketDay: string; digest: string }> {
  const normalizedIp = ipAddress.trim();
  if (!normalizedIp) {
    throw new TypeError("A client IP address is required for rate limiting.");
  }
  if (new TextEncoder().encode(hmacSecret).byteLength < 32) {
    throw new TypeError("RATE_LIMIT_HMAC_SECRET must contain at least 32 UTF-8 bytes.");
  }

  const bucketDay = utcBucketDay(now);
  const key = await cryptoImpl.subtle.importKey(
    "raw",
    new TextEncoder().encode(hmacSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await cryptoImpl.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${bucketDay}\u0000${normalizedIp}`),
  );
  return { bucketDay, digest: bytesToHex(signature) };
}

/** Atomically reserves one daily slot using only a keyed digest, never a raw IP. */
export async function reserveDailySubmission({
  database,
  ipAddress,
  hmacSecret,
  limit = 5,
  now = new Date(),
  cryptoImpl = globalThis.crypto,
}: RateLimitOptions): Promise<RateLimitDecision> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
    throw new RangeError("limit must be an integer from 1 to 1000.");
  }

  const { bucketDay, digest } = await deriveDailyIpDigest({
    ipAddress,
    hmacSecret,
    now,
    cryptoImpl,
  });
  const row = await database
    .prepare(RATE_LIMIT_UPSERT_SQL)
    .bind(bucketDay, digest, limit + 1)
    .first<{ count: number }>();
  const count = Number(row?.count);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("Rate-limit reservation did not return a valid count.");
  }

  return {
    allowed: count <= limit,
    count,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: secondsUntilNextUtcDay(now),
  };
}

/** Returns a reserved daily slot after a failed write so retries are not counted as submissions. */
export async function releaseDailySubmission({
  database,
  ipAddress,
  hmacSecret,
  now = new Date(),
  cryptoImpl = globalThis.crypto,
}: Omit<RateLimitOptions, "limit">): Promise<void> {
  const { bucketDay, digest } = await deriveDailyIpDigest({
    ipAddress,
    hmacSecret,
    now,
    cryptoImpl,
  });
  await database.prepare(RATE_LIMIT_RELEASE_SQL).bind(bucketDay, digest).first();
}

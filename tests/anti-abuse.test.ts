import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveDailyIpDigest,
  reserveDailySubmission,
  verifyTurnstileToken,
  type RateLimitDatabase,
  type RateLimitPreparedStatement,
} from "../lib/antiAbuse.server.ts";

const HMAC_SECRET = "test-only-rate-limit-key-material".padEnd(48, "!");

class FakeRateLimitDatabase implements RateLimitDatabase {
  readonly queries: string[] = [];
  readonly bindings: unknown[][] = [];
  private readonly counts = new Map<string, number>();

  prepare(query: string): RateLimitPreparedStatement {
    this.queries.push(query);
    let values: unknown[] = [];
    return {
      bind: (...boundValues: unknown[]) => {
        values = boundValues;
        this.bindings.push(boundValues);
        return this.prepareResult(() => values);
      },
      first: async <T>() => this.nextCount<T>(values),
    };
  }

  private prepareResult(values: () => unknown[]): RateLimitPreparedStatement {
    return {
      bind: (...boundValues: unknown[]) => {
        this.bindings.push(boundValues);
        return this.prepareResult(() => boundValues);
      },
      first: async <T>() => this.nextCount<T>(values()),
    };
  }

  private async nextCount<T>(values: unknown[]): Promise<T | null> {
    const [bucketDay, digest, cap] = values;
    assert.equal(typeof bucketDay, "string");
    assert.equal(typeof digest, "string");
    assert.equal(typeof cap, "number");
    const key = `${bucketDay}|${digest}`;
    const next = Math.min((this.counts.get(key) ?? 0) + 1, cap as number);
    this.counts.set(key, next);
    return { count: next } as T;
  }
}

test("Turnstile verification sends only the secret and response token", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const result = await verifyTurnstileToken({
    token: "participant-token",
    secretKey: "private-test-secret",
    fetchImpl: async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return Response.json({ success: true });
    },
  });

  assert.deepEqual(result, { success: true, errorCodes: [] });
  assert.match(requestUrl, /turnstile\/v0\/siteverify$/);
  assert.equal(requestInit?.method, "POST");
  const body = String(requestInit?.body);
  assert.match(body, /secret=private-test-secret/);
  assert.match(body, /response=participant-token/);
  assert.doesNotMatch(body, /remoteip|ipAddress|clientIp/i);
});

test("Turnstile failures remain structured and fail closed", async () => {
  const rejected = await verifyTurnstileToken({
    token: "bad-token",
    secretKey: "private-test-secret",
    fetchImpl: async () => Response.json({ success: false, "error-codes": ["invalid-input-response"] }),
  });
  assert.deepEqual(rejected, { success: false, errorCodes: ["invalid-input-response"] });

  const unavailable = await verifyTurnstileToken({
    token: "token",
    secretKey: "private-test-secret",
    fetchImpl: async () => new Response("Unavailable", { status: 503 }),
  });
  assert.deepEqual(unavailable, { success: false, errorCodes: ["turnstile-http-503"] });
});

test("daily IP digests are deterministic within a day and unlinkable across days", async () => {
  const first = await deriveDailyIpDigest({
    ipAddress: "203.0.113.9",
    hmacSecret: HMAC_SECRET,
    now: new Date("2026-07-14T12:00:00Z"),
  });
  const repeated = await deriveDailyIpDigest({
    ipAddress: "203.0.113.9",
    hmacSecret: HMAC_SECRET,
    now: new Date("2026-07-14T23:59:59Z"),
  });
  const nextDay = await deriveDailyIpDigest({
    ipAddress: "203.0.113.9",
    hmacSecret: HMAC_SECRET,
    now: new Date("2026-07-15T00:00:00Z"),
  });

  assert.equal(first.bucketDay, "2026-07-14");
  assert.match(first.digest, /^[a-f0-9]{64}$/);
  assert.equal(first.digest, repeated.digest);
  assert.notEqual(first.digest, nextDay.digest);
  assert.doesNotMatch(first.digest, /203\.0\.113\.9/);
});

test("atomic D1 reservation permits five daily attempts and rejects later attempts", async () => {
  const database = new FakeRateLimitDatabase();
  const decisions = [];
  for (let index = 0; index < 7; index += 1) {
    decisions.push(
      await reserveDailySubmission({
        database,
        ipAddress: "203.0.113.9",
        hmacSecret: HMAC_SECRET,
        now: new Date("2026-07-14T12:00:00Z"),
      }),
    );
  }

  assert.deepEqual(decisions.map(({ allowed }) => allowed), [true, true, true, true, true, false, false]);
  assert.equal(decisions[4].remaining, 0);
  assert.equal(decisions[5].count, 6);
  assert.equal(decisions[6].count, 6);
  assert.match(database.queries[0], /ON CONFLICT\(bucket_day, ip_digest\) DO UPDATE/i);
  assert.match(database.queries[0], /RETURNING count/i);
  assert.ok(database.bindings.every((values) => !values.includes("203.0.113.9")));
  assert.ok(database.bindings.every((values) => /^[a-f0-9]{64}$/.test(String(values[1]))));
});

test("rate-limit buckets reset at UTC midnight", async () => {
  const database = new FakeRateLimitDatabase();
  const lastFirstDay = await reserveDailySubmission({
    database,
    ipAddress: "2001:db8::1",
    hmacSecret: HMAC_SECRET,
    limit: 1,
    now: new Date("2026-07-14T23:59:59Z"),
  });
  const firstNextDay = await reserveDailySubmission({
    database,
    ipAddress: "2001:db8::1",
    hmacSecret: HMAC_SECRET,
    limit: 1,
    now: new Date("2026-07-15T00:00:00Z"),
  });
  assert.equal(lastFirstDay.allowed, true);
  assert.equal(firstNextDay.allowed, true);
  assert.equal(firstNextDay.count, 1);
});

test("HMAC requirements reject missing IPs and weak secrets", async () => {
  await assert.rejects(
    deriveDailyIpDigest({ ipAddress: "", hmacSecret: HMAC_SECRET }),
    /client IP address is required/,
  );
  await assert.rejects(
    deriveDailyIpDigest({ ipAddress: "203.0.113.9", hmacSecret: "too-short" }),
    /at least 32 UTF-8 bytes/,
  );
});

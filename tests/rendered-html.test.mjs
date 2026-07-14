import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the core-2 public benchmark and sketch system", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Reasoning Across Borders<\/title>/i);
  assert.match(html, /Does the same AI reason differently across borders/);
  assert.match(html, /Run 15 fixed, culturally neutral prompts/);
  assert.match(html, /Why we collect this data/);
  assert.match(html, /published only in aggregate for groups of at least five submissions/i);
  assert.match(html, /No raw IP stored/i);
  assert.match(html, /اردو/);
  assert.match(html, /\/images\/reasoning-across-cities-sketch\.jpg/);
  assert.match(html, /\/images\/how-to-contribute-sketch\.jpg/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/i);
});

test("uses one randomized core-2 session and submits the strict client contract", async () => {
  const [app, benchmark, submission] = await Promise.all([
    readFile(new URL("../app/BenchmarkApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/benchmark.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/submission.ts", import.meta.url), "utf8"),
  ]);

  assert.match(benchmark, /BENCHMARK_VERSION = "core-2\.0"/);
  assert.match(benchmark, /REASONING_TOKEN_TRAILER/);
  assert.match(benchmark, /REASONING TOKENS:/);
  assert.match(app, /window\.crypto\.getRandomValues/);
  assert.match(app, /shufflePromptOrder/);
  assert.match(app, /renderPromptForCopy/);
  assert.match(app, /sessionVariant/);
  assert.match(app, /promptOrder\.map\(\(promptId\)/);
  assert.match(app, /clientTimezone/);
  assert.match(app, /uiLanguage/);
  assert.match(app, /reasoningToggle/);
  assert.match(app, /memoryPersonalization/);
  assert.match(app, /customInstructions/);
  assert.match(app, /promptsTranslated: binaryFlag/);
  assert.match(app, /completedInOneSitting: binaryFlag/);
  assert.match(app, /regenerated: draft\.regenerated \? 1 as const : 0 as const/);
  assert.match(app, /responseSecondsBucket: draft\.responseSecondsBucket/);
  assert.match(app, /website: ""/);
  assert.match(submission, /EXPECTED_PROMPT_COUNT = 15/);
});

test("keeps token claims and raw-IP handling scientifically honest", async () => {
  const [app, copy, route, antiAbuse, page, layout] = await Promise.all([
    readFile(new URL("../app/BenchmarkApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/uiCopy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/antiAbuse.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(copy, /Raw IP is never stored/);
  assert.match(copy, /processed only transiently into an unlinkable daily HMAC counter/i);
  assert.match(copy, /self-reported by the model, not verified/i);
  assert.doesNotMatch(copy, /does not read (?:the )?IP|never reads (?:the )?IP/i);
  assert.match(route, /cf-connecting-ip/);
  assert.match(route, /reserveDailySubmission/);
  assert.match(antiAbuse, /HMAC/);
  assert.doesNotMatch(route, /INSERT INTO submissions[\s\S]*?ip_address/i);
  assert.doesNotMatch(app, /navigator\.geolocation|getCurrentPosition|document\.cookie|localStorage|gtag\(|mixpanel|posthog/i);
  assert.doesNotMatch(layout, /next\/font\/google|fonts\.googleapis\.com/i);
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview/);
});

test("gates submission on Turnstile and requests explicitly versioned results", async () => {
  const [app, widget, copy] = await Promise.all([
    readFile(new URL("../app/BenchmarkApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/TurnstileWidget.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/uiCopy.ts", import.meta.url), "utf8"),
  ]);

  assert.match(app, /<TurnstileWidget/);
  assert.match(app, /turnstileToken/);
  assert.match(app, /!turnstileToken/);
  assert.match(app, /fetch\(`\/api\/submissions\?benchmarkVersion=\$\{encodeURIComponent\(version\)\}`\)/);
  assert.match(copy, /13 objective items per run/i);
  assert.match(copy, /no confidence interval is shown/i);
  assert.doesNotMatch(app, /confidenceInterval/);
  assert.match(widget, /\/api\/config/);
  assert.match(widget, /challenges\.cloudflare\.com\/turnstile/);
  assert.match(widget, /expired-callback/);
});

test("publishes the complete bilingual participant protocol without translating prompts", async () => {
  const [app, copy, css, benchmark] = await Promise.all([
    readFile(new URL("../app/BenchmarkApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/uiCopy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/benchmark.ts", import.meta.url), "utf8"),
  ]);

  assert.match(app, /document\.documentElement\.dir/);
  assert.match(app, /lang="en" dir="ltr"/);
  assert.match(app, /aria-pressed=\{language === "ur"\}/);
  assert.match(copy, /fresh chat for every prompt/i);
  assert.match(copy, /first response/i);
  assert.match(copy, /24–48 hours later/i);
  assert.match(copy, /Do not publish or discuss the prompts or answers publicly/i);
  assert.match(copy, /ہر سوال کے لیے نئی چیٹ/);
  assert.match(copy, /۲۴–۴۸ گھنٹے بعد/);
  assert.match(copy, /ہم یہ معلومات کیوں جمع کرتے ہیں/);
  assert.match(css, /\[dir="rtl"\]/);
  assert.doesNotMatch(benchmark, /حل کریں|ترجمہ|ماڈل/);
});

test("offers every ISO alpha-2 country and territory code", async () => {
  const { COUNTRY_CODES } = await import("../lib/countries.ts");
  assert.equal(COUNTRY_CODES.length, 249);
  assert.equal(new Set(COUNTRY_CODES).size, 249);
  assert.ok(COUNTRY_CODES.includes("US"));
  assert.ok(COUNTRY_CODES.includes("PK"));
  assert.ok(COUNTRY_CODES.includes("AQ"));
});

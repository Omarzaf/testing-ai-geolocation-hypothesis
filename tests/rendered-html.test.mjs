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

test("server-renders the anonymous geolocation benchmark", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Reasoning Across Borders<\/title>/i);
  assert.match(html, /Does the same AI/);
  assert.match(html, /reason differently/);
  assert.match(html, /Start the benchmark/);
  assert.match(html, /City only/);
  assert.match(html, /no GPS or IP stored/i);
  assert.match(html, /اردو/);
  assert.match(html, /\/images\/reasoning-across-cities\.jpg/);
  assert.match(html, /\/images\/how-to-contribute\.jpg/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/i);
});

test("keeps the research interface free of identity and tracking collection", async () => {
  const [app, copy, route, page, layout] = await Promise.all([
    readFile(new URL("../app/BenchmarkApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/uiCopy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(copy, /City or nearest large city/);
  assert.match(copy, /No name or email/);
  assert.match(copy, /No GPS request/);
  assert.match(copy, /No IP address stored by this site/);
  assert.match(route, /HAVING COUNT\(\*\) >= 5/);
  assert.match(route, /quality_status = 'eligible'/);
  assert.doesNotMatch(route, /request\.headers|request\.cf|cf-connecting-ip|cf-ipcountry|user-agent/i);
  assert.doesNotMatch(app, /navigator\.geolocation|getCurrentPosition|document\.cookie|localStorage|gtag\(|mixpanel|posthog/i);
  assert.doesNotMatch(layout, /next\/font\/google|fonts\.googleapis\.com/i);
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview/);
  assert.doesNotMatch(layout, /Starter Project/);
});

test("supports Urdu RTL without changing fixed English benchmark prompts", async () => {
  const [app, copy, css, benchmark] = await Promise.all([
    readFile(new URL("../app/BenchmarkApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/uiCopy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/benchmark.ts", import.meta.url), "utf8"),
  ]);

  assert.match(app, /type Language/);
  assert.match(app, /document\.documentElement\.dir/);
  assert.match(app, /lang="en" dir="ltr"/);
  assert.match(app, /textarea id="model-response" dir="auto"/);
  assert.match(app, /aria-pressed=\{language === "ur"\}/);
  assert.match(copy, /کیا ایک ہی اے آئی مختلف جگہوں پر مختلف انداز سے سوچتا ہے/);
  assert.match(copy, /نہ بدلیں، نہ ترجمہ کریں/);
  assert.match(css, /\[dir="rtl"\]/);
  assert.match(benchmark, /Solve carefully\./);
  assert.doesNotMatch(benchmark, /حل کریں|ترجمہ/);
});

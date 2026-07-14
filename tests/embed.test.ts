import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GET as getEmbed } from "../app/embed/route.ts";

test("embed route is self-contained and intentionally frameable", async () => {
  const response = getEmbed();
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html/i);
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors \*/);
  assert.match(html, /Reasoning Across Borders/);
  assert.match(html, /fetch\('\/api\/stats'\)/);
  assert.doesNotMatch(html, /document\.cookie|localStorage|sessionStorage/);
});

test("stats route and website snippet expose aggregate fields only", async () => {
  const [statsRoute, snippet] = await Promise.all([
    readFile(new URL("../app/api/stats/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../docs/website-snippet.html", import.meta.url), "utf8"),
  ]);

  assert.match(statsRoute, /access-control-allow-origin.*\*/i);
  assert.match(statsRoute, /COUNT\(\*\) AS submissions/);
  assert.match(statsRoute, /COUNT\(DISTINCT LOWER\(city\)\) AS cities/);
  assert.doesNotMatch(statsRoute, /response_text|plan_label|submitted_day|SELECT\s+\*/i);
  assert.match(snippet, /api\/stats/);
  assert.match(snippet, /github\.com\/Omarzaf\/testing-ai-geolocation-hypothesis/);
  assert.match(snippet, /card above remains complete without it/i);
});

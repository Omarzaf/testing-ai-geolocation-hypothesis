import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("the repository uses one pinned package manager and CI runs the full gate", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.packageManager, "pnpm@10.15.0");
  assert.equal(existsSync("package-lock.json"), false);
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  for (const command of ["pnpm test", "pnpm lint", "pnpm exec tsc --noEmit", "pnpm build", "pnpm scoring:verify-no-leaks"]) {
    assert.match(workflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

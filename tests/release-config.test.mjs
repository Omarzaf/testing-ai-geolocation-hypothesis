import assert from "node:assert/strict";
import test from "node:test";
import { verifyReleaseConfig } from "../scripts/verify-release-config.mjs";

function releaseConfig(databaseId) {
  return {
    main: "index.js",
    assets: { binding: "ASSETS" },
    d1_databases: [{
      binding: "DB",
      database_name: "reasoning-across-borders",
      database_id: databaseId,
    }],
  };
}

test("release verification rejects local placeholders and incomplete builds", () => {
  assert.throws(
    () => verifyReleaseConfig(releaseConfig("00000000-0000-4000-8000-000000000000")),
    /placeholder D1 database/i,
  );
  assert.throws(
    () => verifyReleaseConfig({ ...releaseConfig("11111111-1111-4111-8111-111111111111"), main: "worker/index.ts" }),
    /built Worker entry point/i,
  );
});

test("release verification accepts an account-shaped generated binding", () => {
  assert.doesNotThrow(() =>
    verifyReleaseConfig(releaseConfig("11111111-1111-4111-8111-111111111111")),
  );
});

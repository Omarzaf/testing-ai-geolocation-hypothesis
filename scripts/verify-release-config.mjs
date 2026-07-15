import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const PLACEHOLDER_DATABASE_ID = "00000000-0000-4000-8000-000000000000";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function verifyReleaseConfig(config) {
  const databases = Array.isArray(config?.d1_databases) ? config.d1_databases : [];
  const database = databases.find((candidate) => candidate?.binding === "DB");

  if (config?.main !== "index.js") {
    throw new Error("Release config must target the built Worker entry point.");
  }
  if (!config.assets || config.assets.binding !== "ASSETS") {
    throw new Error("Release config is missing the built asset binding.");
  }
  if (!database || typeof database.database_id !== "string") {
    throw new Error("Release config is missing the DB binding.");
  }
  if (
    database.database_id === PLACEHOLDER_DATABASE_ID ||
    !UUID_PATTERN.test(database.database_id)
  ) {
    throw new Error(
      "Release config still uses a placeholder D1 database. Rebuild with an account-verified CLOUDFLARE_D1_DATABASE_ID.",
    );
  }
}

async function main() {
  const configPath = path.resolve(process.argv[2] ?? "dist/server/wrangler.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  verifyReleaseConfig(config);
  process.stdout.write("PASS release config uses a non-placeholder DB binding and built Worker assets.\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}

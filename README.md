# Reasoning Across Borders

Reasoning Across Borders is a public, anonymous benchmark for testing whether the
same consumer AI product behaves differently across geographic regions. The
current benchmark is `core-2.0`: 13 scored reasoning items plus two unscored
metadata probes, with two surface variants and a randomized order per run.

The app runs on Cloudflare Workers with D1. It intentionally has no account
system and does not ask participants for a name or email address. Participants
are instructed not to include personal information in any field or pasted model
response.

## Local development

Prerequisites: Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Useful checks:

```bash
pnpm test
pnpm scoring:test-private
pnpm scoring:verify-no-leaks
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

## Database

The Drizzle schema lives in `db/schema.ts`. Generated SQL is committed under
`drizzle/`:

- `0000_square_lester.sql` creates the original benchmark tables.
- `0001_tranquil_captain_marvel.sql` adds core-2 metadata, token-reporting,
  private-scoring, and rate-limit storage.

Generate a new migration after an intentional schema change with:

```bash
pnpm db:generate
```

Never edit a migration that has already been applied remotely.

## Private scoring material

Expected answers are deliberately absent from the public repository and client
bundle. The secure source file is `private/core-2-scoring.json`; the entire
`private/` directory is ignored by Git.

After receiving that file through a private channel, generate the D1 seed SQL:

```bash
pnpm scoring:seed
```

This creates `private/core-2-scoring.sql` with permissions limited to the local
user. Do not paste either private file into issues, logs, build output, or public
documentation.

## Runtime configuration

The Worker expects these bindings:

- `DB`: Cloudflare D1 database
- `ASSETS`: built site assets
- `TURNSTILE_SITE_KEY`: public Turnstile widget key
- `TURNSTILE_SECRET_KEY`: private Turnstile verification key
- `RATE_LIMIT_HMAC_SECRET`: at least 32 bytes, used with separate HMAC domains
  to sign six-hour benchmark-session assignments and derive rotating daily IP
  digests; raw IP addresses are never persisted

Keep secrets in Cloudflare's secret store. Do not add them to tracked files or
print them in logs.

Prompt variant and order are issued by `POST /api/session`, not chosen by the
browser. The client submits the signed contract in `X-Benchmark-Session`; the
submission route verifies its signature, expiry, benchmark version, and exact
assignment before abuse checks or scoring. A contract is accepted at most once.

## Release checklist

Production changes require an explicit human checkpoint before secrets,
migrations, private scoring rules, or a public deployment are changed.
The source-level `wrangler.jsonc` is input to the vinext build and is not a
deployable Worker configuration. Every remote command must use the generated
`dist/server/wrangler.json`, which contains the built entry point, assets, and D1
binding. Normal local builds intentionally use a non-deployable D1 placeholder;
never use that placeholder for a remote migration or deployment.

1. Verify the exact commit locally:

   ```bash
   pnpm test
   pnpm lint
   pnpm exec tsc --noEmit
   pnpm build
   ```

2. Confirm the built client, tracked tree, and all reachable Git history contain
   no expected answers:

   ```bash
   pnpm scoring:verify-no-leaks
   ```
3. After the production checkpoint, use a read-only Cloudflare account query to
   confirm the intended production D1 database ID. Rebuild with that verified ID,
   then validate the generated deployment configuration:

   ```bash
   env CLOUDFLARE_D1_DATABASE_ID="<verified database id>" pnpm build
   pnpm release:verify-config
   env WRANGLER_LOG_PATH=.wrangler/wrangler.log pnpm exec wrangler deploy --config dist/server/wrangler.json --dry-run
   ```

4. Apply the migration and private seed through that same verified generated
   configuration:

   ```bash
   env WRANGLER_LOG_PATH=.wrangler/wrangler.log pnpm exec wrangler d1 execute DB --config dist/server/wrangler.json --remote --file drizzle/0001_tranquil_captain_marvel.sql
   pnpm scoring:seed
   env WRANGLER_LOG_PATH=.wrangler/wrangler.log pnpm exec wrangler d1 execute DB --config dist/server/wrangler.json --remote --file private/core-2-scoring.sql
   env WRANGLER_LOG_PATH=.wrangler/wrangler.log pnpm exec wrangler d1 execute DB --config dist/server/wrangler.json --remote --command "SELECT COUNT(*) AS scoring_rows FROM benchmark_scoring_rules WHERE benchmark_version = 'core-2.0'"
   ```

5. Configure `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and
   `RATE_LIMIT_HMAC_SECRET` in Cloudflare's secret store for this Worker.
6. Deploy the verified build with the same generated configuration:

   ```bash
   env WRANGLER_LOG_PATH=.wrangler/wrangler.log pnpm exec wrangler deploy --config dist/server/wrangler.json
   ```

7. Complete one production submission, verify the stored row and derived
   fields, then remove only that marked test submission.
8. Verify the main site, `/embed`, and the aggregate-only `/api/stats` endpoint.

## Website integration

- `/embed` is the compact live project card for an iframe.
- `/api/stats` exposes only aggregate counts and permits cross-origin reads.
- `docs/website-snippet.html` is a dependency-free fallback project card for
  the owner's personal website.

## Privacy and analysis rules

- Results groups remain hidden until at least five eligible submissions exist.
- Cross-region claims require at least ten submissions per comparison cell.
- Non-English tested-product UI, VPN/unknown VPN state, regeneration,
  memory/custom instructions on or unknown, translated prompts, and
  multi-sitting runs are stored but excluded from primary analysis.
- Model-reported reasoning-token numbers are explicitly unverified self-reports;
  visible response length is estimated independently.
- Raw responses are never returned by the public results or stats endpoints.

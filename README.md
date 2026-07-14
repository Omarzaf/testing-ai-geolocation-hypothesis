# Reasoning Across Borders

Reasoning Across Borders is a public, anonymous benchmark for testing whether the
same consumer AI product behaves differently across geographic regions. The
current benchmark is `core-2.0`: 13 scored reasoning items plus two unscored
metadata probes, with two surface variants and a randomized order per run.

The app runs on Cloudflare Workers with D1. It intentionally has no account
system and never stores a participant name or email address.

## Local development

Prerequisites: Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Useful checks:

```bash
pnpm test
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
- `RATE_LIMIT_HMAC_SECRET`: at least 32 bytes, used to derive rotating daily IP
  digests; raw IP addresses are never persisted

Keep secrets in Cloudflare's secret store. Do not add them to tracked files or
print them in logs.

## Release checklist

Production changes require an explicit human checkpoint before secrets,
migrations, private scoring rules, or a public deployment are changed.

1. Run the complete local verification suite.
2. Confirm the built client and tracked tree contain no expected answers.
3. Apply the new D1 migration.
4. Seed all 30 private scoring rows (15 prompts × A/B).
5. Configure Turnstile and the rate-limit HMAC secret.
6. Deploy the exact verified commit to the existing Worker.
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
- VPN, regeneration, memory/custom instructions, translated prompts, and
  multi-sitting runs are stored but excluded from primary analysis.
- Model-reported reasoning-token numbers are explicitly unverified self-reports;
  visible response length is estimated independently.
- Raw responses are never returned by the public results or stats endpoints.

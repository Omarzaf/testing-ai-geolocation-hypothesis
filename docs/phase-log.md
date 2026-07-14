# Reasoning Across Borders core-2.0 phase log

Date: 2026-07-14  
Branch: `feat/benchmark-core-2`  
Protocol: each implementation area was checked by a separate reviewer; expected answers remain outside tracked files.

## Phase 0 — Repository hygiene

Verdict: **PASS**

- Private scoring source, cases, and generated SQL are ignored and mode `0600`.
- The answer-bearing implementation spec is ignored.
- The tracked tree and built client contain no private scoring files or sampled answer signatures.
- Release configuration defaults to the generated Worker config and contains no secrets.

Evidence: `bd980bf`, `0204d18`; coordinator leakage and permission checks.

## Phase 1 — Schema and API extensions

Verdict: **PASS**

- Schema and migration cover country, product configuration, protocol metadata, prompt order/variant, timing, regeneration, token-report fields, versioned scores, private scoring rules, and rotating anti-abuse counters.
- The submission API rejects unknown fields and invalid enums, enforces the complete ordered prompt contract, and preserves archived-version results.
- A clean local migration replay produced all five required tables, 30 scoring rows, and no foreign-key errors.

Evidence: `17cf0da`, `a7a5060`, `d9c3137`, `10b70c9`; backend reviewer verdict **PASS**.

## Phase 2 — core-2.0 prompts and private scoring

Verdict: **PASS**

- Fifteen culturally neutral prompts ship in two randomized variants: 13 scored items and two unscored probes.
- The scorer handles narrow Markdown wrappers, strict text constraints, declared final-answer semantics, ordered partial credit, decimal tolerance, and the documented trap cases.
- The answer-free public suite passes 43 tests.
- The ignored private suite passes 102 cases across all 30 variants; both A and B have a 26-point maximum.

Evidence: `d8ad8ef`, `72623ce`, `f2310b3`; independent scoring-auditor verdict **PASS**.

## Phase 3 — Token-reporting trailer

Verdict: **PASS**

- Every copied prompt includes the required reasoning-token trailer.
- Server-side extraction distinguishes a number, `unknown`, refusal, malformed text, and absence.
- Visible response estimates are stored separately, and every participant-facing reference labels model token counts as unverified self-reports.

Evidence: `2540404`, `a7a5060`; public scoring and rendered-surface tests.

## Phase 4 — Participant experience

Verdict: **PASS**

- The contribution flow, research-purpose explanation, consent text, protocol, methodology, and results interpretation are available in English and Urdu with RTL support.
- Setup captures truthful metadata, including product UI languages outside English/Urdu; non-protocol runs are stored but clearly identified as excluded from primary aggregates.
- The interface uses a simple pastel system and original sketch-style project images.

Evidence: `2540404`, `49c266f`, `bb798cb`; frontend and backend reviewer checks.

## Phase 5 — Anti-abuse and privacy

Verdict: **PASS**

- Turnstile is enforced server-side, bound to the `benchmark-submit` action, and fails closed with a five-second timeout.
- Daily rate limiting stores only a rotating HMAC digest; raw IP addresses are never persisted or logged.
- Request bodies are capped while streaming, the honeypot is enforced, duplicate ordering is locked, and public grouping labels reject markup and Unicode format controls.

Evidence: `a7a5060`, `d9c3137`, `10b70c9`, `bb798cb`; focused anti-abuse and submission tests.

## Phase 6 — Website integration

Verdict: **PASS**

- `/embed` provides a self-contained, frameable project card.
- `/api/stats` exposes aggregate counts only with read-only cross-origin access.
- `docs/website-snippet.html` provides dependency-free static and hydrated variants for the personal website.

Evidence: `49c266f`; embed and aggregate-surface tests.

## Phase 7 — Release and production verification

Verdict: **WAITING FOR HUMAN CHECKPOINT**

Completed locally:

- Production build and generated Wrangler dry-run.
- Public and private test suites, lint, and strict TypeScript.
- Clean migration replay, local private seed, deployment-binding inspection, and answer-leak scans.

Requires explicit owner approval:

- Run the local preview outside the OS sandbox for browser and RTL/responsive QA.
- Configure production Turnstile and rate-limit secrets.
- Apply the remote D1 migration and private scoring seed.
- Deploy the public Worker, run one marked production submission, verify it, and remove only that test row.
- Push the feature branch and open a pull request.

No production resource, remote database, secret, or GitHub branch was changed during the implementation phases above.

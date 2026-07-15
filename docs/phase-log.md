# Reasoning Across Borders core-2.0 phase log

Date: 2026-07-14  
Branch: `feat/benchmark-core-2`  
Protocol: role-separated audits were run after the local implementation. This log records what was actually verified and does not imply that unrun browser, D1, or production checks passed. Expected answers remain outside tracked files.

## Phase 0 — Repository hygiene

Verdict: **LOCAL PASS; RELEASE CHECK PENDING**

- The answer-bearing implementation spec and the entire `private/` scorer directory are ignored.
- Private scorer source, cases, and generated SQL are mode `0600`.
- The local build deliberately contains an all-zero D1 placeholder. `pnpm release:verify-config` fails closed until an account-verified database ID is supplied at build time.
- The durable leak gate derives 82 distinctive private answer signatures and numeric equivalents without printing them; none matched the final tracked tree, current build, or any blob reachable from current Git history. It catches both fraction and decimal forms of the previously exposed B3 answer. The feature branch has not been pushed.
- The final release gate must repeat the tracked-tree and built-output answer scan after the account-specific build.

## Phase 1 — Schema and API extensions

Verdict: **LOCAL PASS; D1 ACCEPTANCE PENDING**

- The schema and migration cover location, product configuration, protocol metadata, prompt order and variant, regeneration, timing, token-report fields, versioned private scoring, and rotating rate-limit counters.
- Submission validation rejects unknown fields, invalid enums, invalid country codes, malformed labels, duplicate or missing prompts, and oversized bodies.
- A clean SQLite compatibility replay created all five required tables, loaded 30 private scorer rows, reported zero duplicate scorer keys, and reported no foreign-key failures.
- A clean Wrangler D1-emulator replay still requires explicit approval because the emulator must bind localhost outside the current sandbox. The remote D1 round-trip is also pending.

## Phase 2 — core-2.0 prompts, assignment, and private scoring

Verdict: **LOCAL PASS; DEPLOYED ROUND-TRIP PENDING**

- The implementation follows the explicit item list in the spec: 15 prompts per run, comprising 13 scored items and two unscored probes. The spec's earlier “14 items / 12 scored” shorthand conflicts with its own A1–A3, B1–B6, C1–C4, M1–M2 enumeration.
- Every prompt has an answer-free A and B surface variant; the server issues the variant and order in a signed, six-hour session contract.
- Submission rejects a missing, expired, tampered, wrong-version, wrong-order, or caller-selected assignment before Turnstile, rate-limit, scoring, or persistence work.
- The signed contract ID is hashed into the existing unique `answer_hash` column, making one contract single-use while allowing identical outputs from separately issued sessions.
- This deliberately repurposes the legacy content-hash field for core-2. Cross-session exact-output duplicates are no longer rejected; duplicate-risk mitigation instead uses single-use contracts, the five-per-day connection limit, and repetition flags. Preserving both independent constraints would require an additional unique session-contract column and owner-approved schema migration.
- The public scorer suite covers generic rule semantics without publishing expected benchmark answers. The ignored private matrix passes 209 explicit cases across all 30 prompt variants, plus automatic retraction mutations of 58 positive scored responses. Coverage includes same-line and later-line retractions, question-and-answer rejections, negated arithmetic work and intermediate sequences, A/B-equivalent probability work, correct paraphrases, the documented C3 method-or-zero rubric, competing and retracted denominator claims, contradiction synonyms, contradictory set and ordering relations, spelled-out fabricated totals, strict field structure, and documented traps.
- Both variants have a 26-point scored maximum. A separate scorer audit re-derived and attacked the rubric; the final terminal-answer repair passed all eight targeted A1/B1/B3/C1 A/B retraction checks.

## Phase 3 — Token-reporting trailer

Verdict: **LOCAL PASS**

- Every copied prompt includes the required reasoning-token trailer.
- Server-side extraction distinguishes numeric self-report, `unknown`, refusal, malformed text, and absence.
- Visible response estimates are stored separately. Participant copy consistently labels model-reported reasoning tokens as unverified self-reports rather than measurements.

## Phase 4 — Participant experience

Verdict: **SOURCE AND AUTOMATED TEST PASS; BROWSER WALKTHROUGH PENDING**

- The contribution flow, research-purpose explanation, consent summary, methodology, participant protocol, and results interpretation are present in English and Urdu.
- Setup records product and protocol metadata. Runs that violate the primary protocol are stored but excluded or flagged rather than silently discarded.
- The UI uses the requested pastel visual system and sketch-style project images.
- The privacy copy says that personal information is not requested and instructs participants not to paste it; it no longer makes the false absolute claim that free-text fields can never contain personal information.
- A first-time-user walkthrough in both languages, including RTL, keyboard, responsive, and error-state checks, remains pending because browser/local-server access needs explicit sandbox approval.

## Phase 5 — Anti-abuse and privacy

Verdict: **LOCAL LOGIC PASS; RUNNING-WORKER ACCEPTANCE PENDING**

- Turnstile is enforced server-side, bound to `benchmark-submit`, and fails closed.
- Daily limiting uses an atomic D1 counter keyed by a rotating HMAC digest. Raw IP addresses are neither persisted nor sent to Turnstile.
- The UI now contains a real visually hidden honeypot field; non-empty bot submissions receive a decoy success without storage.
- Request size, label safety, prompt completeness, and session replay are enforced server-side.
- Unit tests prove the five-attempt counter boundary. The spec's live acceptance test—more than five scripted submissions against a running Worker—remains pending.
- Known operational warning: after Turnstile succeeds, sequential replay detection and scorer loading happen before the daily rate reservation, but the reservation still precedes batch persistence. A concurrent replay or later D1 batch failure can therefore consume an attempt.

## Phase 6 — Website integration

Verdict: **ARTIFACT AND SOURCE TEST PASS; BROWSER ACCEPTANCE PENDING**

- `/embed` is a self-contained frameable project card.
- `/api/stats` returns aggregate counters only and permits read-only cross-origin access.
- `docs/website-snippet.html` contains dependency-free static and hydrated variants.
- Rendering from `file://`, a different-origin page, and a bare pasted HTML page remains pending browser verification.

## Phase 7 — Release and production verification

Verdict: **WAITING FOR EXPLICIT OWNER APPROVAL**

Completed locally:

- Production build, public tests, private scorer matrix, lint, and strict TypeScript.
- SQLite compatibility migration replay and private scoring seed.
- Fail-closed release-configuration checks, private-file permission checks, and answer-leak scans.

Not yet run:

- Local Wrangler D1-emulator replay and browser/RTL/responsive QA.
- Read-only Cloudflare lookup to identify the authoritative D1 database and current Worker configuration.
- Production secret inspection or changes, remote migration, private scoring seed, Worker deployment, marked production submission, D1 row verification, and test-row cleanup.
- Live verification of the main site, `/embed`, `/api/stats`, Turnstile, rate limiting, CORS, and single-use session replay.
- GitHub push and pull request.

No production resource, remote database, secret, public deployment, or GitHub branch was changed during the local implementation.

## Review history

- Scoring auditor: independently attacked all A/B rubric rules and maintained the private expected-answer matrix.
- Core adversarial reviewer: found and re-tested terminal-answer retraction exploits and reviewed the signed session contract.
- Experience/security reviewer: identified the missing real honeypot, overbroad privacy wording, unproven browser gates, and unsafe unverified D1 binding.
- Architecture reviewer: identified caller-controlled assignment as an integrity flaw and specified the signed server-issued session contract.
- Final moderator: found one public synthetic-answer leak and five contradiction/retraction scorer families; the public fixture was replaced and all identified families received explicit plus mutation-based regression coverage.
- Coordinator: repaired the findings, reran local gates, and preserved all external acceptance items as pending.

# Security fixes: handoff for the next agent

Written 2026-10-16 by Claude Code at the owner's request, so that Codex (or any other agent, or a person) can carry on exactly where this work stopped, without the original chat. Everything needed to continue is in this folder or in the pull requests it points to.

## 0. The 60-second version

- A read-only security audit of this repository found **118 issues** (5 High, 30 Medium, 66 Low, 17 Info). Since then they are being fixed one at a time, each as its own small pull request **into `staging`**, with tests.
- **Done:** 24 findings fixed with tests — 5 merged into `staging`, 19 in open PRs waiting for the owner to merge. 3 more are partly fixed. Table: [`STATUS.md`](STATUS.md).
- **Next:** [`QUEUE.md`](QUEUE.md) is the ordered list of the 32 findings that need no decision from the owner (start at the first one nobody has done yet).
- **Not yours to start:** [`DECISIONS-AND-OPS.md`](DECISIONS-AND-OPS.md) — 31 rules/trade-offs only the owner can decide, and 28 ops/CI/database items.
- **How to do a fix, run the checks, write the PR, and what went wrong before:** [`METHOD.md`](METHOD.md).
- **The detailed audit report is private** and is not in this public repository: section 6.

## 1. Rules from the owner (these override everything else)

1. All changes are pull requests **into `staging`**. Never open, approve or merge a `staging` → `main` PR (the owner releases to production). Never merge or approve any PR; the owner merges.
2. Do not build anything from `DECISIONS-AND-OPS.md` without the owner's answer. Do not make schema changes (new tables, columns, enum values) without the owner: they need SQL run on Supabase first.
3. No hard deletes of business data; `/api/public/**` never exposes costs, profit, stock levels, staff data or internal IDs; UI text needs English and Nepali; touch targets at least 44 px. See `CLAUDE.md`.
4. Standing instruction from the owner for this series (2026-10-15/16): keep fixing the decision-free findings one after another, a PR for each, watch CI and fix anything red, without asking before each one. For anything outside the queue, follow `CLAUDE.md` ("show the plan and wait for confirmation before touching a file").
5. Never commit the private report to this public repository.
6. Never skip, disable or quarantine a test to get green. Never rewrite history on a pushed branch.

## 2. Where things stand (2026-10-16, about 15:30 UTC)

**Merged into `staging` by the owner:** #124 (P0-16), #125 (P0-01 and part of P0-12), #126 (P0-04, F-03), #127 (K-03).

**Open PRs into `staging`** (CI had no failing checks at the last look; the owner merges in number order and uses "Update branch" on the rest):

| PR | Findings | Branch |
|---|---|---|
| #128 | P0-02 | `fix/server-checks-sale-amount-against-litres-and-price` |
| #129 | K-02 | `fix/beekeeping-dashboard-and-order-list-load-only-what-they-show` |
| #130 | K-01 | `fix/petrol-sale-looks-up-the-purchase-rate-without-loading-all-history` |
| #131 | F-06 | `fix/sale-extra-details-cannot-be-megabytes-large` |
| #132 | P1a-04 | `fix/staff-cannot-close-tomorrows-books-in-advance` |
| #133 | P0-17 | `fix/login-failure-counter-cannot-be-filled-with-giant-usernames` |
| #134 | G-01, D-01 | `fix/numbers-sent-from-outside-cannot-have-huge-exponents` |
| #135 | A-01, P1B2-01 (stacked on #133) | `fix/login-burst-cannot-bypass-the-wrong-password-limit` |
| #136 | F-01 | `fix/oversized-request-bodies-are-refused-before-they-are-read` |
| #137 | P0-03, P1b-03 audit part (stacked on #131) | `fix/manager-edits-and-reviews-leave-a-full-before-and-after-record` |
| #138 | P1a-03 | `fix/rotating-a-charger-secret-disconnects-the-connection-using-the-old-one` |
| #139 | P1b-01 (stacked on #135) | `fix/own-profile-save-cannot-undo-a-demotion-deactivation-or-password-reset` |
| #140 | P0-09 | `fix/delivery-status-only-changes-furniture-orders-to-a-real-status` |
| #141 | P0-07 | `fix/legacy-public-furniture-and-ev-pages-hide-hidden-items-and-database-ids` |
| #142 | I-01 | `fix/ordinary-client-mistakes-answer-4xx-not-500-and-do-not-flood-the-log` |
| #143 | P0-08, P1b-08 fuel part (stacked on #134) | `fix/fuel-prices-are-range-checked-and-price-changes-leave-an-audit-row` |
| #145 | P1b-08 charger stop/unlock part | `fix/charger-stop-and-unlock-commands-are-recorded-with-the-person-who-sent-them` |
| #149 | F-02 | `fix/refused-ev-start-does-not-leave-its-plate-photo-on-disk` |

**Owner's own PRs (not part of this series):** #148 is a `staging` → `main` release PR. It shows "out-of-date with the base branch" because `main` holds four release merge commits (#118, #123, #144, #147) that `staging` does not. The usual cure is a PR into `staging` that merges `main` in (precedent: #121). That needs the owner's go-ahead; do not do it unasked.

**In progress when this was written:** P1B1-01 (queue item 1). Design is in `QUEUE.md`; nothing is pushed yet, start from `origin/staging`.

**Quick start**

1. `git clone` the repo, `git fetch origin`, read `CLAUDE.md`, then this folder.
2. Look at the open PRs above. If one has a red check, open the failing job log and fix it on that branch with a new commit.
3. Take the first item in `QUEUE.md` that has no PR yet (search PR bodies for the ID: `repo:SandeepN97/samjhana-ventures-os is:pr "<ID>" in:body`) and follow `METHOD.md`.
4. From time to time refresh `STATUS.md` and the PR table above in a small docs PR.

## 3. What the finding IDs mean

`P0-xx` baseline pass; `P1a-xx` / `P1b-xx` business-rule invariants; `P1B1/2/3/X-xx` review of the PR history; letters are topic passes: A login and passwords, B who may do what, C payments and cash, D charger and live-feed WebSockets, E logging, F uploads and sizes, G numbers/dates/plates, H public website, I errors and configuration, J build/CI/supply chain, K performance and availability, L privacy, M fuel-price scraper, N database. `P3-01` architecture. Severity labels were adjusted after a second look (`reference/severity-overrides.json`).

## 4. Environment

- Backend: Java 21, Spring Boot 3.5, Maven; tests run on H2, production is PostgreSQL (Supabase) on Render. Frontends: React 18 + Vite + Tailwind (`samjhana-admin` private ERP UI, `samjhana-web` public site).
- No external service is needed for the test suite. Commands: [`METHOD.md`](METHOD.md) section 2.
- Profiles (`dev`, `staging`, `prod`, `test`) and what is seeded where: `CLAUDE.md`.
- Each fix was made in its own `git worktree` next to the main checkout; those folders were in the original container and are gone with it. Recreate with `git worktree add`.

## 5. Conventions

Branch `<category>/<what-it-does>`, commit `<category>: <what changed>`, PR into `staging`, body with a "Tooling check" section. Details and the PR body outline: [`METHOD.md`](METHOD.md) section 4 and `CLAUDE.md`.

## 6. The private full report

The complete audit (about 2.8 MB: every finding with the quoted code, the path an attacker would take, the exact fix and a test idea; attack chains; second-look verdicts; the checks that need the live systems; draft patches for the High findings) is **deliberately not in this repository, because the repository is public** and the report is a map of weak spots, many still unfixed. In this folder, items that still need a decision or an ops action are worded neutrally for the same reason.

It lives in the original working container at `docs/security/` (git-excluded) and the owner was sent a copy as `samjhana-security-report-full.zip`. To use it: unzip at the repository root so the files land in `docs/security/`, then add `docs/security/` to `.git/info/exclude` (a local file, never committed) so it cannot be committed by accident.

What is in it: `findings.md` (one section per ID: `### <ID> | <title>` ... Location, Quoted code, Trace, Mitigations, Attacker steps, Impact, Exact fix, Regression test idea), `findings-index.md` (one line per finding), `SUMMARY.md` and `summary-notes.md` (final write-up and priorities), `attack-chains.md`, `reverification.md`, `TOMORROW-TESTS.md` and `verify-tomorrow.md` (checks that need the live systems), `patches/` (draft fixes), `passes/` (raw per-pass output), `threat-model.md`, `entrypoints.md`, `role-matrix.md`, `pr-timeline*.md`, `prior-audit-baseline.md`, `branch-map.md`, `smells.md`, `not-reviewed.md`, `PROGRESS.md` (audit log), `RULES.md`.

If the private copy is not available you can still do everything in `QUEUE.md`: each entry has the location, the fix and a test idea. If you need more detail, ask the owner; do not try to reconstruct and publish exploit steps.

## 7. Other Claude Code material that is not part of the product

- `reference/AUDIT-RULES.md`: the rules the audit agents followed (evidence format, finding format, how to work). Use it if you add new findings.
- `reference/agents/`: the two audit agent definitions (`auditor-deep`, `auditor-scan`), kept as reference copies. They are **not** active agent configuration.
- `tools/mutate.py` and `tools/example-mutations.json`: the deliberate-break checker (METHOD.md section 3).
- `reference/severity-overrides.json`: severity changes after the second look.
- Not included on purpose: the chat transcript (large and private), `graphify-out/` (generated, git-ignored; `graphify update .` rebuilds it, optional), and the audit bookkeeping scripts (not needed to continue).
- The best record of each fix is its pull request body.

## 8. Index of this folder

| File | What it is |
|---|---|
| `README.md` | this guide |
| `STATUS.md` | all 118 findings with their status and PR |
| `QUEUE.md` | what to fix next (no decision needed), with fix and test ideas |
| `DECISIONS-AND-OPS.md` | what waits for the owner, and ops/CI/database items |
| `METHOD.md` | the routine, commands, mutation checks, PR body, gotchas |
| `tools/` | `mutate.py`, `example-mutations.json` |
| `reference/` | audit rules, agent definitions, severity overrides |

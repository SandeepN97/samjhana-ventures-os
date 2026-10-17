# Security fixes: handoff for the next agent

Written 2026-10-16 by Claude Code at the owner's request (refreshed 2026-10-17, after every pull request of the series had been merged into `staging`), so that Codex (or any other agent, or a person) can carry on exactly where this work stopped, without the original chat. Everything needed to continue is in this folder or in the pull requests it points to.

## 0. The 60-second version

- A read-only security audit of this repository found **118 issues** (5 High, 30 Medium, 66 Low, 17 Info). Since then they are being fixed one at a time, each as its own small pull request **into `staging`**, with tests.
- **Done:** 46 findings fixed with tests, all merged into `staging` (four of them, M-01 to M-04, because the owner had the NOC price scraper removed instead of repaired). 3 more are partly fixed and 2 were already fine. Table: [`STATUS.md`](STATUS.md). Nothing from this series is waiting for a merge; the `staging` → `main` release PR (#173) is the owner's.
- **Next:** [`QUEUE.md`](QUEUE.md) is the ordered list of the 8 findings that still need no decision from the owner (start at the first one nobody has done yet). [`DECISIONS-MADE.md`](DECISIONS-MADE.md) holds what the owner decided on all 32 questions (2026-10-17) and what to build for each, in groups G1 to G9.
- **Not yours to start:** the 27 ops/CI/database items in [`DECISIONS-AND-OPS.md`](DECISIONS-AND-OPS.md). Everything that still needs the owner (hosting, database and CI choices, release timing, assumptions to confirm), with options and a recommendation, is in [`OWNER-QUESTIONS.md`](OWNER-QUESTIONS.md) sections B to D.
- **How to do a fix, run the checks, write the PR, and what went wrong before:** [`METHOD.md`](METHOD.md).
- **The detailed audit report is private** and is not in this public repository: section 6.

## 1. Rules from the owner (these override everything else)

1. All changes are pull requests **into `staging`**. Never open, approve or merge a `staging` → `main` PR (the owner releases to production). Do not merge or approve a PR unless the owner asks you to in that conversation (on 2026-10-17 the owner asked for the whole series to be merged into `staging` one after another, and it was; that does not carry over to later PRs).
2. Do not build anything from `DECISIONS-AND-OPS.md` without the owner's answer. Do not make schema changes (new tables, columns, enum values) without the owner: they need SQL run on Supabase first.
3. No hard deletes of business data; `/api/public/**` never exposes costs, profit, stock levels, staff data or internal IDs; UI text needs English and Nepali; touch targets at least 44 px. See `CLAUDE.md`.
4. Standing instruction from the owner for this series (2026-10-15/16): keep fixing the decision-free findings one after another, a PR for each, watch CI and fix anything red, without asking before each one. For anything outside the queue, follow `CLAUDE.md` ("show the plan and wait for confirmation before touching a file").
5. Never commit the private report to this public repository.
6. Never skip, disable or quarantine a test to get green. Never rewrite history on a pushed branch.

## 2. Where things stand (2026-10-17, about 07:33 UTC)

**Every pull request of the series is merged into `staging`:** #124 (P0-16), #125 (P0-01 and part of P0-12), #126 (P0-04, F-03), #127 (K-03), #128 (P0-02), #129 (K-02), #130 (K-01), #131 (F-06), #132 (P1a-04), #133 (P0-17), #134 (G-01, D-01), #135 (A-01, P1B2-01), #136 (F-01), #137 (P0-03 and the audit part of P1b-03), #138 (P1a-03), #139 (P1b-01), #140 (P0-09), #141 (P0-07), #142 (I-01), #143 (P0-08 and the fuel part of P1b-08), #145 (the charger stop/unlock part of P1b-08), #149 (F-02), #151 (P1B1-01), #152 (P1a-10), #153 (P0-13), #154 (the decision-free part of P1b-02), #156 (B-01), #157 (P0-14), #158 (E-01, L-01), #160 (D-02, P1b-06), #161 (P0-11, P1a-13), #162 (P1a-16), #164 (P1a-05), #165 (P1B1-02), #166 (F-05), #167 (the NOC price scraper removed: M-01 to M-04 no longer apply), #168 (A-02).

#124 to #132 were merged by the owner on 2026-10-16. The others were merged on 2026-10-17, one at a time, each after the branch was brought up to date with `staging` (GitHub's "Update branch", or a local merge where that failed), a green CI run and a merge commit (never squash). #134, #135, #139, #154 and #161 show as merged because the branch of another PR contained all their commits (#137 for #134, #167 for #135, #168 for #139 and #154, #165 for #161), so GitHub saw them inside `staging` once that PR was merged.

**Not part of the series:** #150 is this handoff folder (docs only). #155 (database and security production-readiness checklists) was merged into `main` by the owner on 2026-10-17. **#173 ("Staging", `staging` → `main`) is the owner's release PR**: it carries everything above to production when the owner decides. #174 merged `main` into `staging` so that #173 is not blocked as out of date. Do not open, approve or merge a release PR yourself. Earlier release PRs were #118, #123, #144, #147, #148, #159 and #163. #171 ("Redesign admin website management UI") also landed in `staging` in between and is unrelated. When a release PR shows "out-of-date with the base branch", the usual cure is a PR into `staging` that merges `main` in (precedent: #121); that needs the owner's go-ahead.

**What went wrong while merging, and the cure** (also in `METHOD.md` section 6):

- A merge that is clean for git can still break the build. After #128 (P0-02) `TransactionService` took a `FuelPriceRepository`, so `TransactionAuditTrailTest` (#137), which builds the service by hand, stopped compiling. CI failed within a minute on a test-compile error; the fix was one mock and one constructor argument.
- #160 once failed in CI before any test ran, because Maven Central could not be reached for a plugin. That is an infrastructure failure, not a code failure. The Claude Code integration cannot re-run a job (403), so the PR was updated again after another merge, which started a fresh run.
- GitHub's "Update branch" answered "merge conflict between base and head" for #168, although `git merge` of `origin/staging` into the branch was clean (the branch and `staging` had two merge bases after the stack was merged). Merging `origin/staging` into the branch locally, running the checks and pushing fixed it.

**In progress when this was written:** nothing is half-done and nothing is unpushed: every branch has been merged. The owner decided the NOC fuel-price scraper should not exist at all, so it was removed (#167) and its four findings (M-01 to M-04) were closed that way instead of being hardened; prices are entered by hand on the Fuel Price page. The owner paused the series on 2026-10-17 to merge everything first and to keep the test site awake (#170); ask before starting `QUEUE.md` item 1. Later the same day the owner answered all 32 decision questions in a one-topic-at-a-time session; the answers and the build plan are in `DECISIONS-MADE.md`.

**Quick start**

1. `git clone` the repo, `git fetch origin`, read `CLAUDE.md`, then this folder.
2. List the open PRs (`repo:SandeepN97/samjhana-ventures-os is:pr is:open`). If one touches the files you plan to change, say "stacked on #NNN" in your PR; if one has a red check that belongs to this series, open the failing job log and fix it on that branch with a new commit.
3. Take the first item in `QUEUE.md` that has no PR yet, or a decided group in `DECISIONS-MADE.md` (post the plan block first; the owner asked to see it), (search PR bodies for the ID: `repo:SandeepN97/samjhana-ventures-os is:pr "<ID>" in:body`) and follow `METHOD.md`.
4. From time to time refresh `STATUS.md` and the list in section 2 in a small docs PR.

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
| `DECISIONS-MADE.md` | what the owner decided (all 32), what to build for each (groups G1 to G9), the real-charger test |
| `OWNER-QUESTIONS.md` | everything still waiting for the owner: hosting, database and CI items (B), other open items (C), assumptions to confirm (D); the rules in A are answered |
| `DECISIONS-AND-OPS.md` | the original questions for the owner, and ops/CI/database items |
| `METHOD.md` | the routine, commands, mutation checks, PR body, gotchas |
| `tools/` | `mutate.py`, `example-mutations.json` |
| `reference/` | audit rules, agent definitions, severity overrides |

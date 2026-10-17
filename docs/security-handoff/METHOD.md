# How the fixes are made (method, commands, gotchas)

This is the routine that produced PRs #124–#158 (and the live-feed branch after them). Follow it so new work looks and checks the same way.

## 1. The loop for one finding

1. **Pick** the next entry in `QUEUE.md`. Read the code it names (line numbers have drifted) and the finding's fix idea.
2. **Branch** from the latest `origin/staging` (or from an open PR's branch if you must touch the same code, see "Stacked PRs"):
   ```bash
   git fetch origin
   git worktree add ../wt-<short-name> -b fix/<what-it-does-in-kebab-case> origin/staging
   ```
   Branch name format is in `CLAUDE.md` (`fix/`, `api/`, `docs/` ...); the name says what the change does, not "security fix 3".
3. **Test first (RED).** Write the tests that describe the correct behaviour, run them, and watch them fail for the right reason on the unchanged code. Include a happy path, at least one edge case and one failure case (CLAUDE.md "Testing").
4. **Implement (GREEN)** the smallest change that makes them pass. Do not widen the PR.
5. **Run the whole backend suite** (see commands). Everything must pass.
6. **Deliberate-break check ("mutation check").** Break the new code on purpose in several ways, one at a time, and confirm a test fails each time (section 3). A break that no test notices means a missing test: add it.
7. **Commit** (`<category>: <what changed>`), push the branch, open a PR **into `staging`** with the body described in section 4.
8. **Watch CI.** If a check goes red, read the job log, fix it on the same branch with a new commit (never force-push, never skip or disable a test, never push an empty commit to re-run).

One finding (or a tight group) per PR. Do not touch the "owner decision" items in `DECISIONS-AND-OPS.md`.

## 2. Commands

Backend (Java 21, Spring Boot 3.5, Maven). Run from the worktree root:

```bash
# one or a few test classes (fast, ~1-2 min)
SPRING_PROFILES_ACTIVE=test mvn -B -q test -Pdev -Dtest=ClassOneTest,ClassTwoTest

# the whole backend suite (10-15 min; CI runs the same thing in "Backend Coverage Gate")
SPRING_PROFILES_ACTIVE=test mvn -B -q verify -Pdev > /tmp/verify.log 2>&1; echo EXIT=$?
```

Count the tests that ran (put the number in the PR body):

```bash
python3 - <<'EOF'
import glob, re
tot=err=fail=skip=0
for f in glob.glob('target/surefire-reports/TEST-*.xml'):
    m=re.search(r'tests="(\d+)" errors="(\d+)" skipped="(\d+)" failures="(\d+)"', open(f,encoding='utf-8',errors='ignore').read(2000))
    if m:
        t,e,s,fl=map(int,m.groups()); tot+=t; err+=e; skip+=s; fail+=fl
print('tests',tot,'errors',err,'failures',fail,'skipped',skip)
EOF
```

Frontend (only if you change `samjhana-admin` or `samjhana-web`): `npm ci`, `npm test`, `npm run lint` inside the folder (see `CONTRIBUTING.md` "Verification" and `.github/workflows/ci.yml`). Every UI string needs `en` and `ne` text in `samjhana-admin/src/i18n/index.js`.

CI per PR (13 checks): Backend Unit Tests, Backend Integration Tests, Backend Coverage Gate (the whole suite), Production Build (needs the gate), Admin Frontend Tests, Public Frontend Tests, Lint (admin, web), Dependency Audit (admin, web), Admin + Public End-to-End Tests (Playwright), Secret Scan (Gitleaks), Weekly Security Scan (skipped on PRs).

## 3. Deliberate-break ("mutation") checks

`tools/mutate.py` applies each break from a JSON file to the working tree, runs the named tests, restores the file, and records `CAUGHT` or `SURVIVED`:

```bash
python3 docs/security-handoff/tools/mutate.py <worktree-dir> <output-dir> <default-test-classes> <spec.json>
# summary: <output-dir>/summary.txt   one line per break, "DONE" at the end
```

Spec format (see `tools/example-mutations.json`, the real one used for PR #149):

```json
[{"name": "X01-no-cleanup-registered",
  "file": "src/main/java/com/samjhana/service/ChargeSessionService.java",
  "old": "            removeIfTheStartIsRolledBack(photoPath);\n",
  "new": "",
  "tests": "ChargeSessionServiceTest"}]
```

Rules that matter:

- `old` must occur **exactly once** in the file, otherwise the script reports `SETUP-ERROR`.
- Every break must still **compile**. A break that does not compile makes the test run fail and looks like `CAUGHT` but proves nothing. Look in `<output-dir>/<name>.log` for `COMPILATION ERROR`, and redo that break in a form that compiles. (This bit us twice.)
- Think of the breaks as "what would a careless future edit do": remove the check, flip a comparison, use the wrong field, drop the user from the audit row, forget the after-commit hook.
- All breaks must be `CAUGHT` before you open the PR. State the count in the PR ("Seven deliberate breaks ... each made a test fail").
- After the run, `git status` must be clean apart from your own changes.

## 4. The PR

Open it **into `staging`**. Title: `fix: <what now works>` in plain words. Body (copy the shape of PR #145 or #149):

```
## Summary            one paragraph: the finding ID and what it protected
## What was wrong     how it could go wrong, in plain words (no step-by-step recipe)
## What changed       bullets
## Not changed        what you deliberately left alone
## Tests              new tests, "written test-first and watched failing", N deliberate breaks, `mvn verify -Pdev`: N tests, 0 failures
## Deploy notes       "Code only: no SQL, no settings." or the SQL file and what to set
## Tooling check      SkillSpector: not run: <reason> (or the result)
                      Context7: not run: <reason> (or the lookups and whether they held up)
```

The Tooling check heading is required by `CLAUDE.md`. Never write that a tool passed when it did not run.

Attribution lines are whatever your tool requires; the Claude Code commits carry a `Co-Authored-By` trailer.

### Stacked PRs

If your change touches code that an **open** PR also changes, branch from that PR's branch instead of `staging`, and say "stacked on #NNN" at the top of the PR. In the first series the stacks were #135 on #133, #139 on #135, #137 on #131, #143 on #134, #154 on #139, #165 on #161 and #168 on #154; all of them are merged now. When the base PR is merged, merge `origin/staging` into your branch (a normal merge commit, no rebase) and the PR shrinks to its own change. The owner merges PRs in number order and uses "Update branch" on the rest.

## 5. Hard rules (from the owner)

- Never merge or approve a PR unless the owner asks you to in that conversation (the whole first series was merged into `staging` on 2026-10-17 at the owner's request; that does not carry over). Never open, approve or merge a `staging` → `main` PR (the owner releases).
- Never rewrite history on a pushed branch (no rebase, amend or force-push); merge `staging` in instead.
- Never skip, disable or quarantine a test to get green; never push an empty commit to re-run CI.
- No hard deletes of business data (`deletedAt` soft delete). Deleting a file the service itself just wrote for a failed request is fine (PR #149).
- `/api/public/**` must never expose cost, profit, stock levels, staff data or internal IDs.
- If a fix needs a new table, column or enum value, stop: schema changes need SQL under `docs/sql/` run on Supabase **before** the deploy (staging uses `ddl-auto: validate`) and are the owner's call. Audit rows must use existing `AuditLog.EntityType` values and a non-null user (Postgres check constraints).
- Do not commit the private audit report (README section 6).

## 6. Gotchas we hit (read before writing tests)

- **Stale write-back.** Saving a whole detached entity can undo a concurrent change to a different column (found for `User` in PR #139 and `ChargePoint` in PR #138). Use a targeted `@Modifying @Query` update (with `clearAutomatically`/`flushAutomatically`, `@Transactional`) or `@DynamicUpdate`.
- **After-commit work.** Use `AfterCommit.run(...)`. If that work needs its own database write, mark the method `@Transactional(propagation = REQUIRES_NEW)`: the outer transaction is already committed, and joining it silently loses the write (this made a charger stay ONLINE in PR #138 until a real-WebSocket test showed it).
- **MockMvc does not serialize multipart or chunked bodies.** To test upload and body-size limits use a real server (`@SpringBootTest(webEnvironment = RANDOM_PORT)` with `java.net.http.HttpClient`), as `RequestBodyLimitRealServerIntegrationTest` does (PR #136).
- **`@Transactional` integration tests:** call `entityManager.clear()` before re-reading; a lazy `User` proxy used outside a session throws `LazyInitializationException`, so compare ids.
- **`@SpyBean` on a Spring Data repository with `callRealMethod`** fails ("Cannot call abstract real method"). Run an `EntityManager` query inside the `doAnswer` instead (`StaleAccountWriteBackIntegrationTest`, PR #139).
- **Mockito strict stubs.** An unused stub fails the test. Use `lenient()` in shared setup, or `verify(..., never())` instead of stubbing.
- **Adding a constructor argument to a service** breaks tests that build it by hand (`ChargePointServiceLoggingTest`, `FuelPriceServiceNumbersTest`, `FurnitureServiceTest` ...). Append new fields at the end and fix those call sites.
- **Races hide locally.** A green local run does not prove a race is gone. PR #138's first CI run failed because server threads wrote a stale row over the secret hash the test had just restored; tests that restore state must close sockets, wait for the charger to be OFFLINE, and write a single column with JDBC.
- **Real-charger flow tests** exist: `ChargerSessionFlowIntegrationTest` drives simulated chargers over real WebSockets. Extend it for charger-side changes. `tools/ocpp-simulator/` is the manual equivalent.
- **Seeders** (`BusinessUnitSeeder`, `ChargePointSeeder`, ...) run on every profile except `test`. `DataSeeder` runs only in `dev`.
- **H2 (tests) is more forgiving than PostgreSQL (prod).** Watch enum values, check constraints and JSON columns.
- **Log files can contain binary characters:** use `grep -a`.
- **Merge conflicts** between PRs were adjacent import lines in `TransactionService`. When branches overlap, prefer a fully-qualified name (`java.util.Objects.equals`) over a new import line.
- **Break checks in a copy of the tree:** to run the deliberate breaks while the full suite runs in the real worktree, copy the tree to a new folder (`tar`, without `.git`, `target`, `node_modules`) but **keep `samjhana-admin/` and `samjhana-web/`** (without their `node_modules`): the Maven frontend plugin fails without those folders even under `-Pdev`, and then every break looks "CAUGHT" for the wrong reason. Run one unbroken test class in the copy first.
- **Load:** the container has 4 cores. One full `verify` plus one break-check run at a time is fine; more makes the timing-based tests slow and noisy.
- **Do not `pkill -f <worktree-name>`:** the name is also in your own shell command, so you kill your own shell.
- **Tests of blocking behaviour need a timeout.** The RED run of a test such as "a stalled socket must not block the publisher" hangs on the old code unless the class has `@Timeout` (see `EvLiveWebSocketHandlerTest`).
- **An older test may pin the behaviour you are changing on purpose** (B-01: staff reading an ordinary setting). Change it deliberately, rename it to say the new rule, and say so in the PR.
- **`@Scheduled` methods share one scheduler thread.** Never block in them (a socket close can block); hand slow work to an executor, as `EvLiveWebSocketHandler` does.
- **In-memory throttles are shared by every test in a cached Spring context.** A test that calls a throttled endpoint repeatedly with the same user can get a `429` (the live-ticket throttle allows 60 a minute per user): use a fresh user per test.
- **The browser tests (Playwright, `samjhana-admin/e2e`) run in CI but not in `mvn verify`.** A limit that no unit test reaches can still lock them out: the first version of the live-ticket limit (10 a minute per person) made the EV browser tests fail in CI on PR #160, because one shared admin account opens the live screen about twice per page in development mode (24 tickets in 30 seconds). The failing step showed only a timeout; the cause was the `429` answers inside the failing test's `trace.zip` (unzip it and read the `*.network` files). When you change anything those screens call in a loop (login, tickets, polling, the live feed), run them first: `cd samjhana-admin && npx playwright test e2e/ev-charging.e2e.js`. In this container the Playwright version in `node_modules` wants a newer browser than the installed one, and `samjhana-web/node_modules` is missing, so use a throwaway config (never commit it) that imports `playwright.config.js`, keeps only the first two `webServer` entries and sets `use.launchOptions = { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }`; add `trace: 'on'` to see every request.
- **`clearAutomatically = true` on a bulk update detaches everything loaded earlier in the same transaction**, lazy proxies included. Use it when the caller reloads what it needs afterwards (the online-order and stock updates do); leave it out when the caller keeps using entities it already holds (`LoanReceiptRepository.attachIfFree`, called in the middle of `TransactionService.create`).
- **`mvn` (even with `-Pdev`) runs `npm install` in `samjhana-admin`**, which in this container leaves a `node_modules` without the native binding that `vitest` needs (`Cannot find native binding ... rolldown`). Keep one good copy (the main checkout's `samjhana-admin/node_modules`, installed with `npm ci`) and re-link it right before running the admin tests in a worktree: `cd samjhana-admin && rm -rf node_modules && ln -s <main-checkout>/samjhana-admin/node_modules node_modules && npx vitest run`. Maven will replace the link the next time it runs.
- **Check a new test really fails for the right reason.** A test that inspects a list (for example the scheduled jobs) can fail on the old code only because the list is empty; read the failure message, not just the red mark.
- **The owner updates open PR branches with GitHub's "Update branch"**, which adds a merge commit on the remote. Your local copy of such a branch is then behind: `git fetch` and merge `origin/<branch>` before you push another commit to it, and base any new stacked branch on the remote head, not on your local one.
- **GitHub's "Update branch" can answer "merge conflict between base and head" for a branch that merges cleanly in git** (#168, after a stack of merged PRs: `git merge-base --all origin/staging <branch>` printed two commits). Check with `git merge-tree --write-tree origin/staging <branch>`; if that prints a tree and no conflicts, merge `origin/staging` into the branch yourself (a normal merge commit with a clear message), run the checks, and push. The PR then contains `staging`, so GitHub has nothing left to merge.
- **A clean merge can still fail to compile.** After PR A adds a constructor argument to a service, a test in PR B that builds the service by hand no longer compiles (#137 after #128: `TransactionAuditTrailTest`). CI fails within about a minute with `constructor ... cannot be applied to given types`. Fix the call site in the later PR (pass a mock for the new argument) and run `-Dtest=` on that class before you push.
- **A CI job that dies before any test runs is an infrastructure failure** (for example `Could not find artifact ... maven-clean-plugin ... in central`, #160). Do not push an empty commit. Re-run the failed job in the Actions page (the Claude Code integration gets a 403 on re-run), or update the branch after the next merge, which starts a new run.
- **The branch protection on `staging` wants the branch up to date**, so merging a list of PRs is strictly one at a time: Update branch, wait for the CI checks (13, about 8 minutes; the weekly security scan is skipped on PRs by design), merge with a merge commit, then the next one. A stacked PR whose base was merged first shrinks to its own change; a PR whose commits are all inside another merged PR shows as merged by itself.
- **Driver and logger settings are part of the fix.** Changing one log call is not enough when the library logs the same text itself (L-01: Hibernate prints the PostgreSQL driver's message; the fix includes `logServerErrorDetail=false` in the JDBC URLs).
- **Helpers worth reusing:** `AfterCommit` (`service`), `LogSafe.clean(text, max)` (`ocpp.diag`; neutralise text before logging), `RequestThrottle` (`security`; bounded table), `LoginAttemptService` (`security`), `TransactionVisibility` (`service`), `PasswordPolicy` (`security`; the one rule for a password somebody chooses), and the audit factories on `AuditLog` (`createEvent`, `updateEvent`, `approvalEvent`).
- **Passwords (A-02, PR #168).** Anywhere a person can choose a password must call `PasswordPolicy.check(password, username)` and answer a refusal with `message` plus `code` (`PASSWORD_*`); the admin screens turn the code into English or Nepali with `utils/passwordPolicy.js` (`serverPasswordMessage`). BCrypt's `encode` throws for more than 72 bytes but `matches` quietly ignores everything after byte 72, so the 72-byte limit has to be enforced where passwords are set. In a screen test, adding a user needs a staff member chosen first (click the `Select option` button, then the person): the username and password fields only appear after that (see `SettingsPage.userManagement.test.jsx`).
- **Numbers from outside** (requests, stored JSON, chargers) must go through `SafeDecimal` (`util`, added in PR #134) before they reach `BigDecimal` arithmetic.

## 7. If you run out of budget mid-fix

Finish or abandon cleanly. Either push a branch whose tests pass and open the PR, or leave nothing half-pushed. Then add one line to your final message naming the finding, the branch and what is left, so the next agent (or the owner) can continue; and refresh `STATUS.md` in a small docs PR.

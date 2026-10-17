# Waiting for the owner, and ops / CI items

**Update 2026-10-17:** the owner answered 23 of the 32 questions in section 1 (marked ✅ below); the answers and what to build are in [`DECISIONS-MADE.md`](DECISIONS-MADE.md). Still open: L-03, P0-06, P1B3-05, L-02, I-02, G-02, G-05, P1b-07, P1B1-03.

**Do not start anything in the first part of this file without the owner's answer.** Each one is a rule about who may do what, or how money is counted, or a trade-off the owner has to choose. Building a guess would change how the business works.

The second part is hosting, database, CI and documentation work. Some of it can be done in a pull request, some needs Render or Supabase access that only the owner has.

This repository is public, so the questions are worded neutrally. The full text of every finding is in the private report (README section 6).

## 1. Decisions only the owner can make (32: 23 answered on 2026-10-17, 9 still open)

| ID | Sev | The question for the owner |
|---|---|---|
| P1a-02 | Medium | Charger-initiated sessions: how strictly should the server treat a charging session that a charger starts by itself (no staff request)? Options: stop it, hold it for payment, or only flag it. **✅ Decided: see DECISIONS-MADE.md** |
| P1a-01 | High | EV charging price floor: which inputs may staff override, and what must the floor be calculated from? **✅ Decided: see DECISIONS-MADE.md** |
| C-01 | Medium | Which payment methods count as cash in the drawer when the day is closed, and who chooses the method on a sale? **✅ Decided: see DECISIONS-MADE.md** |
| P0-10 | Medium | Lock-out policy for a username that is being guessed: how long, and is it acceptable that the real user is locked out while it lasts? **✅ Decided: see DECISIONS-MADE.md** |
| P1B3-01 | Medium | Who may increase stock through an ordinary purchase entry? (`docs/ROLES.md` says stock changes are manager-only; confirm and the server can enforce it.) **✅ Decided: see DECISIONS-MADE.md** |
| P1a-06 | Medium | Approve/reject: which status changes are allowed (for example may an approved sale be rejected, by whom, with what reason)? **✅ Decided: see DECISIONS-MADE.md** |
| P1a-09 | Medium | Charger unlock flow: should the connector stay locked until payment is taken, and what happens when the lock state cannot be verified? **✅ Decided: see DECISIONS-MADE.md** |
| A-03 | Low | Should accounts created or reset by an admin, and the first-run admin, be forced to choose their own password at first login? **✅ Decided: see DECISIONS-MADE.md** |
| C-02 | Low | How should loan repayments paid to the bank count in the drawer and in the day's totals? **✅ Decided: see DECISIONS-MADE.md** |
| C-03 | Low | On a charger that unlocks by itself, when is the EV sale booked (when the charger reports the end, or when the staff takes payment)? **✅ Decided: see DECISIONS-MADE.md** |
| G-02 | Low | Which number-plate formats must be supported (for example Devanagari plates), and how should they be stored? |
| G-03 | Low | How far back may staff post entries into days that were never closed? **✅ Decided: see DECISIONS-MADE.md** |
| G-05 | Low | Charger meter readings: what to do with a reading lower than the previous one or after a meter reset? |
| I-02 | Low | The public checkout says when stock is short: may it reveal the remaining count, or should it say only "not available"? |
| I-04 | Low | First-run admin password: it is printed once in the log by design (CLAUDE.md). Keep, or require `ADMIN_INITIAL_PASSWORD`? **✅ Decided: see DECISIONS-MADE.md** |
| I-05 | Low | Should the app refuse to start for weak (not just published) secrets, and what is "weak"? **✅ Decided: see DECISIONS-MADE.md** |
| L-02 | Low | Customer personal data: how long is it kept, and how is it erased on request? (Soft delete rule in CLAUDE.md applies.) |
| L-03 | Low | Which roles may read online customers' contact details? |
| P0-06 | Low | Which roles may read a closed daily report for any date? |
| P1B1-03 | Low | Limits on analytics and list endpoints: maximum date range, default window, paging. |
| P1B3-02 | Low | May staff post fuel purchase entries, or is that manager-only? **✅ Decided: see DECISIONS-MADE.md** |
| P1B3-03 | Low | Per-account wrong-password budget (currently 10 per account, effectively 50 with the per-address limits)? **✅ Decided: see DECISIONS-MADE.md** |
| P1B3-05 | Low | Which roles may read recent daily reports (PR #111 intended manager-only)? |
| P1a-07 | Low | Loan payments: must the booked amount equal principal plus interest, and who enters which? **✅ Decided: see DECISIONS-MADE.md** |
| P1a-08 | Low | Same question as P1B3-01 for furniture and honey stock. **✅ Decided: see DECISIONS-MADE.md** |
| P1a-11 | Low | Charge sessions: cancel, void and timeout rules for a session that never charged. **✅ Decided: see DECISIONS-MADE.md** |
| P1a-14 | Low | Daily close: may the person who closed a day also verify it? **✅ Decided: see DECISIONS-MADE.md** |
| P1a-15 | Low | EV payments by eSewa or Khalti: do they count as drawer cash? **✅ Decided: see DECISIONS-MADE.md** |
| P1b-04 | Low | Daily-close verification: who may verify, and may it be repeated? **✅ Decided: see DECISIONS-MADE.md** |
| P1b-05 | Low | An admin's own payment to the bank: should it need a second approver and a receipt photo? **✅ Decided: see DECISIONS-MADE.md** |
| P1b-07 | Low | Plate-photo evidence: kept per vehicle (today) or per charging session? |
| P1b-09 | Low | "Entered by / reviewed by / closed by" labels: free-text display names today; switch to the immutable username? **✅ Decided: see DECISIONS-MADE.md** |

### Leftover pieces of partly fixed findings (also the owner's call)

- **P0-12** (rest): policy for how long stock is held for an unpaid online order and how the public order throttle should behave. **✅ Decided: see DECISIONS-MADE.md**
- **P1b-03** (rest): the approve/reject state machine (same decision as P1a-06). The audit-trail part is done in PR #137. **✅ Decided: see DECISIONS-MADE.md**
- **P1b-02**: re-entering the acting admin's password, second-admin confirmation or a delay for admin-on-admin actions, and expiry of temporary passwords. The decision-free parts of P1b-02 (last-admin guard, no finalising another admin's reset, audit row for every password change) are done in PR #154. **✅ Decided: see DECISIONS-MADE.md**
- **P1a-10** and **P1B1-01**: whether the app should refuse to start for charger secrets shorter than 24 characters, and whether the environment variable should always overwrite the stored charger secret (it would undo `rotate-secret`). **✅ Decided: see DECISIONS-MADE.md**
- **A-02**: the minimum password length (the audit suggests 12; today 8). **✅ Decided: see DECISIONS-MADE.md**

## 2. Ops, CI, database, docs and architecture (28)

| ID | Sev | What is needed |
|---|---|---|
| P1BX-01 | High | Owner/ops check in the live (staging and prod) databases: no account may still use a published development password. Deactivate or rotate any that does. Details in the private report. |
| J-01 | Medium | Add a Java dependency-vulnerability check that runs on pull requests, and fix the order of the scheduled scan. |
| P1BX-02 | Medium | `.claude/settings.json` is tracked and pre-approves some commands for every maintainer's agent: decide which should stay. |
| P3-01 | Medium | Architecture: the charger command plane and the live feed run in the same single service as the rest of the app. |
| A-04 | Low | Forwarded-address handling behind the hosting proxy (host configuration). |
| F-04 | Low | Plate photos are stored on the container's own disk: needs a persistent disk or object storage. |
| I-03 | Low | Row-level security on the Supabase tables is claimed in docs but not provided by the repository (SQL on Supabase). |
| J-02 | Low | The weekly security job can fail without anyone being told. |
| J-03 | Low | The monthly dependency report is published publicly. |
| J-04 | Low | The admin app inside the production JAR is built with `npm install` and install scripts on (use `npm ci`, scripts off) — changes the production build. |
| J-06 | Low | Nothing refreshes the SHA-pinned GitHub Actions or the pinned tool dependencies (Dependabot config). |
| J-09 | Low | AI-tooling supply chain: skill pins and records. |
| K-04 | Low | The uptime/keep-alive workflow points at an endpoint this app does not serve. |
| N-01 | Low | The database enforces none of the money and stock rules the code relies on (CHECK constraints: SQL on Supabase first). |
| N-02 | Low | Bank reference uniqueness at database level (SQL on Supabase). |
| N-05 | Low | No baseline schema, rollback script or documented backup and restore (also in CONTRIBUTING.md's backlog). |
| P1BX-03 | Low | Docker base images are digest-pinned with no update path (Dependabot docker ecosystem). |
| D-06 | Info | TLS-only transport for the WebSockets is a host/proxy setting. |
| D-07 | Info | Documentation gaps in `docs/EV-CHARGING-ARCHITECTURE.md` versus the code. |
| I-06 | Info | Dead configuration and comments that the code does not honour. |
| J-05 | Info | The weekly scan job's permissions. |
| J-07 | Info | The only coverage rule is a bundle-wide floor (50% lines, 40% branches). |
| J-08 | Info | No `.dockerignore`. |
| J-10 | Info | No CODEOWNERS, SECURITY.md or pull-request template. |
| L-04 | Info | Hard-delete cross-check: no hard delete is reachable outside dev; 6 of 10 DELETE endpoints only flip a flag. Informational. |
| N-03 | Info | `audit_logs` is not append-only at database level. |
| N-04 | Info | The app's database login is the project owner and prod changes the schema at boot. |
| P1a-12 | Info | Dev-only seeding approves waiting reviews. |

Workflow files under `.github/workflows/` can only be pushed with a token that has the `workflow` permission; if a push is refused for that reason, hand the change to the owner.

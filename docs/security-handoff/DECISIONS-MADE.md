# Decisions made by the owner, and what to build

Written 2026-10-17 by Claude Code from a question-by-question session with the owner. All 32 open questions in `DECISIONS-AND-OPS.md` were answered, plus five "leftover pieces" of partly fixed findings. This file is the brief for the next agent (Codex or a person): what the owner **decided**, what to **build**, in what **order**, and what is **still undecided**.

## 0. Rules for using this file

1. Build only what is in this file. All 32 questions are decided; what still needs the owner (hosting, database, CI, confirmations) is in `OWNER-QUESTIONS.md` sections B to D. For anything not covered, ask the owner, do not guess.
2. Each build is a small PR into `staging` (`METHOD.md`). The owner asked to **see the plan first**: before touching files for a group, post the plan block from `CLAUDE.md` (branch, scope, out of scope, tests) and wait for the owner's yes.
3. **No schema changes without the owner.** Where a build looks like it needs a new column, table or enum value (marked `SQL?` below), first use the route that needs none (the `customFields` JSON on `Transaction`, existing columns, a computed value). If there is none, stop: put the proposed SQL under `docs/sql/` in the PR and ask the owner to run it on Supabase before deploy (staging uses `ddl-auto: validate`). Ask early, so the owner can run it while you build.
4. This repository is public. Write PR text and comments in the same neutral style as this folder: state the rule that must hold, not how the old behaviour could be abused. The full finding text (location, quoted code, exact fix, test idea) is in the private report (`README.md` section 6); the one-line summaries below are enough to start.
5. User-visible text needs English and Nepali. Touch targets at least 44 px. No hard deletes. Update `docs/ROLES.md` whenever a role rule changes, and the role-matrix test with it.
6. Order of work: the 8 items in `QUEUE.md` need no decision and can run in parallel with these groups. Suggested order for the groups: G1, G2, G3, G4, G6, G7, G9, then G8 and G5 (G5 and part of G8 wait for a real-charger test, section 5).

## 1. The decisions at a glance

| Finding | Decision | Group | SQL? |
|---|---|---|---|
| P1B3-01, P1a-08 | Raising stock (honey and furniture purchases or adjustments) is manager-only | G1 | no |
| P1B3-02 | Fuel purchase entries are manager-only | G1 | no |
| G-03 | Staff may post entries for today and yesterday only | G1 | no |
| P1a-06, P1b-03 (rest) | Strict approve, reject and void rules | G2 | maybe (new status) |
| P1a-14, P1b-04 | A closed day is verified by a different person, once; close and verify are recorded | G2 | no |
| P1b-09 | Show the username beside every actor name; only admins change display names | G2 | no (see note) |
| C-01, P1a-15 | Non-cash sales need a reference and a manager tick-off; wallets are not drawer cash | G3 | no (see note) |
| C-02 | Loan repayments are a separate "paid to bank" line, not takings | G3 | try no |
| P1a-07 | A loan payment must add up (principal plus interest) | G3 | no |
| P1b-05 | Admin's own bank payment: receipt photo always, second admin approves | G3 | no |
| P0-10 | Trusted devices can still sign in during a lock-out; admins are told | G4 | maybe (device list) |
| P1B3-03 | Per-account wrong-password limit stays 10 per 15 minutes | G4 | no |
| A-03 | Created and reset accounts change their password at first sign-in; temporary passwords expire after 24 hours | G4 | yes (expiry time) |
| I-04 | First admin: `ADMIN_INITIAL_PASSWORD` required in staging and prod, nothing printed | G4 | no |
| A-02 (rest) | Minimum password length 8 for staff, 12 for managers and admins | G4 | no |
| P1b-02 (rest) | Actions on another admin or manager need the actor's own password again | G4 | no |
| I-05, P1a-10 (rest) | Weak secrets: warn loudly, never refuse to start | G4 | no |
| P1B1-01 (rest) | The app is the source of truth for charger secrets (no change) | G4 | no |
| P0-12 (rest) | Unconfirmed online orders never auto-cancel | G6 | no |
| P1a-02 | A charge started at the charger itself becomes a walk-in session held for payment | G5 | maybe |
| P1a-09 | Keep the unlock flow; test the cable; alert on unpaid departures | G5 | maybe |
| P1a-11 | Managers cancel empty sessions; a silent starting session gives up after 10 minutes | G5 | maybe (new status) |
| C-03 | The EV sale is booked when payment is taken | G5 | no |
| P1a-01 | EV price check: charger battery percent first, staff fallback flagged, never block | G5 | maybe; **after the test** |
| L-03 | Staff see a fulfilment view of online orders; contact details for managers, admins, or one audited reveal | G7 | no |
| P0-06, P1B3-05 | Closed daily reports are for managers and admins; staff see today only, and date plus total in the recent list | G7 | no |
| L-02 | Personal details of finished orders are scrubbed after 2 years; admin anonymise on request; phone not copied into the ledger | G7 | maybe (scrub marker) |
| I-02 | The public checkout gives a fixed generic message when stock is short | G7 | no |
| G-02 | Plates: accept Latin and Devanagari, store a Latin key, show what was typed | G8 | maybe |
| G-05 | Meter readings: keep the highest value, flag the session, baseline from the start event | G8 | maybe (flag); after the test |
| P1b-07 | Plate photo, name and phone kept per charging session; never overwrite; re-encode; audit | G8 | yes (session columns) |
| P1B1-03 | Analytics and lists: 366-day maximum, 31-day default, 100 rows per page, sums in the database | G9 | no |

## 2. Group G1: who may post what

**G1a. Stock increases are manager-only (P1B3-01, P1a-08).** Staff sales may only take stock down. Any increase (honey purchase, furniture purchase or other non-sale entry, adjustment) needs `canManage()` and must go through the existing stock paths (`BeekeepingService.adjustStock`, the furniture stock route) so the stock audit row is always written. Ignore `items` for entry types that must not move stock; reject quantities outside 1 to a sane maximum before any narrowing. Tests: staff purchase refused (403), manager purchase accepted and audited, staff sale still lowers stock, furniture non-sale by staff refused. Docs: `docs/ROLES.md` ("Change stock" also covers purchase entries).

**G1b. Fuel purchases are manager-only (P1B3-02).** Refuse fuel `PURCHASE` entries from staff in `TransactionController.create` (or the service). `latestPurchaseRate` must read only manager-entered or manager-approved purchases, and cost keys in staff-entered bodies are dropped. Tests: staff fuel purchase refused; a later sale's cost basis ignores any staff row; manager flow unchanged.

**G1c. Back-dating (G-03).** A non-manager's entry date must be the current business date (`Asia/Kathmandu`) or the day before. Managers may back-date; the audit row records date and amount. Add a lower bound to the DTO. Tests: staff yesterday accepted, two days back refused, manager two days back accepted with an audit row, English and Nepali error text.

## 3. The other groups

### G2. Approve, reject, void, daily close, names

**P1a-06 and the rest of P1b-03: strict rules.** Give `Transaction` an explicit transition table: `PENDING_REVIEW` to `APPROVED` or `REJECTED` only. Undoing an approved entry is a separate **Void** action: admin only, reason required. A reason is required for every reject and void. Nobody reviews their own entry (`enteredBy` differs from the reviewer). A closed day needs an admin with a reason. Refuse to void an entry that backs a closed charge session or a completed online order unless the linked record is reversed in the same transaction. The audit row holds amount, previous status, new status and reason; reasons are append-only (a history, not an overwritten `reviewNotes`). `SQL?` a new `VOIDED` status may hit a check constraint on Supabase: check `docs/sql/` and the entity first, and ask the owner if so. Tests: every illegal transition returns 409; self-review refused; void needs admin and reason; closed day refused for a manager.

**P1a-14 and P1b-04: verification.** Refuse `verify` when the user is the report's `closedBy`, and when the report is already verified (keep the first verification; a history, not an overwrite). Write audit rows for close and for verify (date, totals, cash counted, difference, notes). After a day is verified, edits, rejects and approvals of that day's entries need an admin "re-open" with a reason, which resets the verification. The owner chose **no** lone-admin exception. Tests: closer cannot verify; second verify refused; edits on a verified day refused for a manager, allowed for an admin re-open with reason.

**P1b-09: names.** Show the immutable sign-in username next to every displayed actor name (entered by, reviewed by, closed by, verified by). Only admins can change a display name (audited, old and new value); names are unique ignoring case and spaces. Snapshotting the name onto each record is optional and would need columns (`SQL?`): with admin-only renames it is not needed, so skip it unless the owner asks. Tests: staff cannot rename; admin rename audited; duplicate refused; screens show the username.

### G3. Non-cash payments, loans, drawer cash

**C-01 and P1a-15.** A server-side allow-list of payment methods per business (cash and bank; eSewa and Khalti for EV only); reject unknown values instead of treating them as cash. Every non-cash sale needs the payer's transaction reference, unique per method among non-rejected rows. Wallet payments (eSewa, Khalti) stop counting as drawer cash: the daily summary shows them as their own totals. The close lists each non-cash sale with its reference; a manager ticks each one against the statement, and the day cannot be verified until all are ticked. Changing the payment method of an existing sale is manager-only and audited (old and new). Keep the reference and the tick in `customFields` (no schema change); if a table is needed, ask. Tests: unknown method refused; missing or duplicate reference refused; wallet not in expected cash; untick blocks verify; method change by staff refused.

**C-02: loan repayments.** Repayments to the bank are not sales and not takings. Exclude loan rows from the sales and cash totals in `DailyReportService.buildSummary` and show a separate "paid to bank" line. If the entry says the money came out of the drawer, subtract it from expected cash; otherwise the drawer is untouched. Approving a loan entry dated on a closed day needs an admin re-open with a reason. Prefer excluding by business unit (no schema change, no data migration); if a new transaction type is the only way, ask the owner for SQL. Tests: a repayment day shows no false shortfall; takings exclude repayments; closed-day approval refused.

**P1a-07: loan numbers.** `validatePayment` requires `amount` equal to `principalAmount` plus `interestAmount` to the paisa; `loanId` must resolve to an existing approved new-loan entry (soft-delete aware); principal may not exceed what is outstanding; the bank reference is unique per bank (case-insensitive) among non-rejected payments. The server computes the balance (the screen `LoanEntryPage.jsx` does it today). Tests per rule.

**P1b-05: admin's own bank payment.** A receipt photo is always required, for admin-entered payments too. With two or more active admins, an admin's own payment goes to `PENDING_REVIEW` and another admin must approve (refuse `enteredBy` equal to approver). A lone admin may self-approve, and the audit row says "self-approved". A bank reference cannot be reused. Tests per rule.

### G4. Sign-in and accounts

- **P0-10.** Keep the lock for strangers (10 wrong passwords in 15 minutes). A device that signed in successfully before (a signed, HttpOnly device cookie set at sign-in) can still sign in with the correct password during a lock. Admins see a notice when an account gets locked (in the app; no e-mail or SMS exists). `SQL?` only if the device list must be stored; a signed cookie needs none.
- **P1B3-03.** The per-account limit stays 10 per 15 minutes even if `SAMJHANA_LOGIN_IP_LIMITS` is switched on: address limits decide who is refused and never relax the account limit. Group IPv6 addresses by /64. When the counter tables are full, fail closed. Document the trade-off beside the setting in `application.yml`.
- **A-03.** Accounts an admin creates, accounts an admin resets, and the first admin must choose their own password at first sign-in (`mustChangePassword = true`). A temporary password stops working after **24 hours** (the admin can reset again). `SQL?` **yes**: the expiry needs a timestamp for when the temporary password was set. Write the SQL (`docs/sql/`) first and ask the owner to run it before the code deploys.
- **I-04.** In staging and prod the first admin is created only if `ADMIN_INITIAL_PASSWORD` is set (otherwise refuse with a clear message that never repeats a password). Nothing is printed in the log. Forced change at first sign-in. Update the "Data seeding" line in `CLAUDE.md` (it still says a random password is printed once) and `docs/RECOVERY.md`. Existing databases are unaffected.
- **A-02 (rest).** Minimum length is 8 for STAFF and 12 for MANAGER and ADMIN. `PasswordPolicy.check` needs the target account's role (when an admin sets someone else's password, the target's role counts); the four screens show the right minimum. Existing passwords are not checked; the rule applies at the next change.
- **P1b-02 (rest).** Resetting a password, changing a role, or deactivating another admin or manager requires the acting admin's **own password** in the request (wrong password: refused, audited). No second-admin confirmation.
- **I-05 and P1a-10 (rest).** Weak secrets **warn, never refuse**: a JWT secret under 32 characters, charger secrets under 16 or reused, the `.env.example` text, an unknown profile name, the `dev` profile on a hosting platform (the `RENDER` variable). Write one clear warning block at the top of the log and show it on the admin Settings page. Also log the active profile(s) and the datasource host at startup. A refusal could stop the next deploy if a short secret already exists on Render, which is why the owner chose warnings.
- **P1B1-01 (rest).** No change: the app is the source of truth for a charger's secret; the Render setting only seeds a charger the first time, and a rotated secret survives restarts. Write that down in `docs/EV-CHARGING-ARCHITECTURE.md`.

### G6. Online orders (P0-12 rest)

The owner chose **not** to auto-cancel unconfirmed online orders (staff cancel by hand, as today). Still build, because they cancel nothing: count only valid, successful orders against the public order limit; alert staff to bursts of orders; add a list of orders waiting more than 24 hours so none is forgotten. The risk that fake orders hold stock stays; say so in the PR.

### G5. EV charging sessions

Several parts wait for the real-charger test (section 5). Build the parts that do not depend on it first.

- **C-03.** Book the EV sale when payment is taken (`mark-paid`), in both lock modes: call `ensureTransaction` before queueing any command. If the charger already ended the session, close it directly. A refused stop on a paid session means "close", not "stuck in PAID". Add a manager-only "close paid session" action and a daily list of paid sessions that have no sale.
- **P1a-11.** A manager-only **cancel** for a session that delivered no energy (reason required, audited; send stop or unlock if needed). A `STARTING` session with no charger event for **10 minutes** becomes failed and frees the connector. `SQL?` new `CANCELLED` and `FAILED` statuses may hit a check constraint: check first.
- **P1a-02.** A charge that was not started from the counter (card, button, plug-and-charge, or an offline transaction) becomes a **walk-in session** held for payment: the counter screen shows the payment card, the manager is alerted, the connector stays held until it is paid or cancelled. Answer authorisation requests for unknown tokens as not accepted. Sending the charger settings that forbid local or offline starts is vendor-specific: wait for the test.
- **P1a-09.** Keep today's explicit-unlock flow. Add detection: when an unpaid session ends with the car disconnected, or the connector becomes available, mark it "left unpaid" and alert the manager (read `stoppedReason`, `triggerReason`, charging state and per-connector status). Never show "connector remains locked" unless the charger confirmed it. After the test, record the lock behaviour per charger and decide the default with the owner.
- **P1a-01 (after the test).** The price is rate per percent times percent gained. The charger's own first battery reading is the start percentage whenever it sends one. If it sends none, the staff-entered start percentage is accepted but the session is **flagged**. If no price can be worked out at all (no vehicle rate or no reading), staff may still enter an amount; it is flagged and listed for managers at the daily close. **Never block.** Vehicle type stays optional (a session without one is flagged "no price check"; ask the owner if this should change). Every EV payment records the price worked out, the amount charged, and who entered it (audit row). The owner's words: *"we don't know yet what comes from the device until we do the actual test with one of the charging stations; we need both logs to see if that comes from the charger. If it does, great; if not, the user has to verify."* `SQL?` new session columns (declared start percent, source, flag) may be needed: ask.

## 4. Groups G7 to G9 (decided later the same day)

### G7. Customer data and who reads what

- **L-03.** Staff get a fulfilment view of online orders: order number, status, items, first name, city or pickup. Phone, email, address and notes are for managers and admins; staff can open **one** order's full details through an audited "reveal" call. Lower the list page-size cap. Update `docs/ROLES.md` and the role-matrix test. Tests: staff list has no contact fields; reveal returns them and writes an audit row; manager list is full.
- **P0-06 and P1B3-05.** Closed daily reports are for managers and admins. `today-summary?date=` ignores the date for non-managers (or needs `canManage()` when the date is not today's business date) and builds the staff view without the closed report; `GET /api/daily-reports/recent` gives staff only date and total; loan businesses stay out of staff totals. Tests per route.
- **L-02.** Scrub name, phone, email, address and notes of completed or cancelled online orders older than **2 years** (a scheduled job; amounts, dates and order numbers stay). An admin "anonymise customer, vehicle or order" action scrubs the same data in `shop_orders`, `transactions.custom_fields`, `audit_logs.new_values` and `ev_customer_vehicles`, and deletes the plate photo file. Stop copying the phone number into the ledger and the audit log (store the order number; whitelist the keys written to the audit log). Add a short privacy notice to the checkout (English and Nepali) and a one-page retention note. This scrubs fields; it does not hard-delete rows. `SQL?` only if a "scrubbed" marker column is wanted: try a fixed placeholder value first. The owner was told to ask an accountant whether a legal minimum applies to sales records.
- **I-02.** The public checkout answers with a fixed message ("Some items are no longer available in the amount you asked for. Please review your cart.") with no product name and no count; the cart page re-reads `stockStatus` through `GET /api/public/shop/products?slugs=...`. Tests: no stock number or product name in the response; English and Nepali text.

### G8. Plates, meter readings, evidence

- **G-02.** Accept Latin and Devanagari plates: NFKC-normalise, upper-case with `Locale.ROOT`, strip spaces, hyphens and dots, map Devanagari digits and plate letters to Latin explicitly, store the Latin key for matching and the typed text for display, reject (400) anything still outside A to Z and 0 to 9, and show the normalised plate to the operator before submitting (same rule in the form). The letter-mapping table needs real plate examples from the owner. Tests: Devanagari digits map to Latin; two different plates never collapse into one key; a refused character gives a clear message in English and Nepali.
- **G-05 (after the charger test).** Keep the highest delivered value (`max(previous, new)`); flag the session when a reading falls below the last one; take the baseline from the start event (or accept the first sample only when it is near zero); store unit-converted values with a "reset seen" marker (`SQL?` for a flag column; ask). Depends on what the real chargers send.
- **P1b-07.** Store the photo, name and phone as entered on the **charging session**; never overwrite an existing vehicle photo (append a new one); re-encode plate photos the way receipts are (decode, size-check, write a fresh JPEG without metadata); write an audit row when a vehicle's name, phone or photo changes; optionally audit photo views. `SQL?` **yes**: new session columns. Write the SQL first and ask the owner to run it before the code deploys.

### G9. Limits on big reads

- **P1B1-03.** Cap analytics date ranges at **366 days** (400 beyond); `GET /api/transactions` defaults to the last **31 days** with paging (**100** rows per page); replace the two "all time" loads with SQL that filters by business code and aggregates (or cache for a minute); filter by business and status in the query, not in Java. In `docker/entrypoint.sh` set `-XX:MaxRAMPercentage` and a heap-dump-on-out-of-memory flag (needs no decision). Tests: a range over 366 days is refused; the default window and paging; totals unchanged for valid ranges.

## 5. Real-charger test (needed for G5)

The owner will test with one real charger and a real car. To make the test useful:

1. From the counter screen choose a vehicle type, note the car's battery percent on its own dashboard, start a charge, let it run 3 to 5 minutes, stop it from the app. Repeat once without choosing a vehicle type.
2. Check whether the charger lets a charge start without the app (card, start button, plug-and-charge) and what the counter screen shows.
3. After a remote stop, try to unplug the cable (before payment). Note whether it stays locked.
4. Save the **charger's own log** (or a photo of its screen) and the app's side: the `ocpp_message_log` rows for that charger and time, or the lifecycle log lines (`SOC`, `ENERGY`). The app already reads a `SoC` measurand; the question is whether the charger sends it, in which message, and how often.
5. Record the answers in a short file, for example `docs/ev-charger-test-results.md` (no secrets), and resume G5 from it: battery percent sent or not (P1a-01), self-start possible or not (P1a-02), cable locked after a remote stop or not (P1a-09), what the meter does after a stop or reboot (G-05).

## 6. Still open for the owner or ops

Not decisions, but still open: `P1BX-01` (High, check the live databases for accounts that still use a published password) and the other items in `DECISIONS-AND-OPS.md` section 2. The keep-alive job (#170) goes live only after a release to `main`, and needs the `STAGING_HEALTH_URL` repository variable or an outside pinger.

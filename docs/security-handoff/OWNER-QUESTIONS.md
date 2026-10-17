# Questions that still need the owner

Written 2026-10-17 by Claude Code. Everything here is waiting for an answer from the owner (or for something only the owner can do). Reply with the item number and the option letter, for example "A1 a" or "B5: 1 hop". Items marked **Rec** show Claude's recommendation; nothing in sections B to D is built until the owner answers. Decisions already made are in `DECISIONS-MADE.md`.

This repository is public, so the wording is neutral. The full finding text is in the private report (`README.md` section 6).

## A. Rules that were undecided: ANSWERED on 2026-10-17 (the owner chose the recommended option, **Rec.**, for A1 to A8; the build plan is in `DECISIONS-MADE.md` groups G7 to G9)

| # | Finding | Question | Options (Rec first) |
|---|---|---|---|
| A1 | L-03 | Who may see online customers' contact details (phone, email, address)? | a) Staff see order number, status, items, first name and city or pickup; staff can open one order's full details (recorded); managers and admins see everything. **Rec.** b) Managers and admins only. c) Leave as is (all staff see everything) |
| A2 | P0-06, P1B3-05 | Who may read a closed daily report (cash count, difference, notes, verifier) for any date? | a) Managers and admins only; staff keep today's close and running totals, and the recent list shows only date and total. **Rec.** b) Leave as is |
| A3 | L-02 | How long are customers' personal details kept, and how are they erased on request? | a) Scrub name, phone, email, address of completed or cancelled orders after 2 years (amounts, dates, order numbers stay) plus an admin "anonymise" action on request; stop copying the phone into the ledger and audit log. **Rec.** b) Same with 5 years. c) On request only. Ask your accountant whether a legal minimum applies to sales records |
| A4 | I-02 | What does the public checkout say when stock is short? | a) A fixed message ("some items are no longer available in that amount"); the cart shows only in stock, few left, out. **Rec.** b) Show the number only when 5 or fewer are left. c) Leave as is (exact count up to 50) |
| A5 | G-02 | What do the number plates of the cars you charge look like: Latin letters, Devanagari, or both? | a) Latin only: normalise (upper-case, drop spaces, hyphens, dots), reject anything else. b) Both: accept Devanagari letters and digits, store a Latin key, show what was typed. **Rec. if any plate is Devanagari.** c) Leave as is (other characters silently disappear) |
| A6 | G-05 | A meter reading lower than the previous one (reboot, reset)? | a) Keep the highest value, flag the session, take the baseline from the start event. **Rec.** b) Accept a drop to near zero as a reset and add the energy before it. c) Leave as is. Depends on what your real chargers send (the charger test) |
| A7 | P1b-07 | Plate-photo evidence: kept per vehicle (today) or per charging session? | a) Per session; never overwrite a vehicle's existing photo; re-encode photos; record changes. **Rec.** b) Per vehicle, but keep the old photos as history. c) Leave as is. May need new columns (SQL on Supabase) |
| A8 | P1B1-03 | Limits on analytics and list screens? | a) Maximum range 366 days; default window 31 days; 100 rows per page; sums done in the database. **Rec.** b) Maximum 93 days. c) Leave as is |

## B. Hosting, database and CI items that need you (access or a choice)

| # | Finding | What is needed | Options and Rec |
|---|---|---|---|
| B1 | P1BX-01 (**High**) | Check staging and prod for accounts that still use a published development password (the dev logins listed in `CLAUDE.md`). Try each one on each live site. If one works, change that password or deactivate the account at once | **Rec: do this first**, it takes minutes. Tell Claude or Codex the result |
| B2 | J-01 | Add the Java dependency-vulnerability check to every pull request? | 1) On every PR, non-blocking at first. **Rec.** 2) Weekly only. 3) No. Workflow files need a token with the `workflow` permission |
| B3 | P1BX-02 | `.claude/settings.json` pre-approves commands for every maintainer's agent | 1) Trim to read-only and test commands. **Rec.** 2) Keep |
| B4 | P3-01 | Charger connections and live screens run inside the one service | 1) Keep for now, revisit with more chargers or an outage. **Rec.** 2) Plan a second service |
| B5 | A-04 | How many proxy hops sit in front of the app on Render (usually 1)? Then the per-address login limit can use the real visitor address | Test on staging first with `SAMJHANA_TRUSTED_PROXY_HOPS` and `SAMJHANA_LOGIN_IP_LIMITS=true`. Safe now because the per-account limit stays 10 |
| B6 | F-04 | Plate photos sit on the service's own disk and vanish on redeploy | 1) Store them in the database like receipts (counts against the upload quota). **Rec.** 2) Supabase Storage (needs a bucket and a key). 3) A paid persistent disk on Render |
| B7 | I-03 | Row-level security is described in the docs but not provided | Enable RLS on every table with no public policy (the app uses its own login). SQL on Supabase; Claude writes it, you run it. **Rec: yes** |
| B8 | N-01, N-02, N-03, N-04 | Database rules: CHECK constraints for money and stock (N-01), unique bank reference (N-02), append-only audit log (N-03), a limited login for the app instead of the project owner (N-04) | N-01, N-02, N-03: yes after a data check. **Rec.** N-04: later, with a plan, because prod changes the schema at boot today. All SQL on Supabase |
| B9 | N-05 | Which Supabase plan is it, are daily backups on, and can you run one restore test? | **Rec:** a restore test before the release, if possible |
| B10 | J-02, J-03, J-04, J-06, P1BX-03, J-09 | CI hygiene: make the weekly security job tell someone when it fails; stop publishing the monthly dependency report publicly; build the admin app with `npm ci` and scripts off (changes the production build, test on staging); Dependabot for Actions and Docker (monthly) | **Rec: yes to all.** They are workflow files, so someone with the `workflow` permission pushes them |
| B11 | D-06 | Do your chargers connect over `wss://` (TLS) or plain `ws://`? Many chargers only support `ws://` | Needs the charger's specification. Use `wss://` if it can; otherwise accept the risk and rely on the secrets |
| B12 | J-10 | Add `SECURITY.md`, `CODEOWNERS` and a pull-request template? | **Rec: yes** (small files; owner of CODEOWNERS is you) |
| B13 | D-07, I-06, J-05, J-07, J-08, L-04, P1a-12 | Docs gaps, dead settings, scan permissions, the coverage rule, `.dockerignore`, informational notes | No input needed: an agent can do these |

Already done: **K-04** (the keep-alive job pointed at a page the app does not serve) was fixed by #170; it goes live after a release to `main` and needs the repository variables in C3.

## C. Other open items

| # | Item | What is needed |
|---|---|---|
| C1 | Who builds the decided work | Codex from `DECISIONS-MADE.md` (groups G1 to G6) and the 8 items in `QUEUE.md`; say if Claude should do any of them |
| C2 | Release #173 (`staging` to `main`) | Your call and timing. Before it: check the prod Render environment is complete (real `JWT_SECRET`, real `OCPP_SECRET_*`, the Supabase CA file; `ADMIN_INITIAL_PASSWORD` only for a brand-new database). The merged series needs no SQL; later builds may (A-03 expiry, new session statuses) |
| C3 | Keep-alive | Set the repository variable `STAGING_HEALTH_URL` to `https://samjhana-ventures-os-staging.onrender.com/api/public/fuel-prices/current` (check the host in Render) and, if wanted, `PROD_HEALTH_URL`; or use a free outside pinger (cron-job.org, UptimeRobot) because GitHub's schedule is unreliable |
| C4 | Domain e-mail `sandeep@samjhanamultiproduct.com` | Who hosts the domain's DNS (registrar, Cloudflare)? Then choose: free receive-only forwarding (Cloudflare Email Routing), or the open-source Forward Email service that can also send |
| C5 | Real-charger test | A date, which charger, and who saves the charger's log and the app's `ocpp_message_log` (checklist in `DECISIONS-MADE.md` section 5) |

## D. Confirm these assumptions (made while recording the answers)

| # | Assumption | Confirm or change |
|---|---|---|
| D1 | EV price check (P1a-01): vehicle type stays optional; a session without one is flagged "no price check" | Keep, or require a vehicle type |
| D2 | Online orders never auto-cancel (P0-12): fake or abandoned orders can keep stock held until staff cancel them | Accepted risk, or choose 24 or 48 hours |
| D3 | Names (P1b-09): admin-only renames are enough; no extra column to copy the name onto each record | Keep, or allow the column (SQL) |
| D4 | Daily close (P1a-14, P1b-04): no exception for a lone admin to verify a day they closed | Keep, or allow "self-verified" when only one admin exists |
| D5 | Temporary passwords (A-03): a 24 hour expiry needs a new column | OK to run the SQL when Codex prepares it |
| D6 | Manager-only stock increases and fuel purchases (P1B3-01, P1a-08, P1B3-02): no staff member has to receive deliveries | Confirm, or choose "staff enter, manager approves" |

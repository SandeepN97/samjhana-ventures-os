# Status of all 118 audit findings

Written 2026-10-16, refreshed 2026-10-17 after every PR of the series had been merged into `staging` and the owner had answered 23 of the 32 questions. Counts: **46 findings fixed** (all merged into `staging`), **3 partly fixed**, **2 already fine before this series**, **0 in progress**, **23 decided by the owner and ready to build** (`DECISIONS-MADE.md`), **9 still waiting for the owner's decision**, **27 ops/CI/docs/architecture**, **8 more to do** (no decision needed; see `QUEUE.md`). 118 in total: 5 High, 30 Medium, 66 Low, 17 Info.

The authoritative record of each fix is its pull request (body = what was wrong, what changed, tests, mutation checks). To find the PR for a finding: GitHub search `repo:SandeepN97/samjhana-ventures-os is:pr "<ID>" in:body`.

Topics for items that still need a decision are worded neutrally on purpose: this repository is public. The full text lives only in the private report (see README section 6).

| ID | Severity | Topic | Status | Where |
|---|---|---|---|---|
| K-01 | High | Every petrol sale entry first loads the pump's ENTIRE petrol transaction history (all columns, all rows… | Fixed, merged into staging | #130 |
| P0-02 | High | Server trusts the client's amount (and rate, litres, quantities) for every sale — attendant can… | Fixed, merged into staging | #128 |
| P0-16 | High | Public throttle keeps one in-memory entry per attacker-chosen key for 2 hours and re-scans the whole… | Fixed, merged into staging | #124 |
| P1BX-01 | High | Check the live databases for accounts that still use published passwords (owner/ops check) | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| P1a-01 | High | EV staff price-floor rule | Decision made, ready to build | see DECISIONS-MADE.md |
| A-01 | Medium | Anonymous login requests that each name a new username are never throttled, and each one costs a full… | Fixed, merged into staging | #135 |
| C-01 | Medium | How a sale's payment method counts in the daily close | Decision made, ready to build | see DECISIONS-MADE.md |
| D-01 | Medium | Charger-supplied meter numbers are parsed as unbounded-exponent BigDecimals and then used in exact… | Fixed, merged into staging | #134 |
| F-01 | Medium | No size limit on JSON request bodies: the base64 plate photo, and every string in an anonymous JSON… | Fixed, merged into staging | #136 |
| F-03 | Medium | Pictures and receipt photos go into the shared business database with no quota, no rate limit and no… | Fixed, merged into staging | #126 |
| F-06 | Medium | customFields is an unlimited upload channel for the lowest role: a STAFF login can store megabyte-sized… | Fixed, merged into staging | #131 |
| G-01 | Medium | A STAFF login can make the server build a number with up to ~2 billion digits: unbounded-exponent… | Fixed, merged into staging | #134 |
| J-01 | Medium | No Java dependency-vulnerability check runs on pull requests, and the one scheduled check scans the… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| K-02 | Medium | The new beekeeping dashboard and order list (PR #98) read the shop's whole transaction history, JSON and… | Fixed, merged into staging | #129 |
| K-03 | Medium | The staff online-orders list loads the whole orders table, cuts it to 300 afterwards, then runs one… | Fixed, merged into staging | #127 |
| P0-01 | Medium | Anonymous shop order: int overflow when merging quantities makes negative order lines (stock inflation… | Fixed, merged into staging | #125 |
| P0-03 | Medium | Manager edit of a transaction is unvalidated, ignores closed days and the audit row omits… | Fixed, merged into staging | #137 |
| P0-04 | Medium | Loan receipt upload decodes the whole image before checking its size (decompression bomb) | Fixed, merged into staging | #126 |
| P0-10 | Medium | Username lock-out policy (security vs availability) | Decision made, ready to build | see DECISIONS-MADE.md |
| P0-12 | Medium | Public order throttle can be exhausted anonymously and stock can be locked up with fake orders | Partly fixed | #125 fixed the cart overflow and allowance; the owner decided unconfirmed orders never auto-cancel; the order-limit counting, burst alert and 24-hour list are ready to build (DECISIONS-MADE.md G6) |
| P0-17 | Medium | Login failure counter stores the full attacker-supplied username as a key with no length limit and no… | Fixed, merged into staging | #133 |
| P1B1-01 | Medium | Replace a charger secret that was stored from the published default | Fixed, merged into staging | #151 (core fix; making the environment always win is the owner's call) |
| P1B2-01 | Medium | The login and change-password lock-outs are check-then-act: a parallel burst of guesses is judged… | Fixed, merged into staging | #135 |
| P1B3-01 | Medium | Who may raise stock through ordinary entries | Decision made, ready to build | see DECISIONS-MADE.md |
| P1BX-02 | Medium | Tracked Claude Code project settings pre-approve package installs, build/test runs and find/cat for… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| P1a-02 | Medium | Charger-side authorisation: unknown transactions and Authorize requests | Decision made, ready to build | see DECISIONS-MADE.md |
| P1a-03 | Medium | Rotating a charger's secret (or deactivating it) does not disconnect a connection made with the old… | Fixed, merged into staging | #138 |
| P1a-04 | Medium | Any STAFF user can close tomorrow's books in advance; staff entries are then refused until midnight and… | Fixed, merged into staging | #132 |
| P1a-06 | Medium | Approve/reject allowed transitions | Decision made, ready to build | see DECISIONS-MADE.md |
| P1a-09 | Medium | Charger unlock-before-payment flow | Decision made, ready to build | see DECISIONS-MADE.md |
| P1b-01 | Medium | A user's own profile save writes back a stale copy of their whole account row, so a concurrent demotion… | Fixed, merged into staging | #139 |
| P1b-02 | Medium | Admin account changes: last-admin guard, audit every password change, no finalising another admin's reset | Fixed, merged into staging | #154 (decision-free part; the rest is the owner's call, see DECISIONS-AND-OPS.md) |
| P1b-03 | Medium | Approve/reject state machine (audit part done) | Partly fixed | #137 fixed the audit trail and re-checks on edits; the approve/reject rules are decided and ready to build (DECISIONS-MADE.md G2) |
| P1b-08 | Medium | Price, rate, website, picture, stock, HR and charger stop/unlock actions leave no audit row (stop/unlock… | Partly fixed | #143 (fuel prices) and #145 (charger stop/unlock) added audit rows; still unaudited: website text and pictures, EV vehicle rates, furniture items and stock, rental, staff HR, restaurant, customer delete, daily close and verify |
| P3-01 | Medium | The charger command plane (OCPP WebSocket) and the live kiosk feed run inside the same single JVM and… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| A-02 | Low | Password rules: common-password list, username check, length message | Fixed, merged into staging | #168 (stacked on #154; the minimum length stays 8: 12 is the owner's call, see DECISIONS-AND-OPS.md) |
| A-03 | Low | Passwords set for someone else are not one-time: created accounts and the first-run admin are never… | Decision made, ready to build | see DECISIONS-MADE.md |
| A-04 | Low | Per-address login limits read whatever X-Forwarded-For list is left when the request reaches the app: if… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| C-02 | Low | Loan repayments to the bank are booked as cash SALES: once approved they raise the day's expected drawer… | Decision made, ready to build | see DECISIONS-MADE.md |
| C-03 | Low | On an auto-unlocking charger the EV sale is booked only by the charger's later "Ended" event: when the… | Decision made, ready to build | see DECISIONS-MADE.md |
| D-02 | Low | Live EV feed: per-user socket and ticket caps, non-blocking broadcast | Fixed, merged into staging | #160 |
| D-03 | Low | OCPP connection registry: duplicate-connection handling and clean-up | Already fixed before this series | already handled on staging before this series: a newer connection closes the older one, and a stale socket closing cannot mark the charger offline (covered by OcppWebSocketHandlerTest and ChargerSessionFlowIntegrationTest) |
| D-04 | Low | WebSocket liveness: heartbeat sweep, idle limits, frame-size and message-rate limits | To do (no decision needed) | see QUEUE.md |
| F-02 | Low | A refused EV session start still leaves its plate photo on disk: any STAFF login can write an unlimited… | Fixed, merged into staging | #149 |
| F-04 | Low | Plate photos (the only evidence of which car charged) live on the container's own disk: on a host… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| F-05 | Low | Loan receipts: one receipt, one payment | Fixed, merged into staging | #166 |
| G-02 | Low | The plate number is "normalised" by deleting every character outside A-Z and 0-9 after a plain… | Waiting for the owner's decision | see DECISIONS-MADE.md section 4 |
| G-03 | Low | How far back staff may post entries | Decision made, ready to build | see DECISIONS-MADE.md |
| G-04 | Low | Date display in the admin app (time zone) | To do (no decision needed) | see QUEUE.md |
| G-05 | Low | EV meter handling has no monotonic or reset rule: the first reading received becomes the baseline, and a… | Waiting for the owner's decision | see DECISIONS-MADE.md section 4 |
| H-01 | Low | Public site links: re-check on read and in the browser | To do (no decision needed) | see QUEUE.md |
| I-01 | Low | The catch-all exception handler turns ordinary client mistakes into HTTP 500 plus a full stack trace in… | Fixed, merged into staging | #142 |
| I-02 | Low | The public checkout's "Not enough stock for <product>" answer is an exact stock-count oracle for… | Waiting for the owner's decision | see DECISIONS-MADE.md section 4 |
| I-03 | Low | Row-level security on the Supabase tables is claimed in the docs but provided by nothing in the… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| I-04 | Low | First-run admin password handling | Decision made, ready to build | see DECISIONS-MADE.md |
| I-05 | Low | Strictness of the startup checks for weak secrets | Decision made, ready to build | see DECISIONS-MADE.md |
| J-02 | Low | The weekly security job can fail without telling anyone: a failed dependency scan skips CodeQL, the… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| J-03 | Low | The monthly dependency report publishes which libraries of the live frontends have known… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| J-04 | Low | The admin app that ships inside the production JAR is built with npm install (install scripts on) on a… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| J-06 | Low | Nothing refreshes the SHA-pinned GitHub Actions or the pinned Python tool dependencies, the… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| J-09 | Low | The AI-tooling supply chain rests on pins and records the repository does not contain: agent skills are… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| K-04 | Low | The uptime signals are weaker than they look: the keep-alive example points at an endpoint this app does… | Fixed, merged into staging | #170 (the keep-alive job now pings a page the app serves; live after a release to main and once the repository variables are set) |
| L-02 | Low | Customer data retention and erasure | Waiting for the owner's decision | see DECISIONS-MADE.md section 4 |
| L-03 | Low | Who may read online customers' contact details | Waiting for the owner's decision | see DECISIONS-MADE.md section 4 |
| M-01 | Low | Price scraper must not overwrite a manager's manual price | Fixed, merged into staging | #167 (no longer applies: the owner had the NOC price scraper removed; stacked on #143) |
| M-02 | Low | Price scraper: tie the price to the configured depot | Fixed, merged into staging | #167 (no longer applies: the scraper is removed; stacked on #143) |
| M-03 | Low | Price fetch: report failures and show staleness | Fixed, merged into staging | #167 (no longer applies: the scraper is removed; stacked on #143) |
| M-04 | Low | Manual price fetch: no open transaction across the HTTP call, one fetch at a time | Fixed, merged into staging | #167 (no longer applies: the scraper is removed; stacked on #143) |
| N-01 | Low | The database enforces none of the money and stock rules the code depends on, and the few backstops that… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| N-02 | Low | A bank reference is not unique anywhere: the same reference can be booked as many loan payments, in two… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| N-05 | Low | There is no baseline schema, no rollback script and no documented backup or restore for the only copy of… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| P0-05 | Low | Uploaded pictures: strip metadata, verify WebP | To do (no decision needed) | see QUEUE.md |
| P0-06 | Low | Who may read a closed daily report | Waiting for the owner's decision | see DECISIONS-MADE.md section 4 |
| P0-07 | Low | Legacy public furniture endpoints ignore the "Hidden on website" switch and return internal UUIDs | Fixed, merged into staging | #141 |
| P0-08 | Low | No sanity bounds on fuel prices (manual entry and the NOC scraper) | Fixed, merged into staging | #143 |
| P0-09 | Low | PATCH /api/furniture/orders/{id}/delivery-status accepts any transaction id from any signed-in user | Fixed, merged into staging | #140 |
| P0-11 | Low | Furniture stock changes: validate line quantities, use guarded updates | Fixed, merged into staging | #161 |
| P0-13 | Low | Public media: answer conditional requests without loading the image | Fixed, merged into staging | #153 |
| P0-15 | Low | Authentication events and admin actions in the audit trail | To do (no decision needed) | see QUEUE.md |
| P1B1-02 | Low | Rent and furniture order screens vs server validation | Fixed, merged into staging | #165 (stacked on #161) |
| P1B1-03 | Low | Original read endpoints load whole tables into memory on every call and are open to every signed-in… | Waiting for the owner's decision | see DECISIONS-MADE.md section 4 |
| P1B1-04 | Low | Rejected entries must not count on the module screens | To do (no decision needed) | see QUEUE.md |
| P1B3-02 | Low | Who may post fuel purchase entries | Decision made, ready to build | see DECISIONS-MADE.md |
| P1B3-03 | Low | Switching on PR #109's per-address login limits raises the per-account guess budget from 10 to 50 per 15… | Decision made, ready to build | see DECISIONS-MADE.md |
| P1B3-04 | Low | Recovery runbook: no literal temporary password | Already fixed before this series | already fixed on staging: docs/RECOVERY.md now uses a placeholder and tells the reader never to reuse a published password |
| P1B3-05 | Low | Who may read recent daily reports | Waiting for the owner's decision | see DECISIONS-MADE.md section 4 |
| P1BX-03 | Low | Production base images are digest-pinned with no update path: the Dependabot docker ecosystem promised… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| P1a-05 | Low | Online-order status changes made atomic | Fixed, merged into staging | #164 |
| P1a-07 | Low | Loan payment: the booked amount, the principalAmount and the interestAmount are three unrelated client… | Decision made, ready to build | see DECISIONS-MADE.md |
| P1a-08 | Low | Who may raise furniture and honey stock through ordinary entries | Decision made, ready to build | see DECISIONS-MADE.md |
| P1a-10 | Low | Throttle failed charger handshakes per address and per charger code | Fixed, merged into staging | #152 (core fix; refusing short secrets at startup is the owner's call) |
| P1a-11 | Low | Charge sessions have no cancel, void or timeout transition: a session that never charged can only leave… | Decision made, ready to build | see DECISIONS-MADE.md |
| P1a-13 | Low | Furniture stock changes made atomic | Fixed, merged into staging | #161 |
| P1a-14 | Low | Maker/checker on the daily close | Decision made, ready to build | see DECISIONS-MADE.md |
| P1a-15 | Low | EV wallet payments in the drawer cash | Decision made, ready to build | see DECISIONS-MADE.md |
| P1a-16 | Low | Charger events: allowed session-state transitions | Fixed, merged into staging | #162 |
| P1b-04 | Low | Maker/checker on daily-close verification | Decision made, ready to build | see DECISIONS-MADE.md |
| P1b-05 | Low | Approval of an admin's own bank payment | Decision made, ready to build | see DECISIONS-MADE.md |
| P1b-06 | Low | Live EV feed: re-check the account while a socket is open | Fixed, merged into staging | #160 |
| P1b-07 | Low | Plate-photo evidence is kept per vehicle, not per session: any staff member who starts a session with an… | Waiting for the owner's decision | see DECISIONS-MADE.md section 4 |
| P1b-09 | Low | Every "entered by / reviewed by / closed by / verified by" shown in the app is a free-text name each… | Decision made, ready to build | see DECISIONS-MADE.md |
| B-01 | Info | Settings read access: allow-list instead of deny-list | Fixed, merged into staging | #156 |
| D-05 | Info | Charger messages: validate field formats and lengths | To do (no decision needed) | see QUEUE.md |
| D-06 | Info | TLS-only transport is not enforced by the application on either WebSocket: the charger's Basic secret… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| D-07 | Info | Design-versus-code gaps in docs/EV-CHARGING-ARCHITECTURE.md and the entity Javadoc: event matching is… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| E-01 | Info | Log hygiene: neutralise line breaks, validate SKU | Fixed, merged into staging | #158 |
| H-02 | Info | Order tracking: keep the phone number out of the URL | To do (no decision needed) | see QUEUE.md |
| I-06 | Info | Security-looking configuration and comments the code does not honour: two dead upload limits that… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| J-05 | Info | The weekly scan job runs third-party install scripts and Maven plugin code while holding a… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| J-07 | Info | The only coverage rule in the build is a bundle-wide floor of 50% lines / 40% branches, enforced by one… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| J-08 | Info | There is no .dockerignore: the Docker build context is the whole checkout, and COPY samjhana-admin and… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| J-10 | Info | The public repository has no CODEOWNERS, SECURITY.md or pull-request template: nobody is designated to… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| L-01 | Info | Log hygiene: do not log database error messages | Fixed, merged into staging | #158 |
| L-04 | Info | Hard-delete cross-check: no hard delete is reachable outside the dev profile, but 6 of the 10 DELETE… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| N-03 | Info | audit_logs is not append-only: the entity is mutable, the repository exposes update and delete, and the… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| N-04 | Info | The server logs into the database as the project owner and, in prod, is expected to change the schema at… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |
| P0-14 | Info | Admin app route /change-password on the server allow-list | Fixed, merged into staging | #157 |
| P1a-12 | Info | Dev startup silently approves every waiting review, including loan payments awaiting the admin (no… | Ops / CI / docs / architecture | see DECISIONS-AND-OPS.md |

## Counts by severity

- **High** (5): 1 decision made, ready to build; 3 fixed, merged into staging; 1 Ops / CI / docs / architecture
- **Medium** (30): 6 decision made, ready to build; 18 fixed, merged into staging; 3 Ops / CI / docs / architecture; 3 partly fixed
- **Low** (66): 2 already fixed before this series; 16 decision made, ready to build; 21 fixed, merged into staging; 12 Ops / CI / docs / architecture; 6 to do (no decision needed); 9 waiting for the owner's decision
- **Info** (17): 4 fixed, merged into staging; 11 Ops / CI / docs / architecture; 2 to do (no decision needed)

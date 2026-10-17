# Work queue: findings that need no decision from the owner

Do these top to bottom (highest value first). One finding, or a tight group of related findings, per branch and per PR into `staging`. Method, commands and gotchas are in `METHOD.md`.

Notes that apply to every entry:

- File and line references come from the audit (2026-10-05) and have drifted; search for the names.
- Every PR of the series is merged into `staging` (README section 2), so branch from the latest `origin/staging`. Before you start, run `git fetch origin && git log origin/staging..origin/<branch>` on any open PR that touches the same files, and say "stacked on #NNN" in your PR if you must build on one.
- "On prod at audit time" is the label from 2026-10-05. Releases since then (#118, #123, #144, #147, #148, #159, #163) may have moved staging-only items to production, and a release PR from `staging` is open (#173), so treat every item as live.
- Anything that needs SQL on Supabase, a new `AuditLog.EntityType` value, a new role rule or a business-rule choice is NOT in this queue: stop and ask the owner.

## 1. P0-05 (Low) — Uploaded pictures: strip metadata, verify WebP

- On prod at audit time: staging only
- Where: `src/main/java/com/samjhana/service/MediaService.java:56-61,140-147,150-151`; `src/main/java/com/samjhana/controller/MediaController.java:46-52`
- Fix: decode and re-encode every upload (as `LoanReceiptService.resave` does) or strip metadata; verify WebP with an image reader (add a WebP ImageIO plugin) or accept only JPEG/PNG; add `Content-Security-Policy: sandbox` / `default-src 'none'` on the media response; shorten cache or add a versioned URL so deletions take effect.
- Test idea: upload a JPEG with an EXIF GPS block and assert the served bytes contain no EXIF; upload `RIFF....WEBP` + garbage and assert 400.

## 2. D-05 (Info) — Charger messages: validate field formats and lengths

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/websocket/OcppWebSocketHandler.java:73,89,100`; `src/main/java/com/samjhana/service/ChargePointService.java:56,73`; `src/main/java/com/samjhana/service/ChargeSessionService.java:211,245,287,294,304`; `src/main/java/com/samjhana/entity/ChargePoint.java:43-44,63-64`; `src/main/java/com/samjhana/entity/ChargeSession.java:104-105,110-111`
- Fix: validate OCPP fields at the handler edge (serial <= 25 and `[A-Za-z0-9._-]`, connector status from the OCPP `ConnectorStatusEnumType` list, transaction id <= 36, error text truncated to 200) and answer a CALLERROR `FormationViolation`/`PropertyConstraintViolation` instead of throwing; wrap `handleCall` in a `try/catch (RuntimeException)` that answers `InternalError` and keeps the socket open; make serial-number conflicts a logged warning rather than an exception.
- Test idea: send a `StatusNotification` with a 200-character status and assert a CALLERROR comes back, the socket stays open and the stored status is unchanged; send a `BootNotification` whose serial equals another charger's and assert it is answered without closing.

## 3. D-04 (Low) — WebSocket liveness: heartbeat sweep, idle limits, frame-size and message-rate limits

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/config/WebSocketConfig.java:29-37`; `src/main/java/com/samjhana/websocket/OcppWebSocketHandler.java:38-44,47-77,92`; `src/main/java/com/samjhana/service/ChargePointService.java:37-76`; `src/main/java/com/samjhana/ocpp/OcppConnectionRegistry.java:32-35`; `samjhana-admin/src/utils/evSession.js:13-15`
- Fix: add a `@Scheduled` sweep (every 15 s) that marks a charger OFFLINE and closes its socket when `lastHeartbeatAt` is older than ~3 x the 30 s interval; send a WebSocket ping every 30 s and set an idle timeout; configure `ServletServerContainerFactoryBean` explicitly (`maxTextMessageBufferSize` sized for the largest legitimate `TransactionEvent`, e.g. 32 KB, `maxSessionIdleTimeout`); refuse a second concurrent socket per code (see D-03); add a per-connection token bucket (e.g. 20 frames/s) that closes the socket with 1008 when exceeded; return an unusable state to the UI (grey the charger) when the heartbeat is stale.
- Test idea: connect a simulated charger, stop its heartbeats for 100 s and assert the charger is OFFLINE and the socket closed; send 1000 heartbeats in one second and assert the socket is closed with 1008 and the database saw far fewer than 1000 writes; send a 64 KB text frame and assert a clean 1009 close and no handler exception.

## 4. P1B1-04 (Low) — Rejected entries must not count on the module screens

- On prod at audit time: mixed (some parts on prod)
- Where: `src/main/java/com/samjhana/controller/RentalPropertyController.java:186-195,220-226`; `src/main/java/com/samjhana/service/FurnitureService.java:49-67,99-113`; `src/main/java/com/samjhana/service/BeekeepingService.java:63-70`
- Fix: apply one rule everywhere: exclude `REJECTED` (and, for loans, awaiting-review rows) in a shared repository query or a `TransactionVisibility.countsTowardTotals(t)` predicate and use it in `RentalPropertyController.getPropertyLedger`, `FurnitureService.getDashboard/listCustomers`, `BeekeepingService.getDashboard`; recompute the ledger from `monthlyRent` and the booked `amount` on the server instead of summing a client-typed `balance`.
- Test idea: create a rent payment, reject it, and assert `GET /api/rental-properties/{id}/ledger` no longer lists it and the outstanding balance returns to the earlier value; same for a furniture sale in `GET /api/furniture/dashboard` (`todayRevenue`, `pendingDeliveries`).

## 5. P0-15 (Low) — Authentication events and admin actions in the audit trail

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/controller/AuthController.java:57-81`; `src/main/java/com/samjhana/entity/AuditLog.java:63-67`; `src/main/java/com/samjhana/entity/User.java:76-80`; `src/main/java/com/samjhana/repository/AuditLogRepository.java:10-11`; `src/main/java/com/samjhana/controller/AdminController.java:65-122,218-246`; `src/main/java/com/samjhana/seed/FirstRunInitializer.java:64-74`
- Fix: record login success/failure with address and user agent (hashed or truncated per privacy needs) in `audit_logs`, populate `ipAddress/userAgent` from the request in the factory methods, add an ADMIN-only audit list endpoint/page, audit user create/deactivate, force `mustChangePassword` for the first-run admin and avoid logging the password (print once to stdout only if unavoidable, or require `ADMIN_INITIAL_PASSWORD`).
- Test idea: a failed and a successful login each create an audit row with an address; `POST /api/admin/users` creates a USER audit row.

## 6. G-04 (Low) — Date display in the admin app (time zone)

- On prod at audit time: mixed (some parts on prod)
- Where: samjhana-admin/src/pages/shared/RecordsPage.jsx:74-80; samjhana-admin/src/pages/petrol/FuelOrderPage.jsx:146-151; samjhana-admin/src/pages/admin/StaffManagementPage.jsx:236-240; samjhana-admin/src/pages/loans/LoanEntryPage.jsx:414,492; contrast samjhana-admin/src/utils/businessDay.js:1-30 (which handles "today" correctly)
- Fix: format date-only strings without `Date` (split on `-`), or build `new Date(y, m - 1, d)`, or pass `{ timeZone: 'UTC' }` to `toLocaleDateString`; put it in one `formatDate` helper beside `businessDay.js`.
- Test idea: Vitest with `process.env.TZ = 'America/New_York'`: `formatDate('2026-10-09')` must contain "9", for both locales.

## 7. H-01 (Low) — Public site links: re-check on read and in the browser

- On prod at audit time: mixed (some parts on prod)
- Where: `samjhana-web/src/site/links.js:5-10`; `samjhana-web/src/components/ui/SmartLink.jsx:29-38`; `samjhana-web/src/components/Footer.jsx:16,40`; `samjhana-web/src/components/Navbar.jsx:91`; `samjhana-web/src/components/home/ContactSection.jsx:38`; `samjhana-web/src/site/SiteContext.jsx:36-37`; `src/main/java/com/samjhana/service/SiteContentService.java:52-60,151-152`; `src/main/java/com/samjhana/controller/SiteContentController.java:20-23`; `samjhana-web/index.html:3-11`
- Fix: (1) in `resolveLink`, return `''` unless the value matches the server allow-list (`^(\/(?!\/|\\)|#|https?:\/\/|tel:|mailto:)`), and pass `contact.mapsUrl` through it in `Footer.jsx`, `Navbar.jsx` and `ContactSection.jsx`; (2) re-validate on read in `SiteContentService.getAll()/get()` (drop an unsafe link instead of serving it); (3) serve the public site with a CSP (`default-src 'self'; script-src 'self'; connect-src <API origin>; img-src 'self' <API origin>; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-src https://www.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`) plus `X-Content-Type-Options`, `Referrer-Policy`, HSTS, from the host config kept in the repo; (4) enable RLS (I-03).
- Test idea: Vitest. Render `Footer`, `Navbar` and `SmartLink` with a `contact.mapsUrl`/`href` that uses a non-allow-listed scheme, and assert that no anchor gets that `href`. JUnit: save a `site_content` row directly through the repository with an unsafe link, and assert that `getAll()` does not return it.

## 8. H-02 (Info) — Order tracking: keep the phone number out of the URL

- On prod at audit time: staging only
- Where: `samjhana-web/src/api/api.js:56-57`; `samjhana-web/src/pages/OrderPage.jsx:27,67`; `src/main/java/com/samjhana/controller/ShopOrderController.java:30-31`
- Fix: change tracking to `POST /api/public/shop/orders/track` with `{orderNumber, phone}` in the JSON body (keep the same 404 and throttle), and update `ordersApi.track`; keep `phone` out of every URL. Optionally add `Cache-Control: no-store` to the tracking response.
- Test idea: a MockMvc test that the GET-with-`phone` form is gone (405/404) and the POST form returns the masked view; a Vitest that `ordersApi.track` sends the phone in the body (axios mock sees no `params.phone`).

## Pieces left over from partly fixed findings

- **P1b-08**: add audit rows (existing `AuditLog.EntityType` values only; a non-null user) for the still-unaudited admin actions: website text and pictures (site content, media upload and delete), EV vehicle rates, furniture items and stock, rental properties and tenants, staff HR records, restaurant menu, customer delete, and daily-close and verify. Pattern to copy: `FuelPriceService.saveOrUpdatePrice` (PR #143) and `ChargeSessionService.recordCommand` (PR #145).
- **P0-12** and **P1b-03**: the remaining parts are owner decisions (DECISIONS-AND-OPS.md).

## Decided items

The owner has answered 23 of the 32 open questions. What to build for them, in groups G1 to G6 with tests and SQL flags, is in `DECISIONS-MADE.md`; the 8 items above need no decision and can run in parallel. The real-charger test (DECISIONS-MADE.md section 5) gates the EV charging group.

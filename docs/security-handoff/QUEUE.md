# Work queue: findings that need no decision from the owner

Do these top to bottom (highest value first). One finding, or a tight group of related findings, per branch and per PR into `staging`. Method, commands and gotchas are in `METHOD.md`.

Notes that apply to every entry:

- File and line references come from the audit (2026-10-05) and have drifted; search for the names.
- Several files below are also changed by PRs that are still open (see README section 2). If you touch the same code, branch from that PR's branch (a "stacked" PR) or wait until it is merged, and say so in your PR. Check with `git fetch origin && git log origin/staging..origin/<pr-branch>`.
- "On prod at audit time" is the label from 2026-10-05. Releases since then (#118, #123, #144, #147) may have moved staging-only items to production, so treat every item as live.
- Anything that needs SQL on Supabase, a new `AuditLog.EntityType` value, a new role rule or a business-rule choice is NOT in this queue: stop and ask the owner.

## 1. P1B1-01 (Medium) — Replace a charger secret that was stored from the published default

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/seed/ChargePointSeeder.java:57-59`; `src/main/java/com/samjhana/config/OcppProperties.java:38-52`; `src/main/java/com/samjhana/websocket/OcppHandshakeInterceptor.java:41,46-52`; `src/main/resources/application.yml:116-121`; `tools/ocpp-simulator/README.md:77-83`
- Fix: Chosen design (decision-free part): when the stored hash matches the published development default for that charger and the configured secret is a different, real value, replace the stored hash with the hash of the configured secret at startup (log a WARN). A hash set by `rotate-secret` never matches the published default, so rotations survive restarts. Not done, because they are the owner's call: making the environment the source of truth on every start (it would undo `rotate-secret`) and refusing short secrets at startup.
- Test idea: `@SpringBootTest` with profile `staging`, pre-insert a `charge_points` row whose `ocpp_auth_secret_hash` is `bcrypt("dev-…")` of that charger's published default (`application.yml:119`) and a strong `OCPP_SECRET_HD_D180_CC_01`: the context must fail to start or rewrite the hash; a handshake with the dev secret must then get 401 and a handshake with the env secret must succeed.

## 2. P1b-02 (Medium) — Admin account changes: last-admin guard, audit every password change, no finalising another admin's reset

- On prod at audit time: staging only
- Where: `src/main/java/com/samjhana/controller/AdminController.java:141-178` (reset), `:181-216` (change role), `:236-243` (deactivate refuses ADMIN only by current role); `src/main/java/com/samjhana/controller/AuthController.java:155-160,197-205` (admin changes another user's password given the current one, clears the forced-change flag, writes no audit row)
- Fix: Decision-free part: (a) in the on-behalf `change-password` branch refuse targets whose `mustChangePassword` is true, so the resetting admin cannot finalise the other admin's password; (b) write an audit row for every password change; (c) add a last-admin guard: refuse demoting or deactivating when it would leave no active admin, inside a transaction that locks the admin rows (`@Lock(PESSIMISTIC_WRITE)`). Owner decisions, do NOT build without an answer: re-entering the acting admin's password, second-admin confirmation or delay, expiry of temporary passwords.
- Test idea: as admin A, reset admin B, then call change-password naming B with the temporary password: expect refusal (B must choose their own); demoting B without A re-entering A's password is refused; two concurrent "demote the other admin" calls leave at least one active admin.

## 3. P1a-10 (Low) — Throttle failed charger handshakes per address and per charger code

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/websocket/OcppHandshakeInterceptor.java:38-52`; `src/main/java/com/samjhana/config/SecurityConfig.java:86-87,165-166`; `src/main/java/com/samjhana/config/OcppProperties.java:42-43`; public codes `src/main/java/com/samjhana/seed/ChargePointSeeder.java:36-38`
- Fix: throttle failed handshakes per remote address and per charge-point code (reuse `RequestThrottle` with a bounded table), add a short fixed delay after failures. (Refusing to start for secrets shorter than 24 characters is a strictness choice for the owner: leave it out unless told.)
- Test idea: 30 failed handshakes for one code from one address within a minute -> later attempts get 429 without a BCrypt call (verify with a spy on `PasswordEncoder`); startup with a 10-character `OCPP_SECRET_*` in the staging profile -> context fails.

## 4. P1a-02 (Medium) — Charger-side authorisation: unknown transactions and Authorize requests

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/websocket/OcppWebSocketHandler.java:86,102-108`; `src/main/java/com/samjhana/service/ChargeSessionService.java:223-228,431-454`
- Fix: (1) for any `TransactionEvent` that does not match a session, send `RequestStopTransaction` (or create a "walk-in" session in `AWAITING_PAYMENT` so the connector is held and the payment card appears) and raise a live alert; (2) answer `Authorize` and every `TransactionEvent` that carries an `idToken` with `idTokenInfo.status = Invalid` unless it is the server's own `Central` token for a known session; (3) on `BootNotification` push the authorization settings that forbid local and offline starts (OCPP 2.0.1 `AuthCtrlr`/`TxCtrlr` variables such as `LocalPreAuthorize`, `OfflineTxForUnknownIdEnabled`, `StopTxOnInvalidId` — check exact names and support in the vendor manual), and read `offline=true` events into an exceptions list for the manager.
- Test idea: with the local simulator, send a `Started` event with an unknown transaction id and no `remoteStartId` -> expect a `RequestStopTransaction` frame (or a new `AWAITING_PAYMENT` session plus a live alert); send `Authorize` with an arbitrary token -> expect `idTokenInfo.status` `Invalid`.

## 5. D-03 (Low) — OCPP connection registry: duplicate-connection handling and clean-up

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/ocpp/OcppConnectionRegistry.java:21-30,32-35,37-52`; `src/main/java/com/samjhana/websocket/OcppWebSocketHandler.java:38-44,111-117,125-142`; `src/main/java/com/samjhana/service/ChargePointService.java:37-51,62-68`; `src/main/java/com/samjhana/service/ChargeSessionService.java:524-529`
- Fix: in `register`, close the previous socket (`CloseStatus.POLICY_VIOLATION` with a "replaced" reason) and log a duplicate-connection warning; store the owning socket id in `PendingCommand` and delete only that socket's entries in `unregister`; have `unregister` return whether it removed the live entry and call `markDisconnected` only then; create the decorator once per socket (e.g. in `afterConnectionEstablished`, kept in the session attributes) and use it for handler replies too; catch `RuntimeException` (not only `IOException`) in `send` and drop the pending entry.
- Test idea: connect two simulated units with the same code, close the first: assert the charger stays ONLINE, a pending command on the second still completes, and the first was already closed at registration; separately, close the second while the first is still open: today `isConnected(C)` turns false although the first keeps answering heartbeats; after the fix the first was already closed at registration, so nothing is orphaned.

## 6. D-04 (Low) — WebSocket liveness: heartbeat sweep, idle limits, frame-size and message-rate limits

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/config/WebSocketConfig.java:29-37`; `src/main/java/com/samjhana/websocket/OcppWebSocketHandler.java:38-44,47-77,92`; `src/main/java/com/samjhana/service/ChargePointService.java:37-76`; `src/main/java/com/samjhana/ocpp/OcppConnectionRegistry.java:32-35`; `samjhana-admin/src/utils/evSession.js:13-15`
- Fix: add a `@Scheduled` sweep (every 15 s) that marks a charger OFFLINE and closes its socket when `lastHeartbeatAt` is older than ~3 x the 30 s interval; send a WebSocket ping every 30 s and set an idle timeout; configure `ServletServerContainerFactoryBean` explicitly (`maxTextMessageBufferSize` sized for the largest legitimate `TransactionEvent`, e.g. 32 KB, `maxSessionIdleTimeout`); refuse a second concurrent socket per code (see D-03); add a per-connection token bucket (e.g. 20 frames/s) that closes the socket with 1008 when exceeded; return an unusable state to the UI (grey the charger) when the heartbeat is stale.
- Test idea: connect a simulated charger, stop its heartbeats for 100 s and assert the charger is OFFLINE and the socket closed; send 1000 heartbeats in one second and assert the socket is closed with 1008 and the database saw far fewer than 1000 writes; send a 64 KB text frame and assert a clean 1009 close and no handler exception.

## 7. D-02 (Low) — Live EV feed: per-user socket and ticket caps, non-blocking broadcast

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/websocket/EvLiveWebSocketHandler.java:24-32,39-62`; `src/main/java/com/samjhana/websocket/LiveTicketService.java:28,39-46,56-59`; `src/main/java/com/samjhana/controller/EvLiveTicketController.java:22-25`; `src/main/java/com/samjhana/service/AfterCommit.java:18-29`; `src/main/java/com/samjhana/config/WebSocketConfig.java:34-36`
- Fix: keep `username` as part of the `sessions` entry and cap sockets per user (e.g. 3, close the oldest) and in total (e.g. 50); throttle `live-ticket` per user (e.g. 10/min, reuse the bounded `RequestThrottle` pattern) and cap `tickets` (reject above ~1000, purge from a `@Scheduled` task instead of on every issue); make `publish` hand the JSON to a bounded executor (or use `ConcurrentWebSocketSessionDecorator.OverflowStrategy.DROP` with a small buffer) so a slow reader can never block the committing thread, and wrap each send in `catch (Exception)` that closes that socket with `CloseStatus.POLICY_VIOLATION` and removes it; send the CONNECTED frame through the decorator; wrap the whole broadcast in `AfterCommit` with a catch-all so a broadcast failure can never reach the transaction's caller; add a maximum socket age (also fixes P1b-06).
- Test idea: connect one kiosk client that never reads and one that does; publish a few hundred ~1 KB events from several threads and assert the reading client gets all of them, no publisher call blocks more than ~100 ms and no exception reaches the caller; assert the 4th socket of one user closes the oldest; assert the 11th ticket request within a minute is refused (429).

## 8. P1b-06 (Low) — Live EV feed: re-check the account while a socket is open

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/websocket/EvKioskHandshakeInterceptor.java:29-42`; `src/main/java/com/samjhana/websocket/EvLiveWebSocketHandler.java:27-61`; `src/main/java/com/samjhana/service/ChargeSessionService.java:474-481`; `src/main/java/com/samjhana/dto/ChargeSessionResponse.java:21-23,62-65`
- Fix: store the user id and the password fingerprint/role in the WebSocket attributes at handshake and re-check them on every publish (or every N seconds) and close the socket with 4401 when the account is disabled, the password changed or the role changed; add a maximum socket age (e.g. 12 h) after which the client must fetch a new ticket; on deactivate/reset/role change, close that user's sockets immediately (keep a username -> sessions map).
- Test idea: open a socket for user U, deactivate U, publish an event: assert U's socket is closed and receives nothing.

## 9. P0-11 (Low) — Furniture stock changes: validate line quantities, use guarded updates

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/service/TransactionService.java:397-424`; `src/main/java/com/samjhana/strategy/impl/FurnitureStrategy.java:49-65`
- Fix: validate each line (`itemId` valid, `quantity` 1..N), use the guarded `removeStock` update for sales and `addStock` for purchases, audit stock changes.
- Test idea: furniture `SALE` with `quantity: -5` is rejected with 400.

## 10. P1a-13 (Low) — Furniture stock changes made atomic

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/service/TransactionService.java:202-204,413-420`; `src/main/java/com/samjhana/entity/FurnitureItem.java` (no `@Version`); atomic counterpart `src/main/java/com/samjhana/repository/FurnitureItemRepository.java:25-29`; shop availability `src/main/java/com/samjhana/service/ShopCatalogService.java:76,116`
- Fix: replace the read-modify-write with the existing guarded `removeStock` (fail the sale with 409 when stock is insufficient) and `addStock` for returns, exactly as the beekeeping path does; add `@Version` to `FurnitureItem` for the admin edit paths.
- Test idea: two threads each record a furniture sale of 1 for an item with stock 2 -> final stock 0; a sale of 3 for stock 2 -> 409 and stock unchanged.

## 11. P1a-05 (Low) — Online-order status changes made atomic

- On prod at audit time: staging only
- Where: `src/main/java/com/samjhana/service/ShopOrderService.java:199-225,247-255,258-298`; `src/main/java/com/samjhana/entity/ShopOrder.java:108-119` (no `@Version` field anywhere in the entity); `src/main/java/com/samjhana/controller/ShopOrderController.java:56-60`
- Fix: add `@Version` to `ShopOrder` (and catch `OptimisticLockingFailureException` as 409), or make the transition a guarded UPDATE (`... set status = :next where id = :id and status = :before`) and only run `recordSale`/`restoreStock` when exactly one row changed; additionally store the order number as a unique key on the generated sale (e.g. a unique `(business_id, reference_number)` for online-order sales).
- Test idea: call `updateStatus(id, "COMPLETED")` from two threads released by a latch -> expect exactly one SALE per business unit and one 409; cancel twice in parallel -> stock restored exactly once.

## 12. B-01 (Info) — Settings read access: allow-list instead of deny-list

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/controller/SystemSettingController.java:25,32-41`; policy `docs/ROLES.md:21`; test `src/test/java/com/samjhana/controller/RoleMatrixIntegrationTest.java:104,247-248`
- Fix: make the read the same as the write — `if (user == null || !user.canManage()) return 403;` for every key (or `@PreAuthorize("hasAnyRole('ADMIN','MANAGER')")` on the method), and answer 404 for keys outside `WRITABLE_KEYS` instead of echoing an empty value.
- Test idea: in RoleMatrixIntegrationTest add a second probe of `GET /api/settings/{key}` with a non-allow-listed key (e.g. `ev_rate_per_kwh`) expecting 403 for staff; unit test that `getSetting` refuses STAFF for an arbitrary key.

## 13. P0-13 (Low) — Public media: answer conditional requests without loading the image

- On prod at audit time: staging only
- Where: `src/main/java/com/samjhana/controller/MediaController.java:41-45`; `src/main/java/com/samjhana/entity/MediaAsset.java:44-47` (`data` is an eager `byte[]`); `MediaAssetRepository.java:17`
- Fix: answer the conditional request from metadata only (query without `data`, or `@Basic(fetch = LAZY)` with bytecode enhancement / a projection for the existence+etag check), and put a CDN or cache in front.
- Test idea: count DB reads (or assert the repository projection used) for a request carrying a matching `If-None-Match`.

## 14. P0-05 (Low) — Uploaded pictures: strip metadata, verify WebP

- On prod at audit time: staging only
- Where: `src/main/java/com/samjhana/service/MediaService.java:56-61,140-147,150-151`; `src/main/java/com/samjhana/controller/MediaController.java:46-52`
- Fix: decode and re-encode every upload (as `LoanReceiptService.resave` does) or strip metadata; verify WebP with an image reader (add a WebP ImageIO plugin) or accept only JPEG/PNG; add `Content-Security-Policy: sandbox` / `default-src 'none'` on the media response; shorten cache or add a versioned URL so deletions take effect.
- Test idea: upload a JPEG with an EXIF GPS block and assert the served bytes contain no EXIF; upload `RIFF....WEBP` + garbage and assert 400.

## 15. E-01 (Info) — Log hygiene: neutralise line breaks, validate SKU

- On prod at audit time: yes
- Where: src/main/resources/application.yml:134-136; src/main/java/com/samjhana/exception/GlobalExceptionHandler.java:95-98; src/main/java/com/samjhana/websocket/OcppWebSocketHandler.java:111-117; src/main/java/com/samjhana/service/FurnitureService.java:192,205; src/main/java/com/samjhana/controller/FurnitureController.java:78-80; src/main/java/com/samjhana/entity/FurnitureItem.java:14,33 (unique `sku`)
- Fix: neutralise in the Logback pattern, for example `%replace(%msg){'[\r\n]+',' | '}%n` (and the same for `%ex`), or switch to JSON logging; validate `sku` (length at most 64, `[A-Za-z0-9._-]`) and pre-check duplicates as `BeekeepingService.java:112` does; log only the constraint name, not the raw database message; log `status.getCode()` instead of the whole `CloseStatus`.
- Test idea: with a Logback `ListAppender`, trigger `handleConflict` with a message containing a line break and assert the formatted output is a single line; a `@SpringBootTest` that posts two furniture items with the same `sku` and expects 400 (not 409 plus a log line).

## 16. L-01 (Info) — Log hygiene: do not log database error messages

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/exception/GlobalExceptionHandler.java:95-99`; JDBC URLs `src/main/resources/application.yml:207,255`; PII-bearing unique keys `src/main/java/com/samjhana/entity/EvCustomerVehicle.java:27`, `User.java:39`
- Fix: log only the SQLState and constraint name (for example from Hibernate's `ConstraintViolationException.getConstraintName()`), never the message; additionally append `&logServerErrorDetail=false` to both JDBC URLs.
- Test idea: raise a `DataIntegrityViolationException` whose cause message contains a plate and assert (Logback `ListAppender`) that no captured log line contains it.

## 17. P1a-16 (Low) — Charger events: allowed session-state transitions

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/service/ChargeSessionService.java:239-267,429-444`; repository query `src/main/java/com/samjhana/repository/ChargeSessionRepository.java` (`findFirstByOcppTransactionIdAndChargePointCodeOrderByRequestedAtDesc`, no status filter)
- Fix: add an explicit transition table for charger events (Started/Updated only from STARTING/ACTIVE/STOP_REQUESTED; Ended only from ACTIVE/STOP_REQUESTED/PAID-in-AUTO; ignore and log everything else); restrict the transaction-id lookup to open sessions and, when a `remoteStartId` is present, prefer it; never update meter values on CLOSED/FAILED/CANCELLED sessions.
- Test idea: close a session with transaction id T; start a new session and send `Started` with id T and the new `remoteStartId` -> the new session becomes ACTIVE and the closed one is untouched; send `Started` for a CLOSED session's id -> ignored.

## 18. D-05 (Info) — Charger messages: validate field formats and lengths

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/websocket/OcppWebSocketHandler.java:73,89,100`; `src/main/java/com/samjhana/service/ChargePointService.java:56,73`; `src/main/java/com/samjhana/service/ChargeSessionService.java:211,245,287,294,304`; `src/main/java/com/samjhana/entity/ChargePoint.java:43-44,63-64`; `src/main/java/com/samjhana/entity/ChargeSession.java:104-105,110-111`
- Fix: validate OCPP fields at the handler edge (serial <= 25 and `[A-Za-z0-9._-]`, connector status from the OCPP `ConnectorStatusEnumType` list, transaction id <= 36, error text truncated to 200) and answer a CALLERROR `FormationViolation`/`PropertyConstraintViolation` instead of throwing; wrap `handleCall` in a `try/catch (RuntimeException)` that answers `InternalError` and keeps the socket open; make serial-number conflicts a logged warning rather than an exception.
- Test idea: send a `StatusNotification` with a 200-character status and assert a CALLERROR comes back, the socket stays open and the stored status is unchanged; send a `BootNotification` whose serial equals another charger's and assert it is answered without closing.

## 19. A-02 (Low) — Password rules: common-password list, username check, length message

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/controller/AuthController.java:186-190`; `src/main/java/com/samjhana/controller/AdminController.java:88-92`; `src/main/java/com/samjhana/seed/FirstRunInitializer.java:36-37,46-47,55`; `src/main/java/com/samjhana/security/LoginAttemptService.java:40,45`
- Fix: Write one shared `PasswordPolicy` for create, change and first-run; reject passwords from a bundled common/breached list and passwords that contain the username; apply the same check to `ADMIN_INITIAL_PASSWORD` at startup; state the 72 UTF-8 byte maximum with an English and Nepali message (or pre-hash before BCrypt). The audit suggests a minimum of 12 characters: that is a rule for the owner to choose, so keep the current minimum (8) unless the owner says otherwise.
- Test idea: `shouldRejectNewPassword_whenInCommonPasswordList`; `shouldRefuseStartup_whenAdminInitialPasswordIsTooShort`; `shouldShowPolicyMessage_whenPasswordLongerThan72Bytes` (EN and NE).

## 20. P1B1-02 (Low) — Rent and furniture order screens vs server validation

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/service/TransactionService.java:126-131` (also the update path `:331`); `src/main/java/com/samjhana/strategy/impl/RentalStrategy.java:56-68`; `src/main/java/com/samjhana/strategy/impl/FurnitureStrategy.java:50-67`; `samjhana-admin/src/pages/rental/RentalEntryPage.jsx:85-103`; `samjhana-admin/src/pages/furniture/FurnitureOrderPage.jsx:106-127`
- Fix: make the screens and the validators agree. Either send what the strategies ask for (`roomNo` from the property record, `tenantName`, and top-level `itemName`/`quantity` as `ShopOrderService` does), or change `RentalStrategy.validate` to the property-based shape (`propertyId`, `monthlyRent`) and `FurnitureStrategy.validate` to validate `items[]` (each line: `itemId`, `quantity >= 1`, `unitPrice >= 0`); then add an integration test per business unit that posts the exact JSON its screen sends.
- Test idea: for each of `petrol`, `ev`, `furniture`, `rental`, `beekeeping`, `loan`, a `@SpringBootTest` that POSTs the JSON built by the matching screen (copy the payload into a fixture) as STAFF/MANAGER and expects 200; today the `rental` and `furniture` cases return 400.

## 21. P1B1-04 (Low) — Rejected entries must not count on the module screens

- On prod at audit time: mixed (some parts on prod)
- Where: `src/main/java/com/samjhana/controller/RentalPropertyController.java:186-195,220-226`; `src/main/java/com/samjhana/service/FurnitureService.java:49-67,99-113`; `src/main/java/com/samjhana/service/BeekeepingService.java:63-70`
- Fix: apply one rule everywhere: exclude `REJECTED` (and, for loans, awaiting-review rows) in a shared repository query or a `TransactionVisibility.countsTowardTotals(t)` predicate and use it in `RentalPropertyController.getPropertyLedger`, `FurnitureService.getDashboard/listCustomers`, `BeekeepingService.getDashboard`; recompute the ledger from `monthlyRent` and the booked `amount` on the server instead of summing a client-typed `balance`.
- Test idea: create a rent payment, reject it, and assert `GET /api/rental-properties/{id}/ledger` no longer lists it and the outstanding balance returns to the earlier value; same for a furniture sale in `GET /api/furniture/dashboard` (`todayRevenue`, `pendingDeliveries`).

## 22. M-04 (Low) — Manual price fetch: no open transaction across the HTTP call, one fetch at a time

- On prod at audit time: mixed (some parts on prod)
- Where: `src/main/java/com/samjhana/service/FuelPriceService.java:78-82`; `src/main/java/com/samjhana/controller/FuelPriceController.java:73-80`; `src/main/java/com/samjhana/service/NocPriceScraperService.java:82-85`; `src/main/resources/application.yml` (no `hikari` key in any profile)
- Fix: do the HTTP fetch outside the transaction (remove `@Transactional` from `fetchNocPrices`; let only the save be transactional), add a single-flight guard (`AtomicBoolean`/lock, answer 409 while a fetch runs) and a minimum interval (for example 60 s) for manual triggers, set an explicit `maximumPoolSize`/`connectionTimeout` per profile, and set a total deadline on the request.
- Test idea: with a Jsoup stub that blocks, a second concurrent call returns 409 and `HikariPoolMXBean.getActiveConnections()` stays 0 during the fetch.

## 23. M-01 (Low) — Price scraper must not overwrite a manager's manual price

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/service/NocPriceScraperService.java:243-268` (esp. 247-257), scheduler `:62-70`; `samjhana-admin/src/pages/petrol/PetrolEntryPage.jsx:48-57,285-291`
- Fix: in `saveIfChanged` never update a row whose `updatedBy != null` (insert only when the date has no row, otherwise log "NOC differs from manual price" and leave it); refuse a scraped value that is outside a configured range or more than N percent away from the previous price and surface it for a manager's confirmation (this also closes P0-08); write an `AuditLog` row (source NOC/manager, old, new); add a settings-table switch for the scraper that managers can flip.
- Test idea: with a manual row for today (price 160, `updatedBy` set) and a mocked NOC page showing 150, `fetchAndSavePrices()` leaves 160 and the owner unchanged and records a warning; with no row for today it inserts.

## 24. M-02 (Low) — Price scraper: tie the price to the configured depot

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/service/NocPriceScraperService.java:92-105,109-122,125-130,160-175,177-219`; `src/test/java/com/samjhana/service/NocPriceScraperServiceTest.java:31-88`
- Fix: parse structurally (select the node that belongs to the configured depot, then read prices only from within that node), fail closed when the depot node is missing (drop strategy 3 and the 500-character look-behind), reject partial results or flag them, and compare with the previous price (see M-01 fix). Add parser tests with saved copies of the NOC page (current, restructured, depot missing).
- Test idea: fixture with two depots where Bhalbari is second: the stored price must be the second depot's; fixture with the depot missing: nothing saved and a visible warning.

## 25. M-03 (Low) — Price fetch: report failures and show staleness

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/service/NocPriceScraperService.java:79,132-135,155-157`; `src/main/java/com/samjhana/service/FuelPriceService.java:78-82`; `src/main/java/com/samjhana/controller/FuelPriceController.java:79`; `samjhana-admin/src/pages/petrol/FuelPricePage.jsx:105-106`; `samjhana-admin/src/pages/petrol/PetrolEntryPage.jsx:279-281`
- Fix: return a result object (`fetched`, `saved`, `reason`) from the scraper, have the endpoint answer 502/422 with a message when nothing was read, store `last_attempt_at/last_success_at/last_error` (system_settings is enough) and show "last NOC check" and a stale warning (> 2 days) on the Fuel Price page and next to "Today's rate".
- Test idea: with a mocked Jsoup throwing `IOException`, `POST /api/fuel-prices/fetch-noc` must not return the success shape; the settings row `last_error` is set.

## 26. F-05 (Low) — Loan receipts: one receipt, one payment

- On prod at audit time: staging only
- Where: `src/main/java/com/samjhana/service/LoanReceiptService.java:71-93`; `src/main/java/com/samjhana/service/TransactionService.java:76-82,87-88,158-169,196-197`; `src/main/java/com/samjhana/repository/LoanReceiptRepository.java` (single finder)
- Fix: (1) Store a SHA-256 of the original upload bytes and of the re-encoded bytes and refuse (or flag to the admin) a receipt whose hash matches one already attached; (2) make attach atomic: `UPDATE loan_receipts SET transaction_id = :tx WHERE id = :id AND transaction_id IS NULL` and fail the save when 0 rows change (or lock with `PESSIMISTIC_WRITE` in `requireAttachable`); (3) audit receipt uploads and attaches. A database unique index on the bank reference needs SQL on Supabase and is the owner's call (see N-02).
- Test idea: (none given; write one that fails on the current code first)

## 27. P0-15 (Low) — Authentication events and admin actions in the audit trail

- On prod at audit time: yes
- Where: `src/main/java/com/samjhana/controller/AuthController.java:57-81`; `src/main/java/com/samjhana/entity/AuditLog.java:63-67`; `src/main/java/com/samjhana/entity/User.java:76-80`; `src/main/java/com/samjhana/repository/AuditLogRepository.java:10-11`; `src/main/java/com/samjhana/controller/AdminController.java:65-122,218-246`; `src/main/java/com/samjhana/seed/FirstRunInitializer.java:64-74`
- Fix: record login success/failure with address and user agent (hashed or truncated per privacy needs) in `audit_logs`, populate `ipAddress/userAgent` from the request in the factory methods, add an ADMIN-only audit list endpoint/page, audit user create/deactivate, force `mustChangePassword` for the first-run admin and avoid logging the password (print once to stdout only if unavoidable, or require `ADMIN_INITIAL_PASSWORD`).
- Test idea: a failed and a successful login each create an audit row with an address; `POST /api/admin/users` creates a USER audit row.

## 28. P1B3-04 (Low) — Recovery runbook: no literal temporary password

- On prod at audit time: staging only
- Where: `docs/RECOVERY.md:17-26`
- Fix: replace the literal with a non-runnable placeholder (for example `'<PASTE-A-RANDOM-PASSWORD-HERE>'` plus a check that refuses the placeholder), or generate the value inside the SQL (`encode(extensions.gen_random_bytes(12), 'base64')`) and `RETURNING` it once; add a short expiry for temporary passwords (store `password_reset_at` and refuse logins with `must_change_password` older than e.g. 1 hour).
- Test idea: a docs lint in CI that fails when `docs/RECOVERY.md` contains a quoted literal inside `crypt(`; a unit test that a user whose temporary password is older than the limit cannot log in.

## 29. P0-14 (Info) — Admin app route /change-password on the server allow-list

- On prod at audit time: staging only
- Where: `samjhana-admin/src/App.jsx:345`; `samjhana-admin/src/utils/api.js:24-30`; `src/main/java/com/samjhana/config/SecurityConfig.java:89-116,130`
- Fix: add `"/change-password"` to the SPA allow-list (or serve the SPA fallback for every non-`/api` GET and let the router decide), and add an integration test that `GET /change-password` returns the app shell.
- Test idea: `SpaFallbackIntegrationTest` asserts 200 + HTML for `/change-password`.

## 30. G-04 (Low) — Date display in the admin app (time zone)

- On prod at audit time: mixed (some parts on prod)
- Where: samjhana-admin/src/pages/shared/RecordsPage.jsx:74-80; samjhana-admin/src/pages/petrol/FuelOrderPage.jsx:146-151; samjhana-admin/src/pages/admin/StaffManagementPage.jsx:236-240; samjhana-admin/src/pages/loans/LoanEntryPage.jsx:414,492; contrast samjhana-admin/src/utils/businessDay.js:1-30 (which handles "today" correctly)
- Fix: format date-only strings without `Date` (split on `-`), or build `new Date(y, m - 1, d)`, or pass `{ timeZone: 'UTC' }` to `toLocaleDateString`; put it in one `formatDate` helper beside `businessDay.js`.
- Test idea: Vitest with `process.env.TZ = 'America/New_York'`: `formatDate('2026-10-09')` must contain "9", for both locales.

## 31. H-01 (Low) — Public site links: re-check on read and in the browser

- On prod at audit time: mixed (some parts on prod)
- Where: `samjhana-web/src/site/links.js:5-10`; `samjhana-web/src/components/ui/SmartLink.jsx:29-38`; `samjhana-web/src/components/Footer.jsx:16,40`; `samjhana-web/src/components/Navbar.jsx:91`; `samjhana-web/src/components/home/ContactSection.jsx:38`; `samjhana-web/src/site/SiteContext.jsx:36-37`; `src/main/java/com/samjhana/service/SiteContentService.java:52-60,151-152`; `src/main/java/com/samjhana/controller/SiteContentController.java:20-23`; `samjhana-web/index.html:3-11`
- Fix: (1) in `resolveLink`, return `''` unless the value matches the server allow-list (`^(\/(?!\/|\\)|#|https?:\/\/|tel:|mailto:)`), and pass `contact.mapsUrl` through it in `Footer.jsx`, `Navbar.jsx` and `ContactSection.jsx`; (2) re-validate on read in `SiteContentService.getAll()/get()` (drop an unsafe link instead of serving it); (3) serve the public site with a CSP (`default-src 'self'; script-src 'self'; connect-src <API origin>; img-src 'self' <API origin>; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-src https://www.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`) plus `X-Content-Type-Options`, `Referrer-Policy`, HSTS, from the host config kept in the repo; (4) enable RLS (I-03).
- Test idea: Vitest. Render `Footer`, `Navbar` and `SmartLink` with a `contact.mapsUrl`/`href` that uses a non-allow-listed scheme, and assert that no anchor gets that `href`. JUnit: save a `site_content` row directly through the repository with an unsafe link, and assert that `getAll()` does not return it.

## 32. H-02 (Info) — Order tracking: keep the phone number out of the URL

- On prod at audit time: staging only
- Where: `samjhana-web/src/api/api.js:56-57`; `samjhana-web/src/pages/OrderPage.jsx:27,67`; `src/main/java/com/samjhana/controller/ShopOrderController.java:30-31`
- Fix: change tracking to `POST /api/public/shop/orders/track` with `{orderNumber, phone}` in the JSON body (keep the same 404 and throttle), and update `ordersApi.track`; keep `phone` out of every URL. Optionally add `Cache-Control: no-store` to the tracking response.
- Test idea: a MockMvc test that the GET-with-`phone` form is gone (405/404) and the POST form returns the masked view; a Vitest that `ordersApi.track` sends the phone in the body (axios mock sees no `params.phone`).

## Pieces left over from partly fixed findings

- **P1b-08**: add audit rows (existing `AuditLog.EntityType` values only; a non-null user) for the still-unaudited admin actions: website text and pictures (site content, media upload and delete), EV vehicle rates, furniture items and stock, rental properties and tenants, staff HR records, restaurant menu, customer delete, and daily-close and verify. Pattern to copy: `FuelPriceService.saveOrUpdatePrice` (PR #143) and `ChargeSessionService.recordCommand` (PR #145).
- **P0-12** and **P1b-03**: the remaining parts are owner decisions (DECISIONS-AND-OPS.md).

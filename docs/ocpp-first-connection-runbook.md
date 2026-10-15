# OCPP first real-charger connection — runbook

For the first test of the real Hardhitter DC charger against this backend. The goal: **whatever the charger does, we can reconstruct it afterwards from the logs and the database**, without a second test window.

This runbook covers the logging and audit trail. (The probe runner, discovery mode and admin diagnostics endpoints are a separate, later change; they are not described here.)

## 1. What gets recorded

| Where | What | Survives a redeploy? |
|---|---|---|
| Application log (stdout, plus `./logs/samjhana-os.log`) | Every request under `/ocpp`, every handshake and its reason, every OCPP frame in and out (masked), parsed lines for each message, commands and their replies, lock evidence, lifecycle, failures | stdout: as long as the host keeps it. **The log file does not survive a restart or redeploy** (the host's disk is ephemeral) |
| `ocpp_message_log` | every frame, in and out, with direction, action, message id, masked payload | yes (Supabase) |
| `ocpp_connection_log` | handshake accepted/rejected with reason, requests that never reached the handshake (near-miss URLs, 404s), connect / disconnect / reconnect / idle warnings | yes |
| `ocpp_command_log` | each command we sent (start, stop, unlock): why, latency, result / error / timeout | yes |
| `ocpp_session_evidence` | per charge session: stop sent, stop reply, `Ended`, connector status changes, unlock sent / reply, with a "released before / after our unlock" hint | yes |

Heartbeat frames are stored sampled, like they are logged (the first 20 per connection, then none; the counters in the `DISCONNECTED` line still count every frame). All other frames are stored in full.

Rows older than 30 days are deleted daily (`OCPP_LOGGING_RETENTION_DAYS`). Table sizes are logged at startup and daily against a 500 MB budget (`OCPP_LOGGING_DB_BUDGET_MB`; Supabase free tier is 500 MB — check your plan).

Writes to the database are asynchronous and bounded. If the database is down, the charger connection is unaffected and the same frames are still in the log output. If the queue overflows, oldest Heartbeat rows are dropped first and a WARN reports the count.

## 2. Charger-side settings

| Setting | Value |
|---|---|
| CSMS URL | `wss://<host>/ocpp/<chargePointId>` — for example `wss://api.example.org/ocpp/HD-D180-CC-01` |
| WebSocket subprotocol | `ocpp2.0.1` |
| Authentication | HTTP Basic. **Username = the chargePointId** (same as in the URL). Password = that charger's OCPP secret (`OCPP_SECRET_*` on the host; or rotate one in the admin and copy it once) |
| Security profile | 1 (Basic auth over TLS) |

**Only `/ocpp/<chargePointId>` is accepted.** This change does not alter accepted URLs; it only logs near misses.

**If the charger appends its own ID** to the URL you enter (many chargers do), the request becomes `/ocpp/<id>/<id>` and it is *not* accepted. The request log shows `shape=DOUBLED_CHARGE_POINT_ID`. Fix on the charger: enter the base URL **without** the ID (`wss://<host>/ocpp`) and let it append the ID. If it appends nothing, enter the full URL with the ID.

Other near-misses the log names: `TRAILING_SLASH` (`/ocpp/<id>/`), `EXTRA_SEGMENT` (`/ocpp/<id>/something`, for example a charger adding `/ocpp2.0.1`), `UNKNOWN_PREFIX` (`/ocpp2.0.1/<id>`), `MISSING_CHARGE_POINT_ID` (`/ocpp`). Note what the charger actually sees: under `/ocpp/`, such URLs are answered **HTTP 200 with the website's HTML** (the single-page-app fallback), not 404, so the charger just reports "handshake failed / unexpected response". `/ocpp2.0.1/<id>` and anything outside `/ocpp/` is answered 401 by Spring Security.

**If the charger only speaks OCPP 1.6** it offers `ocpp1.6`; the log shows `UNSUPPORTED_SUBPROTOCOL offeredProtocols=[ocpp1.6]` and the charger gets 426. This backend implements 2.0.1 only.

## 3. Settings for the test window

The defaults already log everything needed for the test. Nothing has to be changed. Optional extras (environment variables on the host; restart to apply):

| Variable | Default | Why change it |
|---|---|---|
| `LOGGING_LEVEL_COM_SAMJHANA_OCPP_LIFECYCLE=DEBUG` | INFO | adds Heartbeat lines, pongs and the "unread vendor keys" lines (fields in Boot / Status / TransactionEvent that nothing reads — useful to spot vendor-specific fields) |
| `OCPP_LOGGING_PING_INTERVAL=60s` | `0s` (off) | send WebSocket pings; each ping/pong is logged. Leave off unless you are chasing idle disconnects: the charger's Heartbeat normally keeps the link alive |
| `OCPP_LOGGING_COMMAND_TIMEOUT=45s` | `30s` | how long a command waits for its reply before a timeout is logged and recorded |
| `OCPP_LOGGING_HEARTBEAT_FULL_FRAMES=100` | 20 | log more Heartbeat frames in full (the rest are summarised: one line per 10) |
| `OCPP_LOGGING_HEARTBEAT_INTERVAL=30s` | `30s` | the heartbeat interval handed to the charger in the Boot reply (also drives the idle warning: no frame for 2× this) |
| `OCPP_LOGGING_WEB_SOCKET_MAX_MESSAGE_BYTES=131072` | 131072 | largest WebSocket frame accepted. Tomcat's own default (8 KB) would drop the connection with code 1009 on a large frame, such as a full `NotifyReport` |

**Never set** these (the app logs a `FORBIDDEN LOG SETTING` WARN at startup if it finds one, because they print the charger's `Authorization` header or other secrets):

- `SPRING_MVC_LOGREQUESTDETAILS=true`
- `LOGGING_LEVEL_ORG_SPRINGFRAMEWORK_WEB=TRACE`, or `..._WEB_SOCKET=DEBUG` / `TRACE`
- `LOGGING_LEVEL_ORG_APACHE_COYOTE=DEBUG` (Tomcat prints every raw request)
- `LOGGING_LEVEL_ROOT=DEBUG` / `TRACE` — a DEBUG root logger turns all of the above on. Raise single loggers instead.
- On staging and prod: `LOGGING_LEVEL_ORG_HIBERNATE_TYPE_DESCRIPTOR_SQL_BASICBINDER=TRACE` (prints bound SQL values, including secret hashes).

The `dev` profile deliberately keeps `BasicBinder: TRACE`, so a developer's laptop prints bound SQL values, including the BCrypt hashes of the *development* charger secrets. That is acceptable only for local data with `dev-*` secrets; never run `dev` against a shared database.

### Dialling down after the test

Set, then restart:

```
LOGGING_LEVEL_COM_SAMJHANA_OCPP_FRAMES=WARN          # keep only oversized / binary frames
LOGGING_LEVEL_COM_SAMJHANA_OCPP_LIFECYCLE=INFO       # or WARN
LOGGING_LEVEL_COM_SAMJHANA_OCPP_HANDSHAKE=WARN       # rejections and near-misses only
OCPP_LOGGING_RETENTION_DAYS=7
# or OCPP_LOGGING_PERSISTENCE_ENABLED=false to stop writing the audit tables altogether
```

Leave `com.samjhana.ocpp.commands` and `com.samjhana.ocpp.lockevidence` at INFO: they are low volume.

## 4. Reading the logs

Every OCPP line carries `[cp=<chargePointId> ws=<WebSocket session id> msg=<OCPP messageId> act=<action> cs=<charge session id>]` and a timestamp with milliseconds and a UTC offset (`+05:45` Nepal time, or `Z` for UTC; read the offset). The startup line `OCPP diagnostics ready. Server time UTC=… Nepal=…` shows both clocks.

Search the host log (or `grep` a downloaded copy) for these prefixes:

| Line starts with | Logger | Meaning |
|---|---|---|
| `REQUEST GET /ocpp/… -> 101` | `…ocpp.handshake` | an HTTP request under `/ocpp`; `101` = upgraded to WebSocket. Includes method, full URI (credential-looking query values masked), upgrade headers, offered subprotocols, remote address, `X-Forwarded-*`, User-Agent, Origin, response status and content type. `Authorization` and `Cookie` are reported by name only |
| `HANDSHAKE <REASON> …` | `…ocpp.handshake` | one line per handshake attempt with the outcome (table below) |
| `CONNECTED chargePointId=… sessionId=…` | `…ocpp.lifecycle` | WebSocket is up; negotiated subprotocol; server time in UTC and Nepal time |
| `FRAME IN` / `FRAME OUT size=…B [...]` | `…ocpp.frames` | the exact OCPP-J frame (idToken masked), logged **before** parsing, so malformed frames are captured |
| `HEARTBEAT summary: …` | `…ocpp.frames` | Heartbeat frames after the first 20 are summarised, one line per 10 |
| `BOOT reason=… vendor=… model=… serial=… firmware=…` | lifecycle | BootNotification. `BOOT serial MISMATCH` / `model MISMATCH` = differs from the `charge_points` row |
| `STATUS evse=… connector=… connectorStatus=…` and `CONNECTOR STATUS CHANGE … old -> new` | lifecycle | StatusNotification, with the evse/connector ids |
| `TRANSACTION EVENT eventType=…` + `METER VALUE …sampledValues=[{measurand=… value=… unit=… context=… location=… phase=…}]` | lifecycle | every TransactionEvent field and every sampled value |
| `SoC present=true value=57%` / `SoC present=false (…)` | lifecycle | one explicit line per event: does this charger report state of charge or not |
| `ENERGY … DECREASED` / `RESET to zero` | lifecycle (WARN) | the energy register went backwards |
| `CLOCK SKEW 3s on TransactionEvent` | lifecycle | charger time minus server time; WARN above 60 s. (The 2.0.1 Boot and Heartbeat requests carry no charger time, so skew comes from Status / TransactionEvent timestamps) |
| `COMMAND SENT RequestStartTransaction messageId=… reason="…"` | `…ocpp.commands` | a command we sent, with why |
| `COMMAND RESULT … latency=…ms status=… reasonCode=…` | commands | the matched CALLRESULT |
| `COMMAND ERROR … errorCode=… errorDescription=… errorDetails=…` | commands (WARN) | the matched CALLERROR |
| `COMMAND TIMEOUT …` / `COMMAND LOST …` | commands (WARN) | no reply in 30 s / charger disconnected before replying |
| `UNMATCHED CALLRESULT` / `LATE REPLY` | commands (WARN) | a reply for a messageId nobody is waiting for / a reply after the timeout |
| `LOCK EVIDENCE session=… \| … STOP_SENT … TX_ENDED … UNLOCK_SENT … \| verdict=…` | `…ocpp.lockevidence` | one line per session, see §5 |
| `CHARGE SESSION <id> on <cp>: OLD -> NEW` | lifecycle | every charge-session state change |
| `CHARGE POINT <cp> connection_status: OFFLINE -> ONLINE` | lifecycle | every charge_points change |
| `MALFORMED JSON` / `INVALID OCPP-J FRAME` / `UNKNOWN MESSAGE TYPE` | lifecycle (WARN) | with the raw payload (stack trace for malformed JSON) |
| `UNKNOWN ACTION 'X'` | lifecycle (WARN) | an action this CSMS does not implement; payload logged; answered `NotSupported` |
| `ACTION Authorize received but not implemented` | lifecycle | `Authorize`, `MeterValues`, `SecurityEventNotification`, `NotifyReport`, `NotifyEvent`, `FirmwareStatusNotification`, `LogStatusNotification`: logged with payload, answered `NotSupported` |
| `MISSING REQUIRED FIELD(S) in …` | lifecycle (WARN) | log-only check; the frame is still processed |
| `Handler failed for action … (messageId=…)` | `OcppWebSocketHandler` (ERROR, stack trace) | an exception; the charger gets a `CALLERROR InternalError` and the socket stays open |
| `TRANSPORT ERROR chargePointId=… sessionId=…` | lifecycle (WARN, stack trace) | network-level failure |
| `DISCONNECTED … closeCode=… reason=… duration=… framesIn=… framesOut=… sinceLastFrame=…` | lifecycle | INFO for normal closes, WARN otherwise. `1006` = the connection dropped without a close frame (network, proxy or power); `1009` = frame too big; `4001` = replaced by a newer connection |
| `RECONNECT … replaces oldSessionId=…` and `STALE session … closed` | lifecycle (WARN) | the charger reconnected before the old socket closed; the old one is closed and ignored — the charger stays ONLINE |
| `IDLE chargePointId=…: no frame for …s` | lifecycle (WARN) | no frame for more than 2× the heartbeat interval |
| `OCPP audit insert failed …` / `OCPP audit queue was full: dropped N rows` | `OcppAuditWriter` (WARN) | the database is not keeping up; the log output still has everything |

### Handshake reasons and the likely fix

The charger only ever sees 401 (or 426 for a protocol problem); the reason is in `HANDSHAKE <REASON>`:

| Reason | Likely cause → fix |
|---|---|
| `ACCEPTED` | success |
| `NO_SUBPROTOCOL` | the charger offered no `Sec-WebSocket-Protocol` → enable OCPP 2.0.1 on the charger |
| `UNSUPPORTED_SUBPROTOCOL` | the offered list (logged) has no `ocpp2.0.1`, for example only `ocpp1.6` → set the charger to OCPP 2.0.1; if it cannot, this backend cannot serve it |
| `UNKNOWN_CHARGER` | the last URL segment is not a `charge_points.code` → check the ID (also look for `DOUBLED_CHARGE_POINT_ID`) |
| `INACTIVE_CHARGER` | the charger row has `is_active = false` → activate it |
| `NO_SECRET_HASH` | the row has no OCPP secret → rotate the secret in the admin |
| `NO_AUTH_HEADER` | the charger sent no `Authorization` header → enable Basic auth / security profile 1 on the charger |
| `MALFORMED_BASIC` | the header is not `Basic base64(user:password)` (the log says "not Basic" or "Basic but not parsable") → check the auth type on the charger; some chargers need the password entered as plain text, not hex |
| `USER_MISMATCH` | Basic username ≠ the charger ID in the URL (the username that was sent is logged) → set the username to the chargePointId |
| `BAD_PASSWORD` | right user, wrong password → re-enter the secret (rotate and copy again) |
| `ORIGIN_REJECTED` | the charger sent an `Origin` header that is not allowed (403 before our code) → real chargers do not send one; check for a browser or proxy |
| `UPGRADE_FAILED_HTTP_<n>` (in `ocpp_connection_log.reason`) | the handshake was accepted but the HTTP upgrade itself failed (missing `Upgrade` / `Sec-WebSocket-Key` / wrong version) → read the matching `REQUEST` line |
| `HTTP_<n>_BEFORE_HANDSHAKE` | the request died before the interceptor, for example 401 from Spring Security on a wrong path |

## 5. Lock evidence

The question: does the connector release by itself after the stop, or only after our `UnlockConnector`? For each session the `LOCK EVIDENCE` line lists timestamped events: `STOP_SENT`, `STOP_REPLY`, `TX_ENDED` (with `stoppedReason`), `CONNECTOR_STATUS … Occupied->Available`, `UNLOCK_SENT`, `UNLOCK_REPLY` (`Unlocked`, `UnlockFailed`, `OngoingAuthorizedTransaction`, `UnknownConnector`), `STATUS_AFTER_UNLOCK`. The line ends with `verdict=`:

- `RELEASED_BEFORE_OUR_UNLOCK` — the connector reported `Available` before we sent the unlock → it released by itself
- `RELEASED_AFTER_OUR_UNLOCK` — it only became `Available` after the unlock
- `RELEASE_NOT_OBSERVED` — no `Available` status followed; look at the car and the physical lock

The verdict is a hint based on connector status, not proof of the physical latch. Always note by eye when the plug could be pulled. The summary is emitted when the sequence has been quiet for 2 minutes, or when the next session starts on the same charger.

## 6. Firewall: failures that never reach the application

Nothing the app does can log a request that never arrives. These leave **no line in our log and no database row**; check outside the app:

| Symptom on the charger | Where to look |
|---|---|
| "TLS handshake failed", "certificate error" | The charger's own log/screen. Does the charger trust the host's certificate chain? Does it support TLS 1.2? Does it send SNI? Try the URL from a laptop with a WebSocket client |
| "DNS failure" / "host not found" | DNS for the host name (and whether a CDN / DNS proxy such as Cloudflare is in front; this repo does not configure one, so check the DNS records) |
| Connection refused / timeout / `ws://` (not `wss://`) | The charger may speak plain `ws://` on port 80. The host redirects HTTP to HTTPS; many WebSocket clients do not follow redirects. Look in the host's request log for `301` / `302` |
| Charger reports a 5xx | The host's request log: `502` / `503` / `504` during a deploy, a cold start, or an idle timeout. Check the service's events and deploy history |
| Everything looks fine, no `REQUEST` line | The host's HTTP request log. On Render: Dashboard → the service → **Logs** and **Events** (I could not verify which request-level details your Render plan shows for WebSocket upgrades; confirm this *before* test day). Look for the charger's public IP, `GET /ocpp/...`, and status codes: `101` = upgrade accepted, `301/302` = redirect, `400/403/426/5xx` = rejected |

**Rule of thumb.** If the charger says it cannot connect and the log has **no** `REQUEST` or `HANDSHAKE` line for it, the problem is before the app. If there is a `REQUEST` line, read its `-> status`, `shape=` and `reason=`.

## 7. Test-day checklist

### Before

- [ ] Run `docs/sql/2026-10-ocpp-diagnostics.sql` on the Supabase project the target environment uses (staging first). **Staging uses `ddl-auto: validate` and will not start without these tables.**
- [ ] Env on the host: a real `JWT_SECRET`, real `OCPP_SECRET_*` for each charger, no `FORBIDDEN LOG SETTING` in the startup log.
- [ ] After deploy, find in the log: `OCPP diagnostics ready. Server time UTC=… Nepal=…`, `BLIND SPOT: …`, and `OCPP audit size: …` (confirms the tables exist).
- [ ] Dry run with the simulator (`tools/ocpp-simulator`) against **staging only**, never prod or the real charger: confirm `HANDSHAKE ACCEPTED`, `CONNECTED`, `FRAME IN/OUT`, `BOOT …`, rows in `ocpp_message_log`.
- [ ] Confirm what the host's request log shows, and who can read it on test day.
- [ ] Write down the charger's ID, secret hand-off path, and URL settings (§2).
- [ ] Decide who watches the log live and who is at the charger.

### During

Keep a written timeline: wall-clock time at the charger (Nepal), the matching US time, and what you did. Fill in this table; log timestamps carry their own offsets.

| Step | Nepal time (UTC+5:45) | US time | Notes (what you saw on the charger and the car) |
|---|---|---|---|
| Charger powered on / configured | | | |
| Plug-in | | | |
| Remote start requested | | | |
| Charging started | | | |
| Stop requested | | | |
| Unplug attempt (before unlock) | | | |
| Unlock requested | | | |
| Unplug attempt (after unlock) | | | |

Converting: Nepal = UTC + 5:45. Example: 10:00 Nepal = 04:15 UTC = 00:15 US Eastern (EDT, UTC−4, until Sun 1 Nov 2026; after that EST is UTC−5, so 23:15 the day before) = 21:15 the day before US Pacific (PDT, UTC−7).

Watch live for: `HANDSHAKE`, `CONNECTED`, `BOOT`, `COMMAND`, `WARN`, `ERROR`, `IDLE`. After each step note whether `COMMAND RESULT status=` was `Accepted` and what the car and charger did.

### After — do this immediately

The container's log file does not survive a restart or redeploy, and the host keeps stdout for a limited time. **Export before anything else, before redeploying.**

1. Download or copy the host's log for the test window.
2. Export the tables (replace the time range; run in the Supabase SQL editor or `psql`):

```sql
\copy (select * from ocpp_message_log   where received_at >= '2026-10-20 00:00+00' order by id) to 'ocpp_message_log.csv' csv header
\copy (select * from ocpp_connection_log where created_at >= '2026-10-20 00:00+00' order by id) to 'ocpp_connection_log.csv' csv header
\copy (select * from ocpp_command_log   where sent_at    >= '2026-10-20 00:00+00' order by id) to 'ocpp_command_log.csv' csv header
\copy (select * from ocpp_session_evidence where created_at >= '2026-10-20 00:00+00' order by id) to 'ocpp_session_evidence.csv' csv header
```

3. Keep the exports with your timeline notes. The 30-day retention will otherwise remove them.
4. Then dial the logging down (§3).

## 8. SQL for common questions

All times are `timestamptz`. Replace `HD-D180-CC-01` as needed.

Frames per charger in the last hour:

```sql
select charge_point_id, direction, action, count(*) as frames
from ocpp_message_log
where received_at > now() - interval '1 hour'
group by 1, 2, 3
order by 1, 4 desc;
```

Does this charger report SoC? (any TransactionEvent with an SoC sampled value, and the latest value)

```sql
select count(*) filter (where payload like '%"measurand":"SoC"%') as events_with_soc,
       count(*)                                                  as transaction_events
from ocpp_message_log
where charge_point_id = 'HD-D180-CC-01' and direction = 'IN' and action = 'TransactionEvent' and message_type = 2;

select received_at, payload
from ocpp_message_log
where charge_point_id = 'HD-D180-CC-01' and action = 'TransactionEvent' and message_type = 2
  and payload like '%"measurand":"SoC"%'
order by received_at desc limit 5;
```

Lock evidence per session:

```sql
select created_at, charge_session_id, ocpp_transaction_id, summary
from ocpp_session_evidence
where charge_point_id = 'HD-D180-CC-01'
order by created_at;
```

Rejected handshakes and why:

```sql
select created_at, charge_point_id, reason, remote_addr, forwarded_for, offered_protocols, user_agent, detail
from ocpp_connection_log
where event = 'HANDSHAKE_REJECTED'
order by created_at desc limit 50;
```

Near-miss URLs (the charger used a path we do not accept):

```sql
select created_at, reason, request_uri, http_status, remote_addr, user_agent
from ocpp_connection_log
where event = 'REQUEST_NEAR_MISS'
order by created_at desc limit 50;
```

Connection timeline (connects, disconnects with close codes, reconnects, idle warnings):

```sql
select created_at, event, reason, close_code, ws_session_id, remote_addr, detail
from ocpp_connection_log
where charge_point_id = 'HD-D180-CC-01' and event in ('CONNECTED','DISCONNECTED','RECONNECT','IDLE_WARNING')
order by created_at;
```

Commands, their latency and what the charger answered:

```sql
select sent_at, action, outcome, response_status, reason_code, error_code, error_description, latency_ms, reason, charge_session_id
from ocpp_command_log
where charge_point_id = 'HD-D180-CC-01'
order by sent_at;
```

Everything around one session (frames in time order for its transaction id):

```sql
select received_at, direction, action, message_type, payload
from ocpp_message_log
where charge_point_id = 'HD-D180-CC-01'
  and received_at between '2026-10-20 04:00+00' and '2026-10-20 05:00+00'
order by received_at, id;
```

Table sizes:

```sql
select relname, pg_size_pretty(pg_total_relation_size(relid)) as size
from pg_catalog.pg_statio_user_tables
where relname like 'ocpp\_%' order by pg_total_relation_size(relid) desc;
```

## 9. Known blind spots (no log line and no database row)

- Anything before the application: DNS, TLS, the host's proxy, any CDN/edge (§6).
- The charger's own screen, error codes and logs, and what the car does. Write these down by hand.
- The physical connector latch. The lock evidence is derived from OCPP messages only.
- A charger that connects but never sends a frame: you will see `CONNECTED` and later `IDLE`, but no frames.
- Frames the container rejects as too big (above 128 KB): you will see `DISCONNECTED closeCode=1009`.
- If persistence is disabled, or the database is down, the same facts exist only in the log output; if the host log is not kept, they are gone.
- Clock skew is only computed from timestamps inside Status / TransactionEvent / MeterValues, because the 2.0.1 Boot and Heartbeat requests carry no charger time.

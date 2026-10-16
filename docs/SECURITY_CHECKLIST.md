# Security & Release Readiness Checklist

> Planning checklist for Samjhana Ventures OS; **not** a claim that each issue is exploitable or that each control is missing. Confirm findings in the current code, open PRs and deployed infrastructure before marking complete. Track evidence and owner for every resolved item.
>
> Baseline examples from `src/main/resources/application.yml` (reviewed 2026-10-16): JWT access token lifetime is configured as 168 hours; IP-based login limits default to disabled pending trusted proxy verification; the public API intentionally exposes selected catalogue/website routes; Swagger is disabled outside dev by default. Existing mitigations may already cover parts of the tasks below.

## P0 — Authentication, authorization and secrets
- [ ] Inventory backend controllers, services, WebSocket/OCPP operations and both React apps; classify every endpoint as public, authenticated, role-limited or owner-limited.
- [ ] Verify server-side authorization at every sensitive operation and resource lookup (BOLA/IDOR): users, staff, inventory, files, carts, orders, payments and charger/session resources where applicable. Add cross-user/role regression tests.
- [ ] Review JWT signing, validation, issuer/audience, clock skew, logout and expiry policy. Reduce the seven-day bearer-token exposure through a documented short-lived access-token policy and secure renewal/rotation where appropriate.
- [ ] Validate the actual client IP through the trusted Render proxy chain before enabling the IP login limiter; enforce login throttling by account and verified client address, plus generic error messages to limit enumeration.
- [ ] Ensure secrets are supplied by environment secret storage; require strong unique values per environment for JWT, database, OCPP and third-party credentials. Remove unsafe production fallbacks and rotate confirmed exposures.
- [ ] Review open security PRs individually for applicability, conflicts, correctness and passing tests. **Do not mass-merge** without review.

## P1 — API, browser and business logic
- [ ] Validate all untrusted input, identifiers and payload sizes; constrain mass assignment, file names/types, uploads and outbound URLs (SSRF).
- [ ] Verify public e-commerce endpoints expose only intended read data. Recalculate totals, stock, discounts, taxes and prices on the server and make order placement idempotent/transactional.
- [ ] Check CSRF protections wherever cookie-based authentication is used; validate CORS against exact deployment origins and reject unauthorized credentials/origins.
- [ ] Confirm safe password hashing, account recovery, admin privilege changes and session invalidation.
- [ ] Protect admin routes and management/debug endpoints in backend and ingress; ensure dev Swagger and H2 console are unreachable in staging/prod.
- [ ] Review React rendering and user-supplied HTML for XSS; enforce an appropriate Content Security Policy and security headers.
- [ ] Review WebSocket handshake authorization and message-level permission checks; validate OCPP charger identity, per-device credentials and command authorization.
- [ ] Ensure error responses do not disclose stack traces, SQL, internal paths, credentials or sensitive business data.
- [ ] Review third-party integrations, webhooks and external callbacks for signature verification, replay protection and timeouts.

## P1 — Infrastructure, CI/CD and visibility
- [ ] Configure protected default/release branches, required CI checks, minimal GitHub Actions permissions, pinned action versions and human review for deployments.
- [ ] Run backend/frontend dependency and container vulnerability scanning, SAST, secret scanning and license checks; define severity-based remediation SLAs.
- [ ] Use non-root container processes, pinned supported runtimes, restricted service permissions and minimal exposed ports.
- [ ] Verify TLS, application security headers, production domains, secure cookies (if used), and environment separation on Render/Supabase.
- [ ] Record security-relevant events (failed logins, access denials, privileged changes, critical orders and charger operations) with correlation IDs, sensible retention and sensitive-field redaction.
- [ ] Establish alerting for login abuse, unusual API activity, deployment failures, dependency advisories and database health.
- [ ] Maintain and test a security incident response and credential-rotation procedure.

## P2 — Verification before customer launch
- [ ] Add negative authorization tests: anonymous, wrong-role, cross-tenant/cross-user, expired token, replayed request and malformed input.
- [ ] Add end-to-end purchase, stock-race, privilege escalation, upload and WebSocket/OCPP abuse tests as applicable.
- [ ] Perform a focused manual security review or penetration test on staging with a production-like configuration and synthetic data.
- [ ] Confirm backups/restores and schema deployment safeguards in [DATABASE_CHECKLIST.md](DATABASE_CHECKLIST.md).
- [ ] Define release go/no-go criteria; ensure all confirmed critical/high exploitable issues are fixed or have documented risk acceptance.

## Completion criteria
- [ ] All sensitive operations enforce tested server-side permissions.
- [ ] Session, login throttling, secrets and production configuration are reviewed and validated.
- [ ] CI security checks and deployment approvals are required.
- [ ] No unresolved critical/high exploitable findings without explicit risk acceptance.
- [ ] Staging security smoke tests and incident/restore drills pass.

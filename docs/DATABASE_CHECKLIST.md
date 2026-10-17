# Database Production Readiness Checklist

> Planning checklist, not evidence that controls are implemented. Verify against the current code and deployment before checking off an item. **Do not reset staging or production without an approved backup and explicit authorization.**
>
> Current baseline (reviewed 2026-10-16): local dev uses file-based H2; staging and production use separate Supabase PostgreSQL connections; staging uses `ddl-auto: validate`; production defaults to `DDL_AUTO:update` in `src/main/resources/application.yml`. The README indicates the development seeder runs in dev only.

## P0 — Environment isolation and schema safety
- [ ] Confirm dev, staging and prod each use distinct databases, accounts, credentials and storage; verify Supabase project isolation and Render environment wiring.
- [ ] Add a Docker Compose PostgreSQL service for local dev. Pin a supported PostgreSQL major version compatible with the Supabase deployments; use a local-only port, persistent volume, health check and non-production credentials.
- [ ] Update the dev Spring profile and README for PostgreSQL; preserve a safe migration path for local H2 data (disposable test data may be discarded only after confirmation).
- [ ] Keep embedded H2 only where explicitly needed for isolated tests, and test database-specific behavior against PostgreSQL.
- [ ] Add Flyway to the backend and establish a version-controlled baseline migration capturing the **actual** current PostgreSQL schema, constraints, indexes and required extensions. Inspect existing schemas before baselining; do not blindly baseline or overwrite populated environments.
- [ ] Choose a safe strategy for existing staging schema (baseline after verification or rebuild only after an approved reset). Prove that migrating a fresh database and upgrading an existing database both work.
- [ ] Set Hibernate `ddl-auto: validate` in dev/staging/prod after migrations are working. Remove the production `DDL_AUTO:update` default and prohibit accidental `create`, `create-drop` and `update` in deployed environments.
- [ ] Run schema migrations as an explicit, gated deployment step with a properly scoped database role rather than granting the application routine DDL privileges.
- [ ] Add CI checks to verify migration ordering, checksums, rollback/forward-fix plans and fresh-install compatibility; fail deployment on migration failure or schema drift.

## P1 — Test data and data protection
- [ ] Keep **one shared deterministic fake-data generator** usable in local dev and staging; allow optional larger staging scenarios without maintaining two conflicting seed definitions.
- [ ] Require an explicit environment allowlist and a second production-denial guard for seeding; verify production cannot run it even under a misconfigured profile.
- [ ] Make seeds idempotent, clearly synthetic and free of real customer or staff information; ensure test logins are not accessible in production.
- [ ] Start production with the fully migrated schema and necessary non-sensitive reference data, but no fake customers or orders.
- [ ] Enforce least-privilege database roles for runtime, migrations and read-only/analytics access; rotate and separately store credentials.
- [ ] Verify PostgreSQL TLS certificate validation, connection pooling/timeouts, transaction boundaries and database connection limits in Supabase.
- [ ] Enable automated backups/PITR appropriate to the plan, define RPO/RTO, and **test restore** to an isolated database.
- [ ] Review unique constraints, foreign keys, nullability, indexes, pagination and transaction consistency for critical entities and e-commerce orders.
- [ ] Design backwards-compatible expand/migrate/contract changes and rehearse staging deployments before production.

## P2 — Operational verification
- [ ] Add migration and integration tests using PostgreSQL (e.g., Testcontainers) for new installs and upgrades.
- [ ] Add deploy checks for database connectivity, migration status, schema validation and application health.
- [ ] Monitor slow queries, pool saturation, replication/backup status, disk usage and migration errors; avoid logging credentials or personal data.
- [ ] Document recovery steps, migration ownership, emergency forward fixes, and a production release checklist.

## Completion criteria
- [ ] Local dev and Supabase environments have consistent PostgreSQL behavior.
- [ ] All schema changes are reviewed, versioned and applied through Flyway.
- [ ] No deployed service auto-modifies schema at application startup.
- [ ] Dev/staging can be seeded safely; production seeding is impossible by design.
- [ ] Staging migration rehearsal and an isolated backup restore have passed.

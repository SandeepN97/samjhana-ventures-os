# Contributing

Keep changes small, preserve the public/private API boundary, and test the path you change.

## Read first

- [README](README.md) — local setup and common commands
- [Architecture](docs/ARCHITECTURE.md) — system boundaries and request flow
- [Features](docs/FEATURES.md) — implemented capabilities and API overview
- [EV charging architecture](docs/EV-CHARGING-ARCHITECTURE.md) — OCPP behavior and known limits
- [Claude project guidance](CLAUDE.md) — repository conventions used by coding agents

## Non-negotiable boundaries

- `samjhana-admin` is the private ERP UI.
- `samjhana-web` is public and may call only `/api/public/**`.
- Public responses must not expose costs, profit, stock levels, staff data, or internal IDs.
- UI changes must retain English and Nepali translations and 44px minimum touch targets.
- Persisted business records use soft deletion; do not introduce hard deletes.

## Current backlog

Only these repository-wide infrastructure items remain open:

1. Add versioned production database migrations and move the existing SQL in
   `docs/migrations/` under that tool before changing production Hibernate from
   `update` to `validate`.
2. Add a PostgreSQL backup-and-restore runbook with a recurring restore drill.

Track feature requests in the issue tracker instead of growing another speculative roadmap.

## Workflow

1. Create a focused branch using the prefixes documented in `CLAUDE.md`.
2. Change the smallest surface that solves the request.
3. Add or update tests for changed behavior.
4. Run the relevant checks below.
5. Open a PR; merging to `main` requires another approval.

## Verification

Backend:

```bash
mvn test
```

Admin UI:

```bash
cd samjhana-admin
npm test
npm run lint
npm run build
```

Public website:

```bash
cd samjhana-web
npm test
npm run lint
npm run build
```

Browser tests:

```bash
cd samjhana-admin
npm run test:e2e
```

Do not use production credentials or databases for local or automated tests.

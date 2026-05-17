
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Samjhana Ventures OS** — a multi-business ERP for a Nepal-USA family operation.
Five business units: petrol pump (Shringeshwor), EV charging, furniture shop, house rentals, bank loans.

**Stack:** Java 21 + Spring Boot 3.2.1 backend · React 18 + Vite + Tailwind frontend · H2 (dev) / PostgreSQL (prod) · JWT auth · i18next (English/Nepali with Devanagari numerals)

**Two frontends:**
- `samjhana-admin/` — internal ERP UI; dev at localhost:5173, bundled into JAR in prod (Tailscale-only)
- `samjhana-web/` — public-facing customer website (furniture catalogue, EV rates, fuel prices); dev at localhost:5175

---

## Commands

### Backend
```bash
# Dev (skips frontend build, enables H2 console at /h2-console)
mvn spring-boot:run -Pdev

# Run all tests
mvn test

# Run a single test class
mvn test -Dtest=TransactionServiceTest

# Production JAR (builds samjhana-admin and bundles it)
mvn clean package -Pprod
```

### samjhana-admin (internal ERP)
```bash
cd samjhana-admin
npm install
npm run dev        # localhost:5173
npm run build
npm test           # vitest run (single pass)
npm run test:watch
npm run lint
```

### samjhana-web (public site)
```bash
cd samjhana-web
npm install
npm run dev        # localhost:5175
npm run build
```

---

## Architecture

### Request flow
```
Browser → samjhana-admin (5173) or samjhana-web (5175)
        → Vite proxy → Spring Boot API (8080)
        → JwtAuthFilter → Controller → Service → Repository → H2/PostgreSQL
```

In production the admin frontend is served as static files embedded in the Spring Boot JAR. The public site (`samjhana-web`) is deployed separately.

### API security boundary
- `/api/auth/**` — unauthenticated (login)
- `/api/public/**` — unauthenticated, read-only; consumed by `samjhana-web`; **must never expose** profit, cost prices, WAC, stock levels, staff data, or internal IDs
- All other `/api/**` — requires JWT; role-based via `@PreAuthorize`

### Strategy pattern for business calculations
Each business unit has a `BusinessCalculationStrategy` implementation:

| Business code | Strategy class |
|---|---|
| `petrol` | `PetrolStrategy` |
| `ev` | `EVStrategy` |
| `furniture` | `FurnitureStrategy` |
| `rental` | `RentalStrategy` |
| `loan` | `LoanStrategy` |

`CalculationEngine` is a Spring service that auto-discovers all strategies via `List<BusinessCalculationStrategy>` injection and dispatches by `businessCode`. To add a new business unit: implement the interface, annotate `@Service`, and it auto-registers.

### Universal transaction model
`Transaction` has a `customFields` JSON column that stores business-specific data without schema migrations. The shape varies per business (liters + density for petrol, meter readings for EV, room + tenant for rental, etc.) — see the entity Javadoc for full examples of each shape.

### Bilingual UI (samjhana-admin)
All UI strings must have both `en` and `ne` translations in `samjhana-admin/src/i18n/index.js`. The app defaults to Nepali (`ne`). Numbers use Nepali Devanagari numerals when in Nepali locale. Use the `useTranslation()` hook and `t('key')` — never hardcode display strings. Nepal-facing numbers always use Lakhs/Crores format (1,00,000 not 100,000).

### Nepal operator UI
Touch targets must be ≥ 44px on all interactive elements.

### Data integrity
No hard deletes — always use soft delete with a `deletedAt` timestamp.

### State management (samjhana-admin)
Zustand stores in `samjhana-admin/src/` manage auth token and UI state. Auth token is stored in `localStorage` under `token`; the private route check in `App.jsx` reads this directly.

### Data seeding
`DataSeeder` (`@Profile("dev")`) runs on startup in dev only and seeds users, business units, and EV vehicles. Dev credentials: `admin/admin`, `manager/manager`, `staff/staff`.

### Profiles
- **dev**: H2 file-based DB at `./data/samjhana-db`, H2 console enabled, verbose SQL logging, `DataSeeder` runs
- **prod**: PostgreSQL via `DATABASE_URL` env var, H2 console off, `DataSeeder` disabled

### Fuel price scraper
`NocPriceScraperService` scrapes NOC (Nepal Oil Corporation) using Jsoup. Configured via `samjhana.fuel-price-scraper.*` in `application.yml`. The depot is set to `Bhalbari` by default.

---

## Working style

### Before every change
Before touching any file, always output this block and wait for confirmation:

```
📌 Branch: <category>/<branch-name>
📝 Scope: <one sentence — exactly what will change>
🚫 Out of scope: <what will NOT be touched>
🧪 Tests: <what test cases will be written>
Shall I proceed?
```

### Branch naming
Format: `<category>/<what-was-asked-in-kebab-case>` — branch name must echo the ask, not a generic description.

| Prefix | When to use |
|---|---|
| `feat/` | new feature |
| `fix/` | bug fix |
| `ui/` | frontend/React changes |
| `data/` | entity, schema, DB changes |
| `i18n/` | translations, Nepali strings |
| `api/` | REST endpoint or backend service |
| `auth/` | JWT, login, permissions |
| `refactor/` | restructuring, no behaviour change |
| `test/` | tests only |
| `devops/` | Docker, CI/CD, deployment |
| `docs/` | documentation |

### Commit message format
```
<category>: <what changed, matching the ask>

# Examples:
feat: add petrol pump daily sales entry form with Nepali labels
fix: correct Lakhs formatting on Nepal dashboard summary card
i18n: add Nepali translations for loan approval screen
```

### PR rule
Every PR requires at least 1 approval before merging to `main`. No self-merges.

---

## Testing

### Where tests live
- Backend: `src/test/java/<same package as class under test>/`
- Admin frontend: `samjhana-admin/src/__tests__/`
- Public frontend: `samjhana-web/src/__tests__/`

### What every change must include
- Backend: unit tests (JUnit 5 + Mockito) for every new/modified method; `@SpringBootTest` integration test for every new endpoint; test happy path + at least one edge case + one failure case
- Frontend: Vitest + React Testing Library for every new/modified component; test render, user interaction, and error states; for i18n changes test both EN and NE strings render correctly
- Run `mvn test` (backend) and `npm test` (frontend) — all tests must pass before raising a PR

### Naming conventions
```java
// Java
void shouldReturnDailySalesTotal_whenValidDateProvided() {}
void shouldThrowException_whenBusinessUnitNotFound() {}
```
```js
// React / Vitest
it('renders petrol pump form with Nepali labels', () => {})
it('shows validation error when sales amount is empty', () => {})
```

---

## Plugin commands

| Plugin | Command |
|---|---|
| `code-review` | `/code-review` — run before merging any PR |
| `pr-review-toolkit` | `/pr-review-toolkit:review-pr all` — run before raising a PR |
| `ralph-wiggum` | `/ralph-loop "<task>"` — autonomous fix loops |
| `hookify` | `/hookify "<rule>"` — add a new guard rule |
| `devops-automation-pack` | Available for Docker, CI/CD, Tailscale tasks |

---

## graphify knowledge graph

This project has a graphify knowledge graph at `graphify-out/`.

**When to use:**
- Cross-module questions (e.g. "how does the fuel scraper connect to the petrol pump module") → `graphify query`, `graphify path`, `graphify explain`
- Architecture or coupling questions → read `graphify-out/GRAPH_REPORT.md` first

**After modifying files:** Run `graphify update .` to keep the graph current (AST-only, no API cost). This is also run automatically via the PostToolUse hook in `.claude/settings.json`.

**Fallback:** If `graphify-out/` is missing or empty, run `graphify build .` first.
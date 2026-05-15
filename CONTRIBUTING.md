# Samjhana Ventures — Improvement Roadmap

> Single source of truth for planned structural and code quality improvements.
> Work top-to-bottom within each priority. Items are ordered by impact vs effort.
> Last updated: May 2026

---

## System map — read this first

The repository (`samjhana-ventures`) contains **three products** sharing one Spring Boot backend.
Every item in this document names which product it affects. Never confuse them.

```
samjhana-ventures/                   ← monorepo root
├── src/                             ← Spring Boot backend (shared by both frontends)
├── samjhana-admin/                  ← Internal ERP (private, Tailscale only)
└── samjhana-web/                    ← Public customer website (internet-facing)
```

```
┌──────────────────────────────────────────────────────────────────────┐
│  Spring Boot backend  (:8080)                                        │
│                                                                      │
│  /api/auth/**            → public (both frontends use this)          │
│  /api/admin/**           → samjhana-admin only  (JWT required)       │
│  /api/transactions/**    → samjhana-admin only  (JWT required)       │
│  /api/public/**          → samjhana-web only    (no auth, read-only) │
└──────────────┬───────────────────────────┬───────────────────────────┘
               │                           │
  ┌────────────▼──────────────┐  ┌─────────▼─────────────────────────┐
  │  samjhana-admin/          │  │  samjhana-web/                     │
  │                           │  │                                    │
  │  Internal ERP             │  │  Public customer website           │
  │  Private — Tailscale VPN  │  │  Live on the internet              │
  │                           │  │                                    │
  │  Users:                   │  │  Users:                            │
  │  • Dad (Nepal)            │  │  • Anyone — customers, public      │
  │    data entry, mobile,    │  │                                    │
  │    Nepali UI              │  │  What it shows:                    │
  │  • You (USA)              │  │  • Furniture catalogue             │
  │    review, approve,       │  │  • EV charging info & rates        │
  │    analytics dashboard    │  │  • Petrol pump info & prices       │
  │                           │  │  • Rental listings                 │
  │  What it does:            │  │  • Contact, about, hours           │
  │  • Record daily sales     │  │                                    │
  │  • Track all 5 businesses │  │  What it does NOT do:              │
  │  • Staff management       │  │  • No login, no transactions       │
  │  • Daily close & reports  │  │  • No access to internal data      │
  │  • Pending approvals      │  │  • Never calls /api/admin/**       │
  └───────────────────────────┘  └────────────────────────────────────┘
```

**Hard rules that must never be broken:**
1. `samjhana-admin` is never accessible from the public internet — Tailscale only.
2. `samjhana-web` never calls `/api/admin/**` or `/api/transactions/**` — public routes only.
3. The backend never returns internal business figures (profit, WAC, staff data) through
   `/api/public/**` endpoints.

---

## Table of contents

1. [How to use this document](#1-how-to-use-this-document)
2. [Priority 1 — Fix now](#2-priority-1--fix-now)
3. [Priority 2 — Improve soon](#3-priority-2--improve-soon)
4. [Priority 3 — Nice to have](#4-priority-3--nice-to-have)
5. [Explicitly out of scope](#5-explicitly-out-of-scope)
6. [Target project structure](#6-target-project-structure)
7. [Conventions reference](#7-conventions-reference)

---

## 1. How to use this document

Each item follows this format:

```
### Item title
Affects: which product — samjhana-admin / samjhana-web / Backend / All
Problem: what is wrong and why it matters
Solution: what to do
Effort: S / M / L  (S = a few hours, M = half a day, L = multiple sessions)
Files affected: which files to touch
Done when: concrete checklist
```

Check items off by replacing `[ ]` with `[x]`.
When done, add a one-line note of what you did — this becomes your changelog.

---

## 2. Priority 1 — Fix now

Structural gaps that compound with every new feature. Complete these before adding anything new.

---

### 1.1 Rename folders and establish the monorepo layout

**Affects:** All — this is a prerequisite for everything else

**Problem:** The current folder names (`frontend/`, `maurighar-frontend/`) don't reflect what
the products actually are. Anyone reading the repo — including Claude Code — has to guess which
frontend is the admin ERP and which is the public website. This ambiguity leaks into every
conversation, every PR, and every AI-assisted session.

**Solution:** Rename the folders to match the agreed naming:

```bash
git mv frontend samjhana-admin
git mv maurighar-frontend samjhana-web
```

Then update every reference to the old names:
- `pom.xml` — the `frontend-maven-plugin` `<workingDirectory>` points to `frontend`
- `render.yaml` — any build paths
- `Dockerfile` — any COPY instructions referencing `frontend/`
- `CLAUDE.md` — update the two-frontend table
- `README.md` — quick start instructions
- `.github/workflows/` — any CI build steps referencing the old paths

After renaming, add a note to each frontend's `package.json` description:
- `samjhana-admin` → `"description": "Internal ERP — private, Tailscale only. Not for public internet."`
- `samjhana-web` → `"description": "Public customer website for Samjhana Ventures"`

**Effort:** S

**Files affected:** `pom.xml`, `render.yaml`, `Dockerfile`, `CLAUDE.md`, `README.md`,
`.github/workflows/`, both frontend directories (renamed)

**Done when:**
- [ ] `frontend/` renamed to `samjhana-admin/`
- [ ] `maurighar-frontend/` renamed to `samjhana-web/`
- [ ] `pom.xml` frontend plugin `<workingDirectory>` updated to `samjhana-admin`
- [ ] `render.yaml` and `Dockerfile` build paths updated
- [ ] `CLAUDE.md` updated to use new names throughout
- [ ] `mvn spring-boot:run -Pdev` still works after rename
- [ ] `cd samjhana-admin && npm run dev` still works
- [ ] `cd samjhana-web && npm run dev` still works

---

### 1.2 Separate public API routes from internal ERP routes

**Affects:** Backend, both frontends — the most important security boundary in the project

**Problem:** Without a clean separation between public and internal API routes, one of two things
happens: `samjhana-web` accidentally calls endpoints it shouldn't (security risk), or you lock
everything down with JWT and the public website breaks (availability risk). Right now
`SecurityConfig.java` likely only whitelists `/api/auth/**` and `/api/fuel-prices/current`,
with no dedicated namespace designed for `samjhana-web`.

**Solution:** Create a `/api/public/**` namespace. All routes `samjhana-web` calls live here —
no authentication required, read-only, never exposing internal business figures. All routes
`samjhana-admin` calls require JWT.

```
Public routes (no auth — samjhana-web uses these):
  GET  /api/public/fuel-prices/current     → today's petrol/diesel prices for display
  GET  /api/public/furniture/catalogue     → items and prices for the website
  GET  /api/public/ev/rates               → EV charging rates by vehicle type
  GET  /api/public/rentals/listings       → available rental properties
  GET  /api/public/fuel-prices/health     → scraper staleness check (see item 2.5)
  GET  /api/public/business-info          → address, hours, contact numbers

Internal routes (JWT required — samjhana-admin uses these):
  POST /api/transactions
  GET  /api/transactions/**
  GET  /api/daily-reports/**
  GET  /api/admin/**
  POST /api/fuel-prices/fetch-noc         → manual NOC scrape trigger
  ... everything else
```

In `SecurityConfig.java`:
```java
http.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/auth/**").permitAll()
    .requestMatchers("/api/public/**").permitAll()           // samjhana-web — no auth needed
    .requestMatchers("/swagger-ui/**", "/api-docs/**").permitAll()
    .anyRequest().authenticated()                            // everything else: JWT required
);
```

Create `PublicController.java` for all `samjhana-web` data needs:
```java
@RestController
@RequestMapping("/api/public")
public class PublicController {

    @GetMapping("/fuel-prices/current")
    public FuelPriceResponse getCurrentPrices() { ... }

    @GetMapping("/furniture/catalogue")
    public List<FurnitureItemResponse> getCatalogue() {
        // Return: name, description, price, image URL only
        // Never return: stock levels, cost price, WAC, supplier info
    }

    @GetMapping("/ev/rates")
    public List<EvRateResponse> getEvRates() { ... }

    @GetMapping("/business-info")
    public BusinessInfoResponse getInfo() { ... }
}
```

Add `.env.example` to each frontend:

`samjhana-web/.env.example`:
```
VITE_API_BASE=https://api.samjhana-ventures.com
# samjhana-web ONLY calls /api/public/** — never /api/admin or /api/transactions
```

`samjhana-admin/.env.example`:
```
VITE_API_BASE=http://localhost:8080
# samjhana-admin calls all authenticated endpoints — accessed via Tailscale in prod
```

**Effort:** M

**Files affected:** `SecurityConfig.java`, new `PublicController.java`, new
`PublicApiService.java`, `.env.example` in both frontends

**Done when:**
- [ ] `/api/public/**` namespace exists with all data `samjhana-web` needs
- [ ] `SecurityConfig.java` permits `/api/public/**` without auth
- [ ] `PublicController.java` exists — never exposes profit, WAC, staff, or cost data
- [ ] All `samjhana-web` API calls point to `/api/public/**` only
- [ ] Verified: `GET /api/public/fuel-prices/current` with no token → 200
- [ ] Verified: `GET /api/transactions` with no token → 401
- [ ] Verified: `GET /api/admin/users` with no token → 401
- [ ] Both frontends have `.env.example` committed

---

### 1.3 Add a service layer between controllers and repositories

**Affects:** Backend (both frontends benefit — cleaner services mean a more reliable API)

**Problem:** Controllers call repositories directly. Business logic, validation, and calculation
dispatch are mixed into HTTP handlers. When two controllers need the same logic, it gets
duplicated or controllers become interdependent. Both are bad.

**Solution:** One service class per domain:

```
Controller → Service → Repository
```

Controllers: HTTP only — parse request, call service, return response.
Services: business logic — validate, call `CalculationEngine`, call repositories, build DTO.
Repositories: database only.

New files:
```
src/main/java/com/samjhana/service/
  PublicApiService.java        ← serves PublicController — read-only, no auth context
  TransactionService.java
  FurnitureService.java
  StaffService.java
  FuelPriceService.java        ← absorbs NocPriceScraperService calls
  DailyReportService.java
  EvVehicleService.java
```

Example `TransactionService`:
```java
@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final BusinessUnitRepository businessUnitRepository;
    private final CalculationEngine calculationEngine;
    private final AuditLogRepository auditLogRepository;

    public TransactionResponse createTransaction(TransactionRequest request, String username) {
        BusinessUnit unit = businessUnitRepository.findByCode(request.getBusinessCode())
            .orElseThrow(() -> new BusinessUnitNotFoundException(request.getBusinessCode()));

        // CalculationEngine called only from service layer — never from a controller
        CalculationResult result = calculationEngine.calculate(unit, request.getCustomFields());

        Transaction tx = new Transaction();
        // map fields, set calculated values...
        transactionRepository.save(tx);
        auditLogRepository.save(new AuditLog(tx, username, "CREATE"));

        return TransactionMapper.toResponse(tx);
    }
}
```

`PublicApiService` is intentionally separate — it has no access to `CalculationEngine`,
`AuditLogRepository`, or any internal data:
```java
@Service
@RequiredArgsConstructor
public class PublicApiService {
    private final FuelPriceRepository fuelPriceRepository;
    private final FurnitureItemRepository furnitureItemRepository;
    private final EvVehicleRepository evVehicleRepository;
    // No TransactionRepository, no AuditLogRepository, no CalculationEngine
}
```

**Effort:** L (one service at a time — do not attempt all at once)

**Files affected:** All 8 controllers (simplified), new service classes, repositories unchanged

**Done when:**
- [ ] `TransactionService` created — `TransactionController` imports no `Repository` directly
- [ ] `FurnitureService` created — `FurnitureController` imports no `Repository` directly
- [ ] `PublicApiService` created — serves `PublicController` with only public-safe data
- [ ] `CalculationEngine` called only from service classes, never from controllers
- [ ] Remaining controllers migrated: `StaffController`, `FuelPriceController`,
  `DailyReportController`, `EvVehicleController`, `AdminController`

---

### 1.4 Add a global exception handler

**Affects:** Backend — both frontends get structured errors instead of raw 500s

**Problem:** Without `@ControllerAdvice`, any unhandled exception sends a raw Spring error page
to whoever called the API. `samjhana-admin` shows Dad a blank screen. `samjhana-web` shows
visitors a broken section. Neither is acceptable.

**Solution:**
```
src/main/java/com/samjhana/exception/
  GlobalExceptionHandler.java
  BusinessUnitNotFoundException.java
  TransactionNotFoundException.java
  FuelPriceScraperException.java
```

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessUnitNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(BusinessUnitNotFoundException ex) {
        return ResponseEntity.status(404).body(new ErrorResponse("NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .collect(Collectors.joining(", "));
        return ResponseEntity.status(400).body(new ErrorResponse("VALIDATION_FAILED", message));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(500)
            .body(new ErrorResponse("SERVER_ERROR", "Something went wrong."));
    }
}
```

How each frontend handles errors:
- `samjhana-admin`: read `error.response.data.message`, show as a toast or inline form error,
  in both English and Nepali where possible.
- `samjhana-web`: on public API error, show a friendly "Unable to load" message in that
  section — never a blank page, never a raw error code to a customer.

**Effort:** S

**Files affected:** New `exception/` package, `api.js` in both frontends

**Done when:**
- [ ] `GlobalExceptionHandler` handles named domain exceptions, validation errors, catch-all
- [ ] Custom exception classes created for main domain errors
- [ ] `samjhana-admin` displays error message in UI on failed API call (not just console.log)
- [ ] `samjhana-web` shows a friendly fallback when a public endpoint fails
- [ ] Tested: non-existent transaction ID → `samjhana-admin` shows clean error, not blank screen

---

### 1.5 Reorganize samjhana-admin pages into feature folders

**Affects:** `samjhana-admin` only — `samjhana-web` has its own page structure, leave it alone

**Problem:** 24 page components in a flat `pages/` directory. Furniture alone has 5 pages.
This only gets harder to navigate as features are added.

**Solution:** Group by business unit inside `samjhana-admin/src/pages/`:

```
samjhana-admin/src/pages/
  petrol/
    PetrolEntryPage.jsx       ← Dad records daily fuel sales
    FuelOrderPage.jsx         ← Dad records tanker deliveries
    FuelPricePage.jsx         ← manage selling prices, view NOC auto-update status
  ev/
    EVEntryPage.jsx           ← Dad records EV charging sessions
    EvVehiclePage.jsx         ← manage vehicle types and per-unit rates
  furniture/
    FurnitureDashboardPage.jsx
    FurnitureEntryPage.jsx
    FurnitureInventoryPage.jsx
    FurnitureCustomerPage.jsx
    FurnitureOrderPage.jsx
    FurnitureOrderHistoryPage.jsx
  rental/
    RentalEntryPage.jsx
  loans/
    LoanEntryPage.jsx
  admin/
    StaffManagementPage.jsx
    SettingsPage.jsx
  shared/
    LoginPage.jsx
    DashboardPage.jsx         ← Today's Cash summary across all 5 businesses
    DailyClosePage.jsx
    ReportsPage.jsx           ← your analytics view from USA
    RecordsPage.jsx
    PendingReviewPage.jsx     ← your approval queue from USA
```

Move files, update all import paths in `App.jsx`. Do this in one commit so git history is clean.

**Effort:** S

**Files affected:** All 24 ERP page files (moved), `samjhana-admin/src/App.jsx` (imports)

**Done when:**
- [ ] All 24 ERP pages in domain subdirectories as above
- [ ] `App.jsx` imports updated, `samjhana-admin` runs without errors
- [ ] No page file in the root `pages/` directory
- [ ] `samjhana-web` pages are untouched

---

### 1.6 Write unit tests for all five strategy calculations

**Affects:** Backend — protects the accuracy of every number Dad enters and you review

**Problem:** WAC profit, EV meter reconciliation, loan interest, rental due, and furniture stock
are the financial core of the system. None are currently tested. A silent calculation bug
corrupts records the family business depends on.

**Solution:** These are pure functions — the easiest things in the project to test and the most
important to get right.

```
src/test/java/com/samjhana/strategy/
  PetrolStrategyTest.java
  EVStrategyTest.java
  LoanStrategyTest.java
  RentalStrategyTest.java
  FurnitureStrategyTest.java
```

Example:
```java
class PetrolStrategyTest {

    private final PetrolStrategy strategy = new PetrolStrategy();

    @Test
    void wacProfit_basicCase() {
        // 100 liters at Rs 182 sell rate, WAC Rs 175
        Map<String, Object> fields = Map.of(
            "liters", 100.0, "sellRate", 182.0, "wac", 175.0, "fuelType", "PETROL"
        );
        CalculationResult result = strategy.calculate(fields);
        assertEquals(18200.0, result.getAmount());   // 100 × 182
        assertEquals(700.0, result.getProfit());      // (182 − 175) × 100
    }

    @Test
    void wacProfit_zeroLiters_returnsZero() {
        Map<String, Object> fields = Map.of("liters", 0.0, "sellRate", 182.0, "wac", 175.0);
        CalculationResult result = strategy.calculate(fields);
        assertEquals(0.0, result.getAmount());
        assertEquals(0.0, result.getProfit());
    }

    @Test
    void wacProfit_sellBelowWac_negativeProfit() {
        Map<String, Object> fields = Map.of("liters", 50.0, "sellRate", 170.0, "wac", 175.0);
        CalculationResult result = strategy.calculate(fields);
        assertEquals(-250.0, result.getProfit()); // (170 − 175) × 50
    }
}
```

For `LoanStrategyTest`, verify against a hand-calculated example first:
`(Principal × Rate × Days) / 36500`

**Effort:** M (one strategy at a time, ~30 min each)

**Files affected:** New test classes only — no production code changes

**Done when:**
- [ ] `PetrolStrategyTest` — 3 cases: normal, zero liters, sell below WAC
- [ ] `EVStrategyTest` — meter mode and percentage mode
- [ ] `LoanStrategyTest` — interest formula verified against a hand-calculated example
- [ ] `RentalStrategyTest` — due calculation including zero overdue months
- [ ] `FurnitureStrategyTest` — stock in/out calculation
- [ ] `mvn test` passes with 0 failures

---

## 3. Priority 2 — Improve soon

Do these after all Priority 1 items are complete.

---

### 2.1 Add Flyway for database migrations

**Affects:** Backend

**Problem:** PostgreSQL is already in `pom.xml` as a runtime dependency — the intent to move
from H2 is there. But without a migration tool, the schema is managed by Spring's `ddl-auto`,
which can silently alter or drop tables on startup. Dad's records should never be at risk from
a deployment.

**Solution:** Add Flyway. Schema changes become versioned SQL scripts that run in order and
never repeat.

```xml
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
```

```
src/main/resources/db/migration/
  V1__initial_schema.sql        ← export your current H2 schema
  V2__seed_business_units.sql   ← the five business unit rows from DataSeeder.java
```

```yaml
# application.yml — prod profile
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
  jpa:
    hibernate:
      ddl-auto: validate    # Flyway owns the schema — Spring only validates it
```

**Effort:** M

**Files affected:** `pom.xml`, `application.yml`, new `db/migration/` directory

**Done when:**
- [ ] Flyway dependency in `pom.xml`
- [ ] `V1__initial_schema.sql` contains all current table definitions
- [ ] `V2__seed_business_units.sql` contains the five business unit rows
- [ ] `ddl-auto` set to `validate` in prod profile
- [ ] App starts cleanly with Flyway managing the schema

---

### 2.2 Move DataSeeder out of config/ and restrict to dev profile

**Affects:** Backend

**Problem:** `DataSeeder.java` sits in `config/` next to `SecurityConfig.java`. Configuration
is Spring infrastructure setup. Data seeding is application data init — not the same thing.
Also, if `DataSeeder` runs in production, it could duplicate rows that Flyway already seeded.

**Solution:**
```
src/main/java/com/samjhana/
  config/         ← SecurityConfig.java, WebConfig.java — Spring infrastructure only
  seed/
    DataSeeder.java    ← @Profile("dev") — never runs in prod
```

```java
@Profile("dev")
@Component
public class DataSeeder implements ApplicationRunner {
    // Only runs when: mvn spring-boot:run -Pdev
    // Prod data is handled by Flyway V2__seed_business_units.sql
}
```

**Effort:** S

**Files affected:** `DataSeeder.java` (moved), `config/` package (cleaner)

**Done when:**
- [ ] `DataSeeder.java` in `seed/` package, not `config/`
- [ ] `@Profile("dev")` annotation on the class
- [ ] `config/` contains only `SecurityConfig.java` and `WebConfig.java`
- [ ] Dev profile still seeds on `mvn spring-boot:run -Pdev`

---

### 2.3 Extract API hooks in samjhana-admin

**Affects:** `samjhana-admin` only

**Problem:** Page components call `api.js` directly, managing their own loading and error state.
The same `useState` + `useEffect` fetch pattern is repeated across 24 pages. One API endpoint
change requires updating 24 files.

**Solution:** One custom hook per business domain:

```
samjhana-admin/src/hooks/
  usePetrol.js      → usePetrolTransactions(), useFuelPrices(), useFuelOrders()
  useEV.js          → useEVTransactions(), useEvVehicles()
  useFurniture.js   → useFurnitureItems(), useFurnitureOrders(), useCustomers()
  useRental.js      → useRentalTransactions()
  useLoans.js       → useLoanTransactions()
  useAdmin.js       → useStaff(), useUsers()
  useReports.js     → useDailyReports(), useTransactionHistory()
```

Example:
```javascript
// samjhana-admin/src/hooks/usePetrol.js
export function usePetrolTransactions(dateRange) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/transactions', { params: { business: 'PETROL', ...dateRange } })
      .then(res => setTransactions(res.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [dateRange]);

  return { transactions, loading, error };
}
```

Page becomes thin:
```javascript
function PetrolEntryPage() {
  const { transactions, loading, error } = usePetrolTransactions({ month: currentMonth });
  // Renders only — no fetch logic here
}
```

**Effort:** M (start with petrol and furniture — highest traffic)

**Files affected:** New `samjhana-admin/src/hooks/` directory, page components updated

**Done when:**
- [ ] `hooks/` directory created in `samjhana-admin/src/`
- [ ] Petrol, EV, and furniture hooks implemented
- [ ] Those page components no longer contain data-fetching `useEffect` logic
- [ ] Loading and error states handled in one place per domain

---

### 2.4 Split samjhana-admin i18n translations by domain

**Affects:** `samjhana-admin` only — `samjhana-web` is English-only for now

**Problem:** All English and Nepali translations live in one `i18n/index.js`. With 24 pages
across 5 business units, this file is already large. Every new feature causes merge conflicts
on this one file.

**Solution:** Split into domain namespaces. i18next supports this natively.

```
samjhana-admin/src/i18n/
  index.js        ← init only — no translation strings here
  common.js       ← nav, buttons, dates, form labels, errors (EN + NE)
  petrol.js
  ev.js
  furniture.js
  rental.js
  loans.js
  admin.js
```

`index.js` becomes init-only:
```javascript
import i18n from 'i18next';
import common from './common';
import petrol from './petrol';
// ...

i18n.init({
  resources: {
    en: { common: common.en, petrol: petrol.en /* ... */ },
    ne: { common: common.ne, petrol: petrol.ne /* ... */ },
  },
  defaultNS: 'common',
  lng: 'ne',  // default to Nepali — Dad is the primary user
});
```

Components: `const { t } = useTranslation('petrol');`

**Effort:** M (mechanical split — no logic changes)

**Files affected:** `samjhana-admin/src/i18n/` (split into domain files), components updated

**Done when:**
- [ ] `i18n/` contains `index.js` (init only) plus domain files
- [ ] `index.js` has no translation strings — only `i18n.init()`
- [ ] Components use `useTranslation('domain')` not bare `useTranslation()`
- [ ] Language toggle works correctly — EN/NE switch updates all strings
- [ ] Devanagari numerals still render correctly in Nepali mode

---

### 2.5 Add staleness detection to the NOC fuel price scraper

**Affects:** Backend, `samjhana-admin`, `samjhana-web`

**Problem:** `NocPriceScraperService` runs at 12:15 AM and 6:00 AM NPT. If NOC changes their
HTML, the scraper fails silently. Stale prices mean Dad records sales at wrong rates — the
numbers you review are wrong, and customers on `samjhana-web` see outdated prices.

**Solution:** Record `lastScrapedAt` after each scrape. Add a health check.

```java
@Scheduled(cron = "0 30 6 * * *", zone = "Asia/Kathmandu")  // 30 min after scrape window
public void checkScrapeHealth() {
    FuelPrice latest = fuelPriceRepository.findLatestScrapeResult();
    if (latest == null || latest.getLastScrapedAt().isBefore(Instant.now().minus(25, HOURS))) {
        log.error("FUEL PRICE ALERT: Prices not updated in 24h — NOC site may have changed.");
    }
}
```

```
GET /api/public/fuel-prices/health
→ { "lastUpdated": "2026-05-13T06:15:00+05:45", "isStale": false }
```

- `samjhana-admin` dashboard: red warning banner if `isStale: true` — Dad needs to enter
  prices manually.
- `samjhana-web` fuel prices section: show "prices as of [date]" so customers know how
  recent the data is.

**Effort:** S

**Files affected:** `NocPriceScraperService.java`, `FuelPrice` entity (`lastScrapedAt` field),
`PublicController.java` (new `/health` endpoint), dashboard in `samjhana-admin`,
fuel prices section in `samjhana-web`

**Done when:**
- [ ] `lastScrapedAt` stored after each scrape attempt
- [ ] Health check job logs an error when prices are stale
- [ ] `GET /api/public/fuel-prices/health` returns `isStale` and `lastUpdated`
- [ ] `samjhana-admin` dashboard shows a warning banner when `isStale: true`
- [ ] `samjhana-web` fuel prices section shows the last-updated timestamp

---

### 2.6 Add request validation annotations to DTOs

**Affects:** Backend — protects data quality for both frontends

**Problem:** `spring-boot-starter-validation` is already a dependency but unused. Without
`@Valid`, invalid data (negative liters, future loan dates, blank required fields) reaches
the database and produces raw SQL constraint errors.

**Solution:**
```java
public class TransactionRequest {

    @NotBlank(message = "Business unit code is required")
    private String businessCode;

    @NotNull(message = "Transaction date is required")
    @PastOrPresent(message = "Transaction date cannot be in the future")
    private LocalDate transactionDate;

    @Positive(message = "Amount must be greater than zero")
    private BigDecimal amount;
}
```

```java
// Controller:
public ResponseEntity<TransactionResponse> create(@Valid @RequestBody TransactionRequest req) {
```

With item 1.4 (global exception handler) in place, validation failures automatically return
structured 400 responses — no extra code needed.

**Effort:** M (one DTO at a time)

**Files affected:** All `*Request` DTOs in `dto/`, controller methods accepting request bodies

**Done when:**
- [ ] All `*Request` DTOs have validation annotations on required fields
- [ ] All controller methods with request bodies use `@Valid`
- [ ] Submitting a blank form from `samjhana-admin` → 400 with readable field error messages

---

## 4. Priority 3 — Nice to have

Low urgency. Do these when Priority 1 and 2 are done or during quiet sessions.

---

### 3.1 Add tests for samjhana-admin critical form flows

**Affects:** `samjhana-admin`

Vitest + Testing Library is already configured. The highest-value tests are the forms Dad uses
every day — a silent form bug directly corrupts business records.

Start with one happy-path test per high-traffic form:
- Petrol entry: fill all fields, submit, assert API called with the correct calculated amount
- EV entry: enter opening/closing meter, assert units and amount calculated before submit
- Language toggle: switch to Nepali, assert all labels render in Devanagari

**Effort:** M

**Done when:**
- [ ] `PetrolEntryPage.test.jsx` — happy path passing
- [ ] `EVEntryPage.test.jsx` — meter mode passing
- [ ] `npm test` in `samjhana-admin/` passes with 0 failures

---

### 3.2 Identify shared utilities between samjhana-admin and samjhana-web

**Affects:** Both frontends

The two frontends likely duplicate some utilities — number formatters (Lakhs/Crores, Devanagari
numerals) and possibly the `api.js` base configuration. Duplication is fine if it's deliberate.
Silent divergence is the problem.

Audit both frontends. For each duplicated file, add a comment:
```javascript
// Also exists in samjhana-web/src/utils/formatters.js
// If you change this file, update the other one too.
```

Longer term, npm workspaces can extract a `packages/shared/` package both frontends import
from. Only do this when duplication actually causes a bug.

**Effort:** S to document, L to consolidate with workspaces

**Done when:**
- [ ] Both frontends audited — list of duplicated files documented
- [ ] Each duplicated file has a comment naming its counterpart
- [ ] Decision recorded: consolidate with workspaces (yes/no) and when

---

### 3.3 Document and automate the database backup procedure

**Affects:** Backend, operations

H2 is file-based at `/data/`. Render's free tier does not guarantee disk persistence across
dyno restarts. Dad's transaction history can be silently lost.

Minimum: document the backup process in `docs/OPERATIONS.md`.
Better: schedule a daily Spring `@Scheduled` job that copies the H2 file to Google Drive
using rclone.
Best: migrate to Render's managed PostgreSQL, which has automated backups. Pairs with item 2.1.

**Effort:** S to document, M to automate

**Done when:**
- [ ] `docs/OPERATIONS.md` exists with the backup procedure written out
- [ ] Either a manual backup script is available, or an automated backup runs daily

---

## 5. Explicitly out of scope

Things appropriate for a larger team but wrong for this project. Do not do these.

| What | Why not |
|---|---|
| Microservices | Massive operational overhead for a 2-person operation. One JAR is correct. |
| Kafka / message queues | No async needs. The NOC scraper is a scheduled task, not an event stream. |
| Kubernetes | Docker + Render is the right level. Don't add orchestration complexity. |
| GraphQL | REST is working. No client needs dynamic field selection. |
| Separate cloud deployment for samjhana-admin | The single-JAR approach keeps Dad's setup simple. Keep it. |
| Next.js / SSR for samjhana-web | Vite + React is sufficient for a business info site. |
| 80%+ test coverage | Test calculations that touch money and forms Dad uses daily. That's enough. |

---

## 6. Target project structure

What the repository looks like after Priority 1 and 2 are complete. Use as a reference when
adding new files — everything should fit somewhere in this layout.

```
samjhana-ventures/                          ← monorepo root
├── pom.xml                                 ← builds backend + bundles samjhana-admin
├── CLAUDE.md
├── .env.example                            ← backend env vars (JWT_SECRET, DB_PASSWORD)
├── .gitignore
├── Dockerfile
├── render.yaml
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── FEATURES.md
│   ├── IMPROVEMENT-ROADMAP.md              ← this file
│   ├── OPERATIONS.md                       ← backup, deployment, monitoring (to create)
│   └── DAD-PROOF-SETUP-GUIDE.md
│
├── src/main/java/com/samjhana/
│   ├── SamjhanaVenturesOsApplication.java
│   │
│   ├── config/                             ← Spring infrastructure only
│   │   ├── SecurityConfig.java
│   │   └── WebConfig.java
│   │
│   ├── seed/                               ← @Profile("dev") only
│   │   └── DataSeeder.java
│   │
│   ├── controller/
│   │   ├── AuthController.java             ← used by both frontends
│   │   ├── PublicController.java           ← samjhana-web only (/api/public/**)
│   │   ├── AdminController.java            ← samjhana-admin only
│   │   ├── TransactionController.java      ← samjhana-admin only
│   │   ├── DailyReportController.java      ← samjhana-admin only
│   │   ├── FuelPriceController.java        ← samjhana-admin only (write endpoints)
│   │   ├── FurnitureController.java        ← samjhana-admin only
│   │   ├── EvVehicleController.java        ← samjhana-admin only
│   │   └── StaffController.java            ← samjhana-admin only
│   │
│   ├── service/
│   │   ├── PublicApiService.java           ← serves PublicController, read-only
│   │   ├── TransactionService.java
│   │   ├── FurnitureService.java
│   │   ├── FuelPriceService.java
│   │   ├── DailyReportService.java
│   │   ├── EvVehicleService.java
│   │   ├── StaffService.java
│   │   ├── CalculationEngine.java
│   │   ├── CustomUserDetailsService.java
│   │   └── NocPriceScraperService.java
│   │
│   ├── strategy/
│   │   ├── BusinessCalculationStrategy.java
│   │   └── impl/
│   │       ├── PetrolStrategy.java
│   │       ├── EVStrategy.java
│   │       ├── LoanStrategy.java
│   │       ├── RentalStrategy.java
│   │       └── FurnitureStrategy.java
│   │
│   ├── entity/
│   │   ├── BusinessUnit.java
│   │   ├── Transaction.java
│   │   ├── FieldTemplate.java
│   │   ├── User.java
│   │   ├── Staff.java
│   │   ├── FuelPrice.java
│   │   ├── EvVehicle.java
│   │   ├── FurnitureItem.java
│   │   ├── FurnitureCustomer.java
│   │   ├── DailyReport.java
│   │   ├── AuditLog.java
│   │   ├── Resource.java
│   │   └── ImageAttachment.java
│   │
│   ├── dto/
│   │   ├── request/                        ← *Request.java — all have @Valid annotations
│   │   └── response/                       ← *Response.java — safe to serialise
│   │
│   ├── repository/
│   │
│   ├── exception/
│   │   ├── GlobalExceptionHandler.java
│   │   ├── BusinessUnitNotFoundException.java
│   │   ├── TransactionNotFoundException.java
│   │   └── FuelPriceScraperException.java
│   │
│   └── security/
│       ├── JwtAuthFilter.java
│       └── JwtUtil.java
│
├── src/main/resources/
│   ├── application.yml
│   └── db/migration/
│       ├── V1__initial_schema.sql
│       └── V2__seed_business_units.sql
│
├── src/test/java/com/samjhana/
│   └── strategy/
│       ├── PetrolStrategyTest.java
│       ├── EVStrategyTest.java
│       ├── LoanStrategyTest.java
│       ├── RentalStrategyTest.java
│       └── FurnitureStrategyTest.java
│
├── samjhana-admin/                         ← Internal ERP — private, Tailscale only
│   ├── package.json
│   ├── vite.config.js                      ← proxies /api → :8080 in dev
│   ├── .env.example                        ← VITE_API_BASE=http://localhost:8080
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── components/
│       │   ├── DatePicker.jsx
│       │   ├── DynamicFormBuilder.jsx
│       │   ├── LanguageToggle.jsx          ← EN / नेपाली toggle
│       │   ├── QuickActionButtons.jsx      ← Dad's large-button home screen
│       │   └── SearchableSelect.jsx
│       ├── pages/
│       │   ├── petrol/
│       │   │   ├── PetrolEntryPage.jsx
│       │   │   ├── FuelOrderPage.jsx
│       │   │   └── FuelPricePage.jsx
│       │   ├── ev/
│       │   │   ├── EVEntryPage.jsx
│       │   │   └── EvVehiclePage.jsx
│       │   ├── furniture/
│       │   │   ├── FurnitureDashboardPage.jsx
│       │   │   ├── FurnitureEntryPage.jsx
│       │   │   ├── FurnitureInventoryPage.jsx
│       │   │   ├── FurnitureCustomerPage.jsx
│       │   │   ├── FurnitureOrderPage.jsx
│       │   │   └── FurnitureOrderHistoryPage.jsx
│       │   ├── rental/
│       │   │   └── RentalEntryPage.jsx
│       │   ├── loans/
│       │   │   └── LoanEntryPage.jsx
│       │   ├── admin/
│       │   │   ├── StaffManagementPage.jsx
│       │   │   └── SettingsPage.jsx
│       │   └── shared/
│       │       ├── LoginPage.jsx
│       │       ├── DashboardPage.jsx       ← Today's Cash, all 5 businesses
│       │       ├── DailyClosePage.jsx
│       │       ├── ReportsPage.jsx
│       │       ├── RecordsPage.jsx
│       │       └── PendingReviewPage.jsx
│       ├── hooks/
│       │   ├── usePetrol.js
│       │   ├── useEV.js
│       │   ├── useFurniture.js
│       │   ├── useRental.js
│       │   ├── useLoans.js
│       │   ├── useAdmin.js
│       │   └── useReports.js
│       ├── i18n/
│       │   ├── index.js                    ← init only, no strings here
│       │   ├── common.js                   ← shared strings, EN + NE
│       │   ├── petrol.js
│       │   ├── ev.js
│       │   ├── furniture.js
│       │   ├── rental.js
│       │   ├── loans.js
│       │   └── admin.js
│       ├── utils/
│       │   ├── api.js                      ← Axios + JWT interceptor
│       │   └── formatters.js               ← Lakhs/Crores, Devanagari numerals
│       └── test/
│           ├── setup.js
│           ├── test-utils.jsx
│           └── pages/
│               ├── PetrolEntryPage.test.jsx
│               └── EVEntryPage.test.jsx
│
└── samjhana-web/                           ← Public customer website — internet-facing
    ├── package.json
    ├── vite.config.js
    ├── .env.example                        ← VITE_API_BASE=https://your-render-url.onrender.com
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── pages/                          ← website pages, not ERP screens
        │   ├── HomePage.jsx
        │   ├── FurniturePage.jsx           ← catalogue via /api/public/furniture/catalogue
        │   ├── PetrolPage.jsx              ← prices via /api/public/fuel-prices/current
        │   ├── EVChargingPage.jsx          ← rates via /api/public/ev/rates
        │   ├── RentalsPage.jsx             ← listings via /api/public/rentals/listings
        │   └── ContactPage.jsx
        ├── components/
        └── utils/
            ├── api.js                      ← fetch wrapper — /api/public/** only, no JWT
            └── formatters.js               ← Lakhs/Crores for public price display
```

---

## 7. Conventions reference

Applies to all new code. Fix existing violations opportunistically — when already in a file,
clean it up. Don't make fixing conventions a standalone refactor task.

### Backend

**Who each controller serves:**
- `PublicController` → `samjhana-web` only. Read-only. No auth.
- All other controllers → `samjhana-admin` only. JWT required.
- `AuthController` → both.

**What PublicController may return:** Only display-safe data. Never profit margins, WAC,
cost prices, staff names, internal transaction IDs, audit data, or stock levels.

**Layer rule:** Controller → Service → Repository. Never skip the service layer. Never call
a Repository from a Controller.

**DTOs:** `*Request` for incoming (always `@Valid`), `*Response` for outgoing. Never expose
JPA entities directly from controllers.

**Calculations:** Only `CalculationEngine` calls strategy implementations. No controller,
repository, or `PublicApiService` touches a strategy.

**Exceptions:** Throw named domain exceptions. `GlobalExceptionHandler` converts to HTTP.

**Logging:** `@Slf4j`. `INFO` for business events. `WARN` for recoverable issues (scraper
returned empty). `ERROR` for failures. Never log passwords or JWT tokens.

**Primary keys:** UUID on all entities — works in H2 and PostgreSQL without migration changes.

### samjhana-admin

**Data fetching:** Always through a hook in `hooks/`. Never call `api.js` from a page component.

**Translations:** Every user-visible string through `t('key')`. Add both `en` and `ne` values
before committing. Never hardcode English strings in JSX.

**Numbers:** All currency through `formatters.js`. Never format inline in JSX.

**Errors:** Read `error.response.data.message`, show it to the user. Never swallow silently.

### samjhana-web

**API calls:** Only `/api/public/**`. If a page needs data that isn't there, add a new
endpoint to `PublicController` — never reach for an authenticated endpoint.

**No auth:** `samjhana-web` has no login, no JWT, no user sessions. If a feature requires
auth, it belongs in `samjhana-admin`.

**Performance:** This is a public website — load fast on mobile in Nepal. Keep bundle size
small. Avoid large libraries for small features.

**Error states:** Every section that fetches data needs a fallback UI. A blank section is
worse than a "Prices temporarily unavailable — please call us" message.

---

*This is a living document. Check off items as you complete them. If you make a decision that
differs from what's written here, add a one-line note explaining why. Future you will thank you.*

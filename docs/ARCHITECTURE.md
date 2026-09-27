# Architecture

## System overview

Samjhana Ventures OS has one Spring Boot REST API and two React frontends. The internal admin app uses the API for authenticated business operations; the separate public website reads the limited public API for its catalogue and business information.

```text
Admin app (Vite :5173) ─┐
                        ├─> Spring Boot API (:8080) ─> services ─> repositories ─> database
Public site (Vite :5175)┘
```

In local development, each Vite server proxies `/api` requests to Spring Boot. The admin also proxies `/ws` for EV live updates. The Maven production build bundles the admin app into the Spring Boot JAR; `samjhana-web/` is built and deployed separately.

## Main backend layers

| Layer | Responsibility |
|---|---|
| Controllers | REST endpoints, request validation, and authenticated user context |
| Security | JWT authentication; role checks for protected operations |
| Services | Business workflows, calculations, auditing, and orchestration |
| Repositories | Spring Data JPA persistence |
| Database | H2 for local development; PostgreSQL for staging and production |

The development profile seeds demo users, business units, and EV vehicle types when their tables are empty. The end-to-end test profile uses its own disposable in-memory H2 database.

## Business calculation strategies

`CalculationEngine` dispatches business calculations to Spring-discovered implementations of `BusinessCalculationStrategy`:

| Business code | Strategy |
|---|---|
| `petrol` | `PetrolStrategy` |
| `ev` | `EVStrategy` |
| `furniture` | `FurnitureStrategy` |
| `rental` | `RentalStrategy` |
| `loan` | `LoanStrategy` |

Business-specific transaction values are stored in `Transaction.customFields`; the exact fields depend on the business workflow.

## EV charging

The backend includes an OCPP 2.0.1 WebSocket handler and EV session APIs. Charger connections use `/ocpp/<charge-point-code>`; authenticated admin users operate sessions through `/api/ev/sessions`. The implementation and its current connector/session limitations are documented in [EV Charging](EV-CHARGING-ARCHITECTURE.md).

## Security boundary

- `POST /api/auth/login` is public.
- `/api/public/**` is unauthenticated and read-only for the public website. Responses must not expose internal financial or staff data.
- The current fuel-price endpoint `/api/fuel-prices/current` is also permitted without a JWT.
- Public ecommerce product and customer-auth routes under `/api/ecommerce/**` are also permitted without a JWT.
- Other business API requests require JWT authentication; role-specific checks are applied where needed.
- The public React website and private admin app are separate frontends. Do not expose the admin app or real operational data publicly.

## Repository layout

```text
src/main/java/       Spring Boot application, API, services, entities, security, and OCPP
src/test/java/       Backend unit and integration tests
samjhana-admin/      Internal React/Vite app, Vitest tests, and Playwright E2E suite
samjhana-web/        Public React/Vite website and frontend tests
tools/ocpp-simulator/ Standalone OCPP simulator for manual testing
docs/                Architecture, feature, setup, and tooling documentation
```

For local startup commands, see the [README](../README.md).

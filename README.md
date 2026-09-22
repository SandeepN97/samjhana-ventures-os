# Samjhana Ventures OS — Bilingual Multi-Business ERP

> **A Spring Boot + React operating system for a real Nepal–USA family-business environment spanning retail, fuel, EV charging, rentals, and loans.**

Samjhana Ventures OS is a multi-business ERP built with **Java 21, Spring Boot, React, JWT, H2, OpenAPI, and bilingual English/Nepali UI support**. The project models several very different business workflows under one application while keeping the interface practical for non-technical users.

**Useful for:** engineers interested in full-stack ERP design, domain modeling, Spring Boot business applications, internationalization, role-based access, inventory/financial workflows, or software designed for real-world operational users.

### Business domains in one system

| Domain | What the application manages |
| --- | --- |
| **Furniture retail** | Products, inventory, sales, and operational records |
| **Petrol pump** | Fuel operations and NOC price-data workflows |
| **EV charging** | Live OCPP 2.0.1-controlled charging: remote start/stop, real-time meter data, a postpay connector lock (released on payment), and NEA electricity-bill reconciliation |
| **House rentals** | Property and rental-management workflows |
| **Finance** | Bank loans and cross-business financial visibility |
| **Localization** | English/Nepali UI with Devanagari numeral support |

### Engineering highlights

- Java 21 + Spring Boot 3.2.1 backend with Spring Security and Spring Data JPA.
- React 18 + Vite + Tailwind frontend with Zustand and Recharts.
- JWT-based role-aware access.
- Automated Nepal Oil Corporation fuel-price scraping with Jsoup.
- OpenAPI / Swagger API documentation.
- Bilingual English/Nepali experience designed around the actual end user.
- Dedicated architecture, feature, and simplified setup documentation.

---

## Why this project exists

A family business rarely looks like a clean textbook domain. Samjhana Ventures spans businesses with completely different operational models, users, and data needs. The engineering challenge is therefore not just CRUD; it is creating one understandable system that can represent multiple domains without making the user learn enterprise software terminology.

The project emphasizes **practical domain modeling, localization, operational simplicity, and maintainable full-stack structure**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Java 21, Spring Boot 3.2.1, Spring Security, Spring Data JPA |
| Frontend | React 18, Vite 5, Tailwind CSS 3, Zustand, Recharts |
| Database | H2 (embedded, dev only) / PostgreSQL (production) |
| Auth | JWT (jjwt 0.12.3) |
| API Docs | Springdoc OpenAPI 2.3.0 (Swagger UI — dev only) |
| Scraping | Jsoup 1.17.2 (NOC fuel prices) |
| i18n | i18next (English + Nepali with Devanagari numerals) |
| Testing | Vitest, Testing Library |

## Prerequisites

- **Java 21** (e.g., [Microsoft OpenJDK](https://learn.microsoft.com/en-us/java/openjdk/download))
- **Node.js 20+** and npm (for frontend development)
- **Maven 3.9+** (or use the bundled `mvnw` wrapper if available)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **Yes** | Secret key for signing JWT tokens (min 32 chars). Generate with `openssl rand -base64 48`. |
| `ADMIN_INITIAL_PASSWORD` | No | Admin password set on first boot. If unset, a random password is printed once to logs. |
| `DB_PASSWORD` | No | H2 database password (default: empty for local dev only) |
| `DATABASE_URL` | Prod | PostgreSQL JDBC URL |
| `DATABASE_USERNAME` | Prod | PostgreSQL username |
| `DATABASE_PASSWORD` | Prod | PostgreSQL password |
| `SAMJHANA_CORS_ALLOWED_ORIGINS` | Prod | Comma-separated list of allowed frontend origins |
| `OCPP_SECRET_HD_D180_CC_01`, `OCPP_SECRET_HQC23_80_01`, `OCPP_SECRET_HD_D140_E_01` | Prod | One OCPP Basic-auth secret per charger. Startup fails in `prod` if any is missing or starts with `dev-`. Generate each with `openssl rand -base64 32`. |
| `OCPP_LOCK_BEHAVIOR` | No | `EXPLICIT_UNLOCK` (default) or `AUTO_UNLOCK_ON_STOP` — see `docs/EV-CHARGING-ARCHITECTURE.md` |
| `JAVA_HOME` | Yes | Path to Java 21 installation |

Copy `.env.example` to `.env` and fill in the values.

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/SandeepN97/samjhana-ventures-os.git
cd samjhana-ventures-os
```

### 2. Set required environment variables

```bash
export JWT_SECRET=$(openssl rand -base64 48)
```

This is required in every profile, including local development: the backend refuses to start with the
built-in development secret, whichever Spring profile is active.

### 3. Start the backend (dev mode)

```bash
mvn spring-boot:run -Pdev -Dspring-boot.run.profiles=dev
```

`-Dspring-boot.run.profiles=dev` activates Spring's `dev` profile, which seeds demo users and enables the
H2 console (`/h2-console`) and Swagger UI (`/swagger-ui`). Without it the app runs in the default profile:
no demo users are seeded (a random-password admin is created on an empty database instead) and the H2
console and Swagger are disabled. Backend runs at `http://localhost:8080`.

### 4. Start the frontend (separate terminal)

```bash
cd samjhana-admin
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` with API proxy to the backend.

### 5. First login (dev mode)

When the backend is started with the `dev` profile (step 3), the `DataSeeder` creates demo accounts.
Check the application startup log for the seeded credentials, or look in `DataSeeder.java`.

> **Production first boot**: No users are created automatically. On first boot, `FirstRunInitializer`
> creates an `admin` account and prints a one-time password to the application log at WARN level.
> You can also pre-set the password via the `ADMIN_INITIAL_PASSWORD` environment variable.
> **Change this password immediately after first login.**

These demo accounts and the first-boot admin password are for local development and initial setup
only — rotate credentials and secrets before any real deployment.

## Production Build

```bash
# Build JAR with bundled frontend
mvn clean package -Pprod

# Run the production JAR
java -Dspring.profiles.active=prod -jar target/samjhana-ventures-os-1.0.0.jar
```

Required environment variables for production: `JWT_SECRET`, `DATABASE_URL`,
`DATABASE_USERNAME`, `DATABASE_PASSWORD`, `SAMJHANA_CORS_ALLOWED_ORIGINS`, and one OCPP secret per
charger — `OCPP_SECRET_HD_D180_CC_01`, `OCPP_SECRET_HQC23_80_01`, `OCPP_SECRET_HD_D140_E_01`. The
app refuses to start in the `prod` profile if any charger secret is missing or still a `dev-` value.

## Running Tests

```bash
cd samjhana-admin
npm test
```

## API Documentation

With the backend running in **dev mode** (started with the `dev` profile, as in step 3), visit:

- **Swagger UI**: [http://localhost:8080/swagger-ui](http://localhost:8080/swagger-ui)
- **OpenAPI JSON**: [http://localhost:8080/api-docs](http://localhost:8080/api-docs)

Swagger is disabled in production.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System diagrams, project structure, strategy pattern, ERD, security model |
| [Features](docs/FEATURES.md) | All business modules, UI features, and API endpoints |
| [Dad's Setup Guide](docs/DAD-PROOF-SETUP-GUIDE.md) | Step-by-step guide for the Nepal end-user |
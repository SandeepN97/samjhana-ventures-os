# Samjhana Ventures OS — Bilingual Multi-Business ERP

> **A Spring Boot + React operating system for a real Nepal–USA family-business environment spanning retail, fuel, EV charging, rentals, and loans.**

Samjhana Ventures OS is a multi-business ERP built with **Java 21, Spring Boot, React, JWT, H2, OpenAPI, and bilingual English/Nepali UI support**. The project models several very different business workflows under one application while keeping the interface practical for non-technical users.

**Useful for:** engineers interested in full-stack ERP design, domain modeling, Spring Boot business applications, internationalization, role-based access, inventory/financial workflows, or software designed for real-world operational users.

### Business domains in one system

| Domain | What the application manages |
| --- | --- |
| **Furniture retail** | Products, inventory, sales, and operational records |
| **Petrol pump** | Fuel operations and NOC price-data workflows |
| **EV charging** | Charging-station operational records |
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
| Database | H2 (file-based embedded) |
| Auth | JWT (jjwt 0.12.3) |
| API Docs | Springdoc OpenAPI 2.3.0 (Swagger UI) |
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
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens |
| `DB_PASSWORD` | No | H2 database password (default: `samjhana2024`) |
| `JAVA_HOME` | Yes | Path to Java 21 installation |

```bash
export JAVA_HOME=/path/to/java-21
export JWT_SECRET=your-secret-key-here
```

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/SandeepN97/samjhana-ventures-os.git
cd samjhana-ventures-os
```

### 2. Start the backend (dev mode)

```bash
mvn spring-boot:run -Pdev
```

Backend runs at `http://localhost:8080`. The H2 console is available at `/h2-console` in dev mode.

### 3. Start the frontend (separate terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` with API proxy to the backend.

### 4. Log in

Open `http://localhost:5173` and use the local demo credentials documented by the project:

| Username | Password |
|----------|----------|
| `admin` | `admin` |

> The default login is for local/demo use. Change credentials and secrets before any real deployment.

## Production Build

```bash
# Build JAR with bundled frontend
mvn clean package -Pprod

# Run the production JAR
java -jar target/samjhana-ventures-os-1.0.0.jar

# Access at http://localhost:8080
```

## Running Tests

```bash
cd frontend
npm test
```

## API Documentation

With the backend running, visit:

- **Swagger UI**: [http://localhost:8080/swagger-ui](http://localhost:8080/swagger-ui)
- **OpenAPI JSON**: [http://localhost:8080/api-docs](http://localhost:8080/api-docs)

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System diagrams, project structure, strategy pattern, ERD |
| [Features](docs/FEATURES.md) | All business modules, UI features, and API endpoints |
| [Dad's Setup Guide](docs/DAD-PROOF-SETUP-GUIDE.md) | Step-by-step guide for the Nepal end-user |

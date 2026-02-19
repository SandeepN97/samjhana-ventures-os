# Samjhana Ventures OS

A multi-business ERP system for a Nepal-USA family business operation. Manages five business units under one roof: a petrol pump, EV charging station, furniture shop, house rental properties, and bank loans — with bilingual UI (English/Nepali), automated NOC fuel price scraping, and role-based access.

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
git clone <repo-url>
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

Open `http://localhost:5173` and use the default credentials:

| Username | Password |
|----------|----------|
| `admin` | `admin` |

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

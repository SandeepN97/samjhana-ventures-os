# Samjhana Ventures OS

A bilingual ERP for Samjhana Ventures, with a Java/Spring Boot backend and two React frontends:

- **Admin** (`samjhana-admin/`): private operations dashboard.
- **Website** (`samjhana-web/`): public furniture catalogue and business information.

## Run locally

Requirements: Java 21, Maven, Node.js 20+, and npm.

Start each part in a separate terminal from the repository root.

### 1. Backend

```bash
export JWT_SECRET="$(openssl rand -base64 48)"
mvn spring-boot:run -Pdev -Dspring-boot.run.profiles=dev
```

The API runs at <http://localhost:8080>. Keep this terminal running while using either frontend.

### 2. Admin app

```bash
cd samjhana-admin
npm ci
npm run dev
```

Open <http://localhost:5173>. The dev server proxies API and WebSocket requests to the backend.

### 3. Public website

```bash
cd samjhana-web
npm ci
npm run dev
```

Open <http://localhost:5175>. The website reads public catalogue, fuel-price, and EV-rate data from the backend.

### Development login

On a **new, empty dev database**, the dev profile seeds these accounts:

| Username | Password | Role |
|---|---|---|
| `admin` | `admin` | Admin |
| `manager` | `manager123` | Manager |
| `staff` | `staff123` | Staff |

The seeder skips user creation if the database already contains users. These are development-only credentials; do not use them for a real deployment.

## Useful commands

```bash
# Backend tests (run at the repository root)
mvn test
```

```bash
# Admin tests, lint, and production build
cd samjhana-admin
npm test
npm run lint
npm run build
```

```bash
# Public website tests, lint, and production build
cd samjhana-web
npm test
npm run lint
npm run build
```

Admin and public website browser tests use a disposable local Spring Boot/H2 backend; EV flows use a simulated charger:

```bash
cd samjhana-admin
npx playwright install chromium
npm run test:e2e
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Features and API overview](docs/FEATURES.md)
- [EV charging implementation and current limitations](docs/EV-CHARGING-ARCHITECTURE.md)
- [AI development tooling decisions](docs/AI-TOOLING-ADDITIONS.md)
- [Optional Claude Code tooling notes](docs/samjhana-ventures-plugin-integration.md)
- [Set up signed Git commits on macOS](docs/GIT-COMMIT-SIGNING.md)
- [Retired Dad setup guide notice](docs/DAD-PROOF-SETUP-GUIDE.md)

For production configuration, database requirements, and secrets, consult `src/main/resources/application.yml` and the deployment configuration. Do not reuse development credentials or expose the admin app to the public internet.

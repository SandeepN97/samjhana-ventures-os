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

### Quick check that everything works

1. Open <http://localhost:5173> and log in as `admin` / `admin` (see below).
2. In **Beekeeping** or **Furniture → Products**, add a product, give it a price and stock, add a picture, and switch it to **Live**. A product with no stock shows as sold out and cannot be ordered.
3. Open <http://localhost:5175>. The product appears in the shop, and the cart can place an order. Staff see the order in the admin.
4. Website text, contact details and pictures are edited in the admin (**Website** page, or the **Website page** tab inside Furniture and Beekeeping). The public site has no built-in content of its own.

Stop a part with `Ctrl+C` in its terminal. The dev database is a file at `./data/samjhana-db`; delete the `data/` folder to start fresh.

### Development login

On a **new, empty dev database**, the dev profile seeds these accounts:

| Username | Password | Role |
|---|---|---|
| `admin` | `admin` | Admin |
| `manager` | `manager123` | Manager |
| `staff` | `staff123` | Staff |

The seeder skips user creation if the database already contains users. These are development-only credentials; do not use them for a real deployment.

## Run in a GitHub Codespace

A Codespace is a ready-made computer in the cloud, so nothing needs installing on your own machine.

1. On GitHub, open the repository, press **Code → Codespaces → Create codespace on `staging`** (or on the branch you want to try). To reopen a codespace you already made, pick it from the same menu.
2. Get the latest code in the Codespace terminal. Do this every time, otherwise you may see an old version:
   ```bash
   git fetch origin
   git checkout staging      # or the branch you want to try
   git pull origin staging
   ```
3. Start the three parts, each in its own terminal (the **+** button in the terminal panel), exactly as in **Run locally** above: backend first, then the admin app and the public website. Run `npm ci` again after pulling changes that touch `package.json`.
4. Open the **Ports** tab (next to Terminal). Ports `8080` (backend), `5173` (admin) and `5175` (public website) appear once each part is running. Click the globe icon beside `5173` for the admin and beside `5175` for the public site. Do not open the `localhost` links from the Terminal text; use the Ports tab links.
5. Ports are **Private** by default, so only you can open them while logged in to GitHub. Leave them private. The admin must never be shared publicly.
6. If a page looks old, hard-refresh the browser (`Ctrl+Shift+R`) and confirm with `git status` and `git log -1` that the Codespace is on the branch you expect. If the backend says the port is busy, an old copy is still running: stop it with `Ctrl+C` or run `pkill -f spring-boot`.
7. Codespaces stop after a period of inactivity and keep your files. Commit and push your work before deleting one.

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

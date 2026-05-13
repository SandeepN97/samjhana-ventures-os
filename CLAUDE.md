## Project

**Samjhana Ventures OS** — a multi-business ERP for a Nepal-USA family operation.
Five business units: petrol pump, EV charging, furniture shop, house rentals, bank loans.

**Stack:** Java 21 + Spring Boot 3.2.1 backend · React 18 + Vite + Tailwind frontend · H2 embedded DB · JWT auth · i18next (English/Nepali with Devanagari numerals)

**Two frontends:**
- `samjhana-admin/` — internal ERP UI (served at localhost:5173 in dev, bundled into JAR in prod; Tailscale only in prod)
- `samjhana-web/` — public-facing customer website (furniture, beekeeping, EV, fuel prices); dev at localhost:5175

**Key conventions:**
- Business units follow a Strategy pattern (see docs/ARCHITECTURE.md)
- Bilingual UI — any new UI strings need both English and Nepali translations
- Dev profile uses H2 with console at /h2-console; prod bundles frontend into JAR via Maven `-Pprod`
- Backend runs at :8080, frontend proxies to it in dev

---

## graphify

This project has a graphify knowledge graph at graphify-out/.

**When to use the graph:**
- Cross-module questions (e.g. "how does the fuel scraper connect to the petrol pump module") → `graphify query`, `graphify path`, `graphify explain`
- Architecture or coupling questions → read graphify-out/GRAPH_REPORT.md first for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw source files

**When NOT to use the graph:**
- Single-file edits, quick syntax questions → read the file directly

**Fallback:** If graphify-out/ is missing or GRAPH_REPORT.md is empty, explore normally and remind the user to run `graphify build .`

**After modifying files:** Run `graphify update .` to keep the graph current (AST-only, no API cost)

**God nodes:** If GRAPH_REPORT.md flags any god nodes, call them out in answers and suggest whether refactoring is warranted given this is a family-run solo project (over-engineering is a real risk here).
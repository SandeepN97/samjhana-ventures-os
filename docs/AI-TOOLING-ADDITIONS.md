# Samjhana Ventures OS: AI Development Tooling

**Revision 2 — decisions applied and checked against the repository on September 26, 2026**

This document covers six tools: NVIDIA SkillSpector, Playwright, Strix, Context7, Ponytail, and the official Supabase MCP server. Their status is intentionally different: Playwright is being used for local admin and public-site E2E tests and CI; Context7 is an optional documentation aid; SkillSpector and Ponytail remain candidates pending review; Strix and Supabase MCP are deferred.

## 1. Decisions and safety boundaries

- **Strix and Supabase MCP are deferred entirely.** Do not install, configure, connect, or run either until an isolated environment with synthetic data exists. Do not point exploit testing or an AI database tool at production or a shared staging database.
- **Playwright is for browser tests against the disposable local stack only.** Its backend uses an in-memory H2 database and seeded test users; its EV tests use a simulated OCPP charger. It must not use production URLs, production credentials, or real chargers.
- **SkillSpector is not approved for adoption yet.** Pin and independently evaluate the official source and its dependencies first. A clean scan, including a clean SkillSpector self-scan, is not proof of safety.
- **Context7 can be evaluated as a development-time documentation aid** for the project's actual versions: React 18 and Vite 5 in the admin frontend, and Spring Boot 3.5.16 in the backend. Retrieved documentation and examples are untrusted inputs and must be checked against the repository and official versioned docs.
- **Ponytail is technically compatible with the documented Copilot CLI and Claude Code plugin interfaces, but is not installed here.** Its hooks, instructions, and effect on this repository's required workflow need a controlled trial before adoption.
- These decisions do not authorize edits to deployment workflows beyond the Playwright CI job, nor changes to production or staging data access.

## 2. NVIDIA SkillSpector — candidate; evaluation required

**Official source:** [NVIDIA/SkillSpector](https://github.com/NVIDIA/SkillSpector)
**Candidate source pin reviewed:** commit `89e90872e2ec813bcb137bf6b3145c92e55811ae` on the official repository's `main` branch (September 26, 2026). This is a commit pin, not a versioned release. The latest release tag observed was `v2.12.0`, resolving to `c7958a3268d9498644b22edb75d0f051bbc8cbfc`. Do not silently substitute a moving branch or tag for the reviewed SHA.

The pinned source is a Python CLI (Python `>=3.12,<3.15`) with static checks and optional LLM analysis. Its README describes scanning skills, repositories, archives, URLs, and MCP servers. The reviewed `main` commit includes new checks for Claude settings that can run commands or reroute traffic; those changes were not in the `v2.12.0` release commit. The release README advertises 71 patterns across 17 categories, while NVIDIA's hosted scanning guide currently says 68 patterns across 17 categories. Treat this count discrepancy as documentation drift to resolve, not as a security signal.

**Evaluation status: not independently scanned or executed in this review; do not install or adopt yet.** Before a decision:

1. Fetch the exact official commit into an isolated checkout. Verify the repository URL, commit SHA, release/tag relationship, license, dependency declarations and lockfiles. Review recent security fixes and whether they are released.
2. Read the implementation and tests for archive/URL ingestion, path traversal and archive limits, subprocesses, network calls/OSV lookups, LLM data handling, and any hooks or MCP tools. Do not supply API credentials or private repository contents.
3. In a disposable environment with no project secrets or sensitive files, independently scan the pinned source and its resolved dependencies. Use SkillSpector static mode (`--no-llm`), a Python dependency scanner such as `pip-audit` or OSV-Scanner, and a separate source analyzer such as Semgrep or CodeQL. Run the upstream test suite and review results manually. Record scanner versions, commit SHA, commands, findings and disposition.
4. Review what the tool itself sends over the network and what its output means. A scanner can miss bugs, and scanning a scanner with itself is not independent assurance. Do not use an allowlist/baseline to hide unresolved findings.
5. Block adoption on unexplained critical/high findings, an unreviewed execution surface, or dependency/provenance uncertainty. Re-evaluate when changing the pin.

No standing hook, plugin, CI integration, or self-update is approved. If later adopted, start with an explicit, manually invoked scan; consider a hook only after reviewing its effects and failure behavior.

## 3. Playwright — local admin and public-site E2E and CI

Playwright is in `samjhana-admin`'s development dependencies, scripts, and `playwright.config.js`; the E2E suite includes:

- `samjhana-admin/e2e/ev-charging.e2e.js` with the simulated OCPP charger and multi-step staff charging, payment, and unlock flows.
- `samjhana-admin/e2e/login.e2e.js` covering protected-route redirection, invalid credentials, successful disposable-admin login, logout, and local credential clearing.
- `samjhana-admin/e2e/public-site.e2e.js` covering the public home page, API-backed fuel/EV content, and furniture catalogue search.

The suite covers the admin workflows and public home/furniture pages. Its configuration starts Spring Boot on `localhost:8181` with the `dev` profile and in-memory H2, the admin Vite app on `localhost:5183`, and the public Vite app on `localhost:5185`. Both frontends proxy public API calls to that disposable backend. It seeds only disposable test accounts; the charger is simulated. Run locally with Java 21, Maven, Node.js 20, and the Playwright Chromium browser installed:

```bash
cd samjhana-admin
npm ci
npx playwright install chromium
npm run test:e2e
```

CI installs Java 21 and Chromium, runs `npm run test:e2e` against that disposable stack, and requires the E2E job to pass before the production build job. Do not put production or staging credentials into the E2E job.

## 4. Strix — deferred

Strix is an autonomous penetration-testing tool. It is **not approved for installation or use** until an isolated test environment with synthetic data exists and has been reviewed. When that prerequisite is met, first create a scope-limited plan for a disposable local/staging target, test-data reset, network egress, and explicit authorization. Never target production, a live charger, or a shared database.

## 5. Context7 — optional docs for this repository's versions

Context7's official project documents both a CLI + skills mode and an MCP mode; its hosted service also warns that indexed documentation is community-contributed and may be inaccurate. Prefer testing the CLI mode first, without repository/database credentials. The official CLI currently requires Node.js 18 or newer. Review any generated configuration before saving it; do not install a generated skill or MCP server without the same source and permission review used for other agent tooling.

Use a two-step lookup, then select a result for the actual dependency version:

```text
ctx7 library react "React 18.2 hooks and forms"
ctx7 docs <the-versioned-React-18.2-library-ID-returned-above> "controlled form inputs"

ctx7 library vite "Vite 5 configuration and dev server proxy"
ctx7 docs <the-versioned-Vite-5-library-ID-returned-above> "configure a development proxy"

ctx7 library spring-boot "Spring Boot 3.5.16 configuration"
ctx7 docs <the-versioned-Spring-Boot-3.2.1-library-ID-returned-above> "externalized configuration and profiles"
```

Choose an exact versioned library ID returned by Context7 where available; if it has no exact version, use official React 18, Vite 5, or Spring Boot 3.5 documentation and verify the answer independently. Do not request Next.js 15 or React 19 examples for this application.

For an optional MCP setup, use the official Context7 setup documentation for the exact installed coding client and inspect the proposed endpoint, authentication, and configuration diff first. Context7 needs documentation queries only; it needs no Supabase, Render, production, or repository-secret access.

## 6. Ponytail — compatible interfaces; controlled trial only

**Official source:** [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail), reviewed at commit `e3ba2aa6f1e6f0bc4d69eb09c9f0d0a93af56156` (release `v4.10.0`).

The pinned README documents both a Claude Code plugin installation and a GitHub Copilot CLI plugin installation. The project currently has `CLAUDE.md`, `.claude/settings.json`, and a `skills-lock.json`/`.agents/skills` workflow; it does not currently configure Ponytail. Thus the upstream advertises interfaces for both tools, but compatibility with this exact CLI setup and instructions has **not** been tested.

Ponytail's official Claude/Codex plugin manifest references lifecycle hooks. Before considering it, inspect the pinned hook scripts and permission requirements, then test in an isolated checkout/user-level plugin environment. Check that it does not conflict with this repository's branch-per-change, bilingual UI, required tests, safety, accessibility, and review practices. Do not install it globally or add project hooks until that trial is approved. Its “minimal code” rules must never override the required tests or validation.

## 7. Supabase MCP — deferred

Do not install, configure, connect, or invoke the Supabase MCP server until an isolated synthetic-data environment exists. This applies to both production and shared staging. “Read-only” production access is not an acceptable interim exception: it can still expose employee, customer, financial, and operational data.

## 8. Tool status summary

Superpowers (the skills plugin) is also in use on every task, scaled to the size of the job; see "AI tooling" in `CLAUDE.md`.

| Tool | Status | Permitted scope now |
|---|---|---|
| NVIDIA SkillSpector | Approved for manual use (owner decision, Oct 4, 2026); do the section 2 source and dependency review the first time | By hand, before adding or updating any skill or plugin; never an automatic hook or CI step |
| Playwright | Populated and wired into CI | Disposable local Spring Boot/H2 and simulated charger |
| Strix | Deferred | Only before a release, only against an isolated local copy with fake data (not yet built); never prod, staging, a shared database or a charger |
| Context7 | In use (owner decision, Oct 4, 2026) | On any task that writes or changes library code: version-specific documentation only; validate retrieved content |
| Ponytail | Not used (owner decision, Oct 4, 2026) | None |
| Supabase MCP | Deferred | None until isolated synthetic test environment exists |

## 9. Recommended order and sources

1. Keep Strix and Supabase MCP deferred.
2. Run and maintain the local Playwright suite and its required CI job.
3. If useful, evaluate Context7's CLI docs lookup against React 18, Vite 5, and Spring Boot 3.5.16.
4. Review Ponytail's exact hooks and trial it outside this checkout before any adoption.
5. Independently evaluate SkillSpector at the recorded commit pin; adopt only after the scan, source, and dependency review has a recorded disposition.

Official references:

- SkillSpector source and version: <https://github.com/NVIDIA/SkillSpector/tree/89e90872e2ec813bcb137bf6b3145c92e55811ae>
- SkillSpector official scanning guide: <https://docs.nvidia.com/skills/scanning-agent-skills>
- Context7 source: <https://github.com/upstash/context7>
- Context7 CLI documentation: <https://context7.com/docs/clients/cli>
- Ponytail pinned source: <https://github.com/DietrichGebert/ponytail/tree/e3ba2aa6f1e6f0bc4d69eb09c9f0d0a93af56156>

# Samjhana Ventures OS — Claude Code Plugin Integration Guide

**Project:** Samjhana Ventures OS (ERP for Nepal–USA family business)  
**Stack:** Java 21 / Spring Boot 3.2 · React 18 / Tailwind CSS · H2 Database · Tailscale VPN  
**Business Units:** Petrol Pump · EV Charging · Furniture Shop · House Rental · Bank Loan Management  
**Users:** Nepal data entry operator (mobile, Nepali/Devanagari) · USA analyst/reviewer (desktop dashboard)  
**Environment:** Claude Code running inside IntelliJ IDEA terminal (already active)

---

## Overview

Claude Code is already up and running in your IntelliJ terminal — this guide picks up from there. You do not need to install Claude Code or navigate to the project directory. All plugin install commands below are run directly inside your existing Claude Code session in the IntelliJ terminal.

**How to run these commands:** Click into the IntelliJ terminal where Claude Code is active and type each `/plugin` command. Claude Code will handle the rest without leaving your IDE.

---

## Current Setup

```
IntelliJ IDEA
  └── Terminal (built-in)
        └── claude  ← already running on Samjhana Ventures OS project
              ├── Java 21 / Spring Boot 3.2 (backend)
              └── React 18 / Tailwind CSS (frontend)
```

> **No restart needed** after installing plugins — Claude Code picks them up in the current session.

---

## Quick Install — All 6 Plugins at Once

In your IntelliJ terminal where Claude Code is running, paste these commands one by one:

```bash
# Official Anthropic plugins (5)
/plugin install https://github.com/anthropics/claude-code/tree/main/plugins/code-review
/plugin install https://github.com/anthropics/claude-code/tree/main/plugins/learning-output-style
/plugin install https://github.com/anthropics/claude-code/tree/main/plugins/pr-review-toolkit
/plugin install https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum
/plugin install https://github.com/anthropics/claude-code/tree/main/plugins/hookify

# Community DevOps pack (1)
/plugin marketplace add jeremylongshore/claude-code-plugins
/plugin install devops-automation-pack@claude-code-plugins-plus
```

Then verify everything is installed:

```
/plugin list
```

The sections below explain each plugin in detail and give you ready-to-use prompts tuned to your project.

---

## Plugin 1 — `code-review`

**Source:** https://github.com/anthropics/claude-code/tree/main/plugins/code-review  
**What it does:** Runs 5 parallel AI agents that review PRs for bugs, CLAUDE.md compliance, historical context, and code quality. Uses confidence-based scoring to filter out false positives.

### Install (in IntelliJ terminal → Claude Code session)

```
/plugin install https://github.com/anthropics/claude-code/tree/main/plugins/code-review
```

### Usage

```
/code-review
```

### Samjhana Ventures OS — Specific Use Cases

| Scenario | How to trigger |
|---|---|
| Reviewing new business unit calculation strategies (e.g. petrol pump revenue logic) | `/code-review` before merging to `main` |
| Validating Spring Boot entity changes that affect the Nepal mobile data entry flow | `/code-review` on any PR touching `src/main/java/entities/` |
| Checking React dashboard components for the USA reviewer interface | `/code-review` on frontend PRs |
| Ensuring Devanagari numeral formatting logic hasn't regressed | Agent checks historical context automatically |

### Configuration

Create `.claude/code-review.local.md` in your project root to set project-specific review rules:

```markdown
## Project Review Rules — Samjhana Ventures OS

- All business calculation strategies must implement the Strategy interface
- Nepali language strings must use proper Devanagari encoding (Unicode range \u0900-\u097F)
- Number formatting must support both Lakhs/Crores (Nepal) and standard US format
- H2 schema changes require a migration comment explaining the business unit impact
- React components serving the Nepal operator must have touch targets >= 44px
- Tailscale VPN connectivity must not be assumed in any hardcoded URL
```

---

## Plugin 2 — `learning-output-style`

**Source:** https://github.com/anthropics/claude-code/tree/main/plugins/learning-output-style  
**What it does:** Activates a `SessionStart` hook that encourages you to write meaningful code (5–10 lines) at each decision point while Claude explains its reasoning — like pair programming with educational commentary.

### Install (in IntelliJ terminal → Claude Code session)

```
/plugin install https://github.com/anthropics/claude-code/tree/main/plugins/learning-output-style
```

### Usage

Auto-activates at the start of every Claude Code session. No command needed.

### Samjhana Ventures OS — Specific Use Cases

This plugin is particularly valuable for your project because of the dual-user knowledge gap — the Nepal operator needs to understand what's being built, and new contributors need to understand the bilingual architecture.

| Scenario | Benefit |
|---|---|
| Onboarding the Nepal data entry operator to the mobile UI | Claude explains each UI decision in simple terms |
| Building new JSONB dynamic field schemas for a business unit | You write the schema structure; Claude explains why |
| Implementing the Registry Pattern for a new business unit | Educational walkthrough of each registration step |
| Adding Devanagari numeral conversion logic | Claude shows the pattern, you implement the next numeral |

---

## Plugin 3 — `pr-review-toolkit`

**Source:** https://github.com/anthropics/claude-code/tree/main/plugins/pr-review-toolkit  
**What it does:** Comprehensive PR review with 6 specialized agents: comment quality, test coverage, error handling, type design, code quality, and simplification.

### Install (in IntelliJ terminal → Claude Code session)

```
/plugin install https://github.com/anthropics/claude-code/tree/main/plugins/pr-review-toolkit
```

### Usage

```bash
# Full review (all aspects)
/pr-review-toolkit:review-pr all

# Targeted reviews
/pr-review-toolkit:review-pr tests        # Check test coverage
/pr-review-toolkit:review-pr errors       # Check error handling
/pr-review-toolkit:review-pr types        # Check Java/TypeScript types
/pr-review-toolkit:review-pr simplify     # Look for over-engineering
```

### Samjhana Ventures OS — Specific Use Cases

| PR type | Recommended review aspects |
|---|---|
| New business unit (e.g. adding a 6th unit) | `all` |
| Nepal mobile UI changes | `comments`, `errors` |
| USA dashboard approval workflow | `tests`, `types`, `errors` |
| Bank loan calculation strategy | `tests`, `types` |
| Spring Boot entity / JSONB schema change | `types`, `code` |
| React i18n / bilingual string updates | `comments`, `simplify` |

---

## Plugin 4 — `ralph-wiggum` (Ralph Loop)

**Source:** https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum  
**What it does:** Claude autonomously iterates on a task — running, evaluating, fixing, and re-running — until it completes successfully or you cancel. Think of it as an auto-pilot loop for repetitive build-fix cycles.

### Install (in IntelliJ terminal → Claude Code session)

```
/plugin install https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum
```

### Usage

```bash
# Start an autonomous loop
/ralph-loop "Fix all TypeScript errors in the USA dashboard components"

# Stop the loop at any time
/cancel-ralph
```

### Samjhana Ventures OS — Specific Use Cases

| Task | Ralph Loop prompt |
|---|---|
| Fix all Spring Boot compilation errors after entity refactor | `/ralph-loop "Fix all Java compilation errors in src/main/java"` |
| Get all React components passing lint | `/ralph-loop "Fix all ESLint errors in src/frontend/components"` |
| Make the Maven build pass end-to-end | `/ralph-loop "Run mvn clean install and fix any failures"` |
| Resolve all failing unit tests for loan calculation | `/ralph-loop "Fix failing tests in BankLoanCalculationStrategyTest"` |

> **Tip:** Always commit clean code before running Ralph Loop so you can `git reset` if the autonomous loop goes in an unexpected direction.

---

## Plugin 5 — `hookify`

**Source:** https://github.com/anthropics/claude-code/tree/main/plugins/hookify  
**What it does:** Creates custom Claude Code hooks by describing unwanted behaviors in plain English. The `conversation-analyzer` agent detects patterns and generates hook rules automatically.

### Install (in IntelliJ terminal → Claude Code session)

```
/plugin install https://github.com/anthropics/claude-code/tree/main/plugins/hookify
```

### Usage

```bash
# Create a new hook rule
/hookify "Never write hardcoded localhost URLs — always use environment variables"

# List active hook rules
/hookify:list

# Configure hook settings
/hookify:configure
```

### Samjhana Ventures OS — Recommended Hooks

Run each of these `/hookify` commands once to protect your project:

```bash
/hookify "Never use hardcoded H2 database credentials — always reference application.properties"

/hookify "Never write UI text in English only — all user-facing strings must have a Nepali translation key"

/hookify "Never use standard number formatting for Nepal-facing UI — always use Lakhs and Crores format"

/hookify "Never assume Tailscale VPN is active — always handle network connectivity errors gracefully"

/hookify "Never write touch targets smaller than 44px in components used by the Nepal operator"

/hookify "Never hard-delete records from the database — always use soft delete with a deletedAt timestamp"
```

After creating hooks, verify them:

```
/hookify:list
```

---

## Plugin 6 — `devops-automation-pack`

**Source:** https://github.com/jeremylongshore/claude-code-plugins-plus-skills/tree/main/plugins/devops  
**Marketplace:** https://tonsofskills.com  
**What it does:** A complete DevOps automation suite with 25 plugins covering Git workflows, CI/CD pipelines, Docker optimization, Kubernetes management, and infrastructure as code.

### Install (in IntelliJ terminal → Claude Code session)

```bash
# Step 1 — Add the community marketplace
/plugin marketplace add jeremylongshore/claude-code-plugins

# Step 2 — Install the DevOps pack
/plugin install devops-automation-pack@claude-code-plugins-plus
```

> **Note:** If you get a marketplace timeout in IntelliJ's terminal, run these two commands separately with a few seconds between them. The marketplace registration sometimes takes a moment on first use.

### Samjhana Ventures OS — Specific Use Cases

Since your project uses a **single executable JAR** (Maven bundles React frontend into Spring Boot), the DevOps pack is directly applicable to your deployment pipeline to Nepal and the USA reviewer's access via Tailscale.

#### Docker — Containerize the Spring Boot JAR

Ask Claude Code (with the DevOps skill active):

```
"Create a Dockerfile for a Spring Boot 3.2 fat JAR with Java 21, optimized for a low-bandwidth Nepal deployment"
```

Expected output: a multi-stage `Dockerfile` that minimizes image size for the Nepal server.

#### CI/CD — Maven build pipeline

```
"Set up a GitHub Actions workflow that runs mvn clean install, builds the Docker image, and pushes to the registry"
```

#### Tailscale — Secure deployment

```
"Create a deployment script that pushes the JAR to the Nepal server over Tailscale VPN using SSH"
```

#### Docker Compose — Local dev environment

```
"Generate a docker-compose.yml for local development with Spring Boot, H2 in file mode, and hot-reload for React"
```

---

## Verifying All Plugins Are Installed

In your IntelliJ terminal Claude Code session, run:

```
/plugin list
```

Expected output:

```
Installed plugins:
  ✓ code-review
  ✓ learning-output-style
  ✓ pr-review-toolkit
  ✓ ralph-wiggum
  ✓ hookify
  ✓ devops-automation-pack
```

If any plugin is missing, re-run its install command from the section above. You do not need to restart IntelliJ or Claude Code — plugins activate immediately in the current session.

---

## IntelliJ-Specific Tips

**Split terminal for parallel workflows:** Open a second IntelliJ terminal tab (`Alt+F4` or the `+` button in the terminal panel) to run your Maven/Gradle build normally while Claude Code runs in the first tab. This way `/ralph-loop` can iterate on build errors without blocking your editor.

**Use IntelliJ's Git panel alongside `/code-review`:** Stage your changes in IntelliJ's Git panel (`Alt+9`), then switch to the Claude Code terminal tab and run `/code-review`. Claude sees the staged diff automatically.

**CLAUDE.md in project root:** Claude Code reads a `CLAUDE.md` file at your project root as persistent project instructions. Create one so Claude always has your Samjhana Ventures context:

```bash
# In your IntelliJ terminal (not the Claude Code session — a regular terminal tab)
touch CLAUDE.md
```

Then add to `CLAUDE.md`:

```markdown
# Samjhana Ventures OS — Project Context

## Stack
- Backend: Java 21, Spring Boot 3.2, H2 database
- Frontend: React 18, Tailwind CSS
- Deployment: Single executable JAR via Maven, Tailscale VPN

## Business Units
Shringeshwor Petrol Pump, EV Charging Station, Furniture Shop, House Rental, Bank Loan Management

## Users
- Nepal operator: elderly-friendly mobile UI, Nepali/Devanagari, Lakhs/Crores formatting
- USA reviewer: desktop dashboard, approval workflows, analytics

## Key Rules
- All user-facing strings need English + Nepali translation keys
- Nepal UI touch targets must be >= 44px
- Always use Lakhs/Crores for Nepal-facing number display
- Never hardcode H2 credentials — use application.properties
- Always soft-delete (deletedAt timestamp), never hard-delete
```

Claude Code will read this every session automatically — no need to re-explain the project context each time.

---

## Project-Level Plugin Configuration

To make plugin settings consistent across both the Nepal operator's machine and the USA reviewer's setup, commit a shared plugin config to your repo.

Create `.claude/settings.json` at your project root:

```json
{
  "plugins": [
    "code-review",
    "learning-output-style",
    "pr-review-toolkit",
    "ralph-wiggum",
    "hookify",
    "devops-automation-pack"
  ],
  "pluginSettings": {
    "code-review": {
      "autoReviewOnPR": true,
      "confidenceThreshold": 0.7
    },
    "learning-output-style": {
      "enabled": true
    },
    "hookify": {
      "rulesFile": ".claude/hookify-rules.md"
    }
  }
}
```

Then create `.claude/hookify-rules.md` to persist your custom Hookify rules in version control so every team member inherits them automatically.

---

## Recommended Daily Workflow — IntelliJ + Claude Code

```
Open IntelliJ
  │
  ├── Terminal Tab 1: Claude Code session (claude already running)
  │     │
  │     ├── Session starts → learning-output-style activates automatically
  │     ├── Code with Claude → hookify guards anti-patterns in real time
  │     ├── Before committing → /pr-review-toolkit:review-pr tests errors types
  │     ├── After PR raised → /code-review (full 5-agent review)
  │     ├── Build broken → /ralph-loop "Fix mvn clean install failures"
  │     └── Deploy → DevOps skill prompts for Docker + Tailscale pipeline
  │
  └── Terminal Tab 2: Regular shell
        ├── git operations (add, commit, push)
        ├── mvn clean install (normal builds)
        └── npm run dev (React hot reload)
```



## Useful Links

| Resource | URL |
|---|---|
| Official Claude Code plugins (all 6 above) | https://github.com/anthropics/claude-code/tree/main/plugins |
| DevOps pack source | https://github.com/jeremylongshore/claude-code-plugins-plus-skills/tree/main/plugins/devops |
| Full skills marketplace browser | https://tonsofskills.com |
| Claude Code documentation | https://docs.claude.ai/en/docs/claude-code |

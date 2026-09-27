# Samjhana Ventures OS — Claude Code and AI Tooling Notes

This file replaces the old plugin-installation checklist. **It is not an installation guide, and it does not mean any Claude Code or Copilot CLI plugins are installed.**

The repository contains `CLAUDE.md` for project conventions, `.claude/` configuration, and project skills under `.agents/skills/`. These are repository instructions and skills; they are separate from plugins installed in an individual developer's coding-tool account.

Before installing a plugin or adding shared hooks:

1. Check the current official documentation for the specific client and plugin.
2. Review the exact source, permissions, hooks, and network behavior.
3. Trial it without production or shared-staging credentials and confirm it does not override repository safety or test requirements.
4. Keep the plugin optional unless the team explicitly approves and documents it.

Do not rely on the former guide's plugin counts, marketplace commands, claims about automatic activation, or sample shared plugin configuration. Those details were not verified for the current Copilot CLI/Claude Code setup.

For the current tool-by-tool decisions—including the Playwright CI setup and tools that remain deferred—see [AI Development Tooling](AI-TOOLING-ADDITIONS.md).

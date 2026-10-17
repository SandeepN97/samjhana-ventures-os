# Instructions for AI coding agents

This file is read automatically by agents such as Codex. The project rules in [`CLAUDE.md`](CLAUDE.md) apply to every agent, not only Claude Code: read it first.

If you are continuing the security-fix work (a series of small pull requests into `staging`), read [`docs/security-handoff/README.md`](docs/security-handoff/README.md) before you do anything else. It lists what is done, what to do next, what must wait for the owner, and how to run and check each fix.

Short version of the rules that are easy to get wrong:

- Open pull requests **into `staging`** only. Never open, approve or merge a `staging` → `main` PR. Do not merge or approve any other PR either, unless the owner asks you to in that conversation (on 2026-10-17 they asked for the whole security series to be merged into `staging`; that does not carry over to later PRs).
- Do not start items that are waiting for the owner's decision, and do not change the database schema without the owner (it needs SQL run on Supabase first).
- The detailed security audit report is private. Do not commit it to this public repository, and do not write exploit steps into code, tests, comments, PR text or docs.

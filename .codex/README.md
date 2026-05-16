# Codex Agent Mapping

Codex reads `AGENTS.md` as the primary project instruction file. This directory
adds a Codex-local index for the shared role documents in `../.agents`.

- Mapping file: `agents.toml`
- Shared role docs: `../.agents/*.md`
- Shared workflow skills: `../.skills/*/SKILL.md`

When a task clearly matches a role, Codex should read the mapped role document
and the relevant skill documents before acting. If multiple roles apply, prefer
the smallest useful set and keep the implementation path aligned with
`delivery-orchestrator`.

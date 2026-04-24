# Package Publish Skill

Use this skill when the task is about npm package readiness, publish metadata, or pack output validation.

This skill is shared across Claude, Cursor, and Codex.

## When to Use

Use this skill when you need to:
- validate `package.json` fields before publish
- verify `exports`, `types`, or `main` entries
- check local workspace settings against published package behavior
- inspect `npm pack --dry-run` readiness

Do not use this skill for:
- release branch workflow review without package-level validation
- runtime debugging unrelated to packaging

## Inputs

Gather the smallest useful set of files:
- root `package.json`
- package-level `package.json` files
- `LICENSE`
- README files relevant to installation or usage

## Workflow

1. Identify which package or packages are being prepared for publish.
2. Verify required metadata fields are present and coherent.
3. Check that workspace development settings do not leak into publish behavior incorrectly.
4. Confirm `pack:check` commands exist and match the package layout.
5. Report any publish blockers or missing metadata.

## Checklist

Review at least these fields when relevant:
- `name`
- `version`
- `license`
- `repository`
- `homepage`
- `bugs`
- `main`
- `types`
- `exports`
- `files`
- `prepublishOnly`
- `peerDependencies`
- `devDependencies`

## Commands

Use the repository-standard pack validation flow:

```bash
npm run pack:check:all
```

## Output Expectations

The result should clearly separate:
- publish-ready items
- mismatches
- blockers
- recommended next steps

## Repository Notes

- This repository supports npm, pnpm, and yarn for consumers.
- Workspace-local development dependencies may differ from published peer dependency ranges.

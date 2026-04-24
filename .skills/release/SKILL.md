# Release Skill

Use this skill when the task is about preparing, validating, or explaining a release for this repository.

This skill is shared across Claude, Cursor, and Codex.

## When to Use

Use this skill when you need to:
- prepare a release for `rvlog`, `rvlog-react`, or `rvlog-nest`
- check whether the repository is ready for npm publish
- review Changesets, release workflow, or version bump flow
- explain the release process to another contributor

Do not use this skill for:
- feature implementation without release impact
- low-level debugging unrelated to packaging or release flow

## Inputs

Before using this skill, gather only the minimum context you need:
- changed packages
- release-related `package.json` fields
- `.changeset/*.md` files
- `.github/workflows/release.yml`
- `RELEASE.md`

## Workflow

1. Confirm which packages are affected.
2. Check whether a changeset exists for the change.
3. Verify package metadata needed for publish.
4. Verify that build, test, and pack dry-run commands are available.
5. Confirm the automated release flow is still consistent with repository docs.
6. Report what is ready, what is missing, and what the next release step should be.

## Commands

Use these commands when validation is needed:

```bash
npm test
npm run build
npm run pack:check:all
npm run changeset
npm run changeset:version
```

## Output Expectations

The result should make these points easy to scan:
- affected packages
- release readiness
- missing requirements
- next action

If there is risk, call it out explicitly.

## Repository Notes

- This repository uses Changesets for versioning.
- `main` merge with unpublished changesets creates a release branch and a Version PR.
- Actual npm publish happens after the Version PR is merged.

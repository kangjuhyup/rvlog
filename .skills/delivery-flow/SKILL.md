# Delivery Flow Skill

Use this skill when the task should move through a standard end-to-end implementation flow instead of stopping at a partial step.

This skill is shared across Claude, Cursor, and Codex.

## When to Use

Use this skill when you need to:
- carry a change from design to implementation and close-out
- coordinate multiple agent roles
- make sure tests, docs, and commit prep are not skipped
- standardize how substantial work is completed

## Default Sequence

Follow this sequence unless the task clearly does not need one of the steps:

1. Architecture and placement decision
2. Code implementation
3. Test or validation update
4. Review pass
5. Documentation update
6. Commit preparation

## Role Mapping

- architecture: `.agents/project-architect.md`
- implementation: `.agents/code-writer.md`
- review: `.agents/reviewer.md`
- docs: `.agents/docs-writer.md`
- release impact: `.agents/release-manager.md`

## Workflow

1. Decide where the change belongs.
2. Implement the requested behavior.
3. Add or update tests as needed.
4. Review the result for regressions and missing coverage.
5. Update documentation if public behavior or workflow changed.
6. Summarize the change into a commit-ready description.

## Output Expectations

The result should make it obvious:
- what stage the work is in
- what has been completed
- what remains before commit
- whether docs or release steps are needed

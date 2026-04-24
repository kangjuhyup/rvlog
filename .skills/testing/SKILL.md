# Testing Skill

Use this skill when the task is about test coverage, test structure, or validating behavior after code changes.

This skill is shared across Claude, Cursor, and Codex.

## When to Use

Use this skill when you need to:
- add or update tests after a refactor
- close coverage gaps
- verify that tests follow the current module structure
- keep examples and build output out of test and coverage scope

Do not use this skill for:
- release-only metadata work
- documentation-only work with no behavior or validation impact

## Inputs

Collect only the context needed for the current test change:
- changed source files
- existing related test files
- coverage output, if available
- Vitest configuration files

## Workflow

1. Identify the public behavior or utility behavior that changed.
2. Decide whether the change belongs in an existing test or a new focused test file.
3. Keep public API tests and utility tests separate when possible.
4. Verify test imports follow the current file layout.
5. Confirm coverage scope excludes examples, benchmarks, and build artifacts.
6. Summarize remaining uncovered areas, if any.

## Commands

Use these commands when execution is needed:

```bash
npm test
```

If coverage is available in the repository scripts, use the project-standard coverage command instead of inventing a new one.

## Output Expectations

The result should clearly state:
- what behavior is now covered
- what configuration was adjusted
- what gaps still remain

## Repository Notes

- Keep `example/**`, `benchmark/**`, `dist/**`, and `dist-benchmark/**` out of coverage unless the user explicitly wants them included.
- When utilities are split out of classes, add direct utility tests rather than only expanding orchestration tests.

# Project Architecture Skill

Use this skill when the task is about understanding, explaining, reviewing, or extending the architecture of this repository.

This skill is shared across Claude, Cursor, and Codex.

## When to Use

Use this skill when you need to:
- explain how the repository is organized
- identify package boundaries and responsibilities
- decide where new code should live
- review whether a refactor matches the existing module structure
- onboard a contributor to the repository layout

Do not use this skill for:
- isolated bug fixes that do not depend on repository structure
- release-only validation
- package metadata-only updates

## Inputs

Collect only the minimum architecture context needed:
- root `package.json`
- workspace layout
- `src/`
- `packages/`
- `example/`
- relevant README files

If the task is scoped to one package, focus on that package and the shared root code it depends on.

## Workflow

1. Identify whether the task belongs to core library code, package integration code, or example code.
2. Map the relevant boundary:
   - root `src/` for core `rvlog`
   - `packages/rvlog-react` for React integration
   - `packages/rvlog-nest` for Nest integration
   - `example/*` for demonstration apps only
3. Check whether the logic belongs in:
   - orchestration code
   - utility code
   - public API surface
   - package-specific adapter code
4. Prefer keeping public interfaces stable and moving internal complexity behind module boundaries.
5. When refactoring, keep implementation files and their tests near the same module boundary.
6. Summarize the architecture in terms of responsibilities, not just folders.

## Architecture Model

Use this repository model when explaining or extending the codebase:

- `src/`
  Core `rvlog` library implementation and public API
- `src/log/`
  Logging core module such as logger, serializer, and logging runtime helpers
- `src/notification/`
  Notification management and channel integrations
- `src/masker/`
  Masking engine and metadata storage
- `src/decorators/`
  Public decorator implementations
- `src/transports/`
  Output transport implementations such as file transport
- `packages/rvlog-react/`
  React-specific integration layer
- `packages/rvlog-nest/`
  NestJS-specific integration layer
- `example/`
  Consumer-facing demos and verification apps, not core library source

## Design Rules

Apply these repository-specific design rules:

- Keep orchestration in classes or high-level modules.
- Move pure transformation or helper logic into utility files.
- Keep public API exports centralized at stable entrypoints.
- Prefer package-specific code inside the relevant package rather than branching core code unnecessarily.
- Keep example logic out of core package implementation.
- When moving source files, move or update tests with them.
- Prefer "one reason to change per file" over mechanically forcing every small type into its own file.
- Keep class-local interfaces or small supporting types close to the class unless they are reused across the module.
- If a type is reused across multiple files, move it to a module-level `types.ts`.
- Use role-based filenames such as `types.ts`, `utils.ts`, `constants.ts`, or `contracts.ts` instead of vague category folders like `property/`.
- Split files when it improves ownership, reuse, or testability, not just because the file contains both a class and a related interface.

## Output Expectations

The result should help a reader answer:
- where a change belongs
- what module owns the behavior
- which package boundaries matter
- whether the change matches the current architecture

When recommending a location for new code, give a short reason tied to ownership and dependency direction.

## Repository Notes

- This is a monorepo with one core package and framework-specific integration packages.
- Core functionality should remain reusable without depending on example apps.
- Examples exist to demonstrate usage and validate developer experience, not to define core architecture.
- Release and packaging concerns should not leak example-only code into published library surfaces.

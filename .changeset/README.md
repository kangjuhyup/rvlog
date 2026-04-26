# Changesets

Use Changesets to manage versioning and npm releases for:

- `@kangjuhyup/rvlog`
- `@kangjuhyup/rvlog-react`
- `@kangjuhyup/rvlog-nest`

Typical workflow:

1. Make package changes.
2. Run `npm run changeset`.
3. Commit the generated markdown file in this directory.
4. Merge to `main`.
5. The release workflow opens or updates a version PR.
6. Merge the version PR to publish packages to npm.

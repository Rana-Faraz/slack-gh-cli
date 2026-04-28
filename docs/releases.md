# Releases

Releases are automated with GitHub Actions and `semantic-release`.

## What Happens on `main`

When commits land on `main`, `.github/workflows/release.yml`:

1. Installs dependencies with `npm ci`.
2. Runs typecheck, tests, coverage, and build.
3. Runs `npm pack --dry-run`.
4. Runs `semantic-release`.

If the commit history since the previous release contains releasable conventional commits, semantic-release will:

- calculate the next semantic version
- update `package.json`
- update `package-lock.json`
- update `CHANGELOG.md`
- create a release commit
- create a Git tag like `v1.2.3`
- create a GitHub Release with generated release notes
- publish the package to the npm registry

## Required Repository Secret

Add this GitHub Actions secret:

```text
NPM_TOKEN
```

The token must have permission to publish `slack-gh-cli` to the npm registry.

The workflow uses the built-in `GITHUB_TOKEN` for GitHub Releases and release commits.

The workflow also enables npm provenance with GitHub Actions OIDC by setting `NPM_CONFIG_PROVENANCE=true` and granting `id-token: write`.

If `main` has branch protection, allow GitHub Actions to create the semantic-release commit and tag, or configure the release workflow with an appropriate repository token.

## Commit Messages

Use conventional commits:

```text
fix: handle missing desktop cookie
feat: add windows desktop host
docs: improve installation guide
refactor: split workspace catalog
chore: update dependencies
```

Default release behavior:

- `fix:` creates a patch release.
- `feat:` creates a minor release.
- `BREAKING CHANGE:` in the commit body creates a major release.
- `docs:`, `test:`, `refactor:`, and `chore:` usually do not publish by themselves unless semantic-release detects a breaking change.

Do not manually edit the package version for normal releases. semantic-release updates `package.json`, `package-lock.json`, `CHANGELOG.md`, the Git tag, GitHub Release, and npm package together.

## Manual Dry Run

You can inspect what semantic-release would do locally:

```bash
npm run release:dry-run
```

This requires repository history and release credentials for remote checks, but it will not publish.

## Publishing Manually

Manual publishing is not the default path. Prefer merging to `main` and letting the release workflow publish from CI.

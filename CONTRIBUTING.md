# Contributing

Thanks for helping improve `slack`.

## Development Setup

```bash
git clone https://github.com/Rana-Faraz/slack-gh-cli.git
cd slack-gh-cli
npm install
npm run typecheck
npm run test
npm run build
```

Run the CLI locally:

```bash
npm run dev -- --help
```

## Pull Request Checklist

Before opening a pull request:

- Run `npm run typecheck`.
- Run `npm run test`.
- Run `npm run test:coverage`.
- Run `npm run build`.
- Update README or docs when behavior changes.
- Add or update tests for user-visible behavior.

## Architecture Expectations

- Keep command modules thin.
- Put OS-specific behavior behind `DesktopHost`.
- Prefer public Module tests with fake adapters.
- Do not introduce real Slack Desktop, Keychain, or filesystem dependencies into portable tests.
- Add new domain terms to `CONTEXT.md`.

## Commit Style

Use conventional commits. They drive automated versioning and release notes:

```text
feat: add workspace selector
fix: handle missing desktop cookie
test: cover unsupported windows host
refactor: split message dispatch
docs: explain security model
```

Release impact:

- `fix:` publishes a patch release.
- `feat:` publishes a minor release.
- `BREAKING CHANGE:` publishes a major release.
- `docs:`, `test:`, `refactor:`, and `chore:` usually do not publish by themselves.

## Security

Do not include real Slack tokens, cookies, workspace URLs, private channel names, or user data in issues, tests, fixtures, screenshots, or logs.

Report security issues using [SECURITY.md](SECURITY.md).

# slack

`slack` is an unofficial, local-first CLI for Slack user workflows. It is designed to feel familiar if you use `gh`: inspect auth, choose a workspace, search people or channels, and send messages from the terminal.

The CLI reuses the signed-in Slack Desktop session on your machine. It does not require a bot token, a custom Slack app installation, Chrome, Chromium, Playwright, or browser automation.

> This project is not affiliated with, endorsed by, or supported by Slack Technologies, LLC. Slack is a trademark of its respective owner.

## Status

- Runtime support: macOS with Slack Desktop installed and signed in.
- Test support: Linux, macOS, and Windows through fake adapters and portable fixtures.
- Windows runtime support: planned through a future `DesktopHost` adapter; today it should fail gracefully as unsupported.
- Node.js: `>=22`.

## Features

- Reuse the local Slack Desktop user session.
- List, inspect, and choose workspaces.
- Search channels and people.
- Send channel messages or direct messages.
- Mention users by handle in message text.
- Preview sends with `--dry-run`.
- Read longer messages from stdin.
- Keep OS-specific behavior behind a platform adapter.

## Install

Install with Homebrew:

```bash
brew tap Rana-Faraz/tap
brew install slack-gh-cli
slack --help
```

Install directly from GitHub with npm, useful for development or testing before a Homebrew formula is updated:

```bash
npm install -g https://github.com/Rana-Faraz/slack-gh-cli.git
slack --help
```

Install from a local checkout:

```bash
git clone https://github.com/Rana-Faraz/slack-gh-cli.git
cd slack-gh-cli
npm install
npm run build
npm link
slack --help
```

Install from a packed tarball, useful for local release testing:

```bash
npm pack
npm install -g ./slack-gh-cli-0.1.0.tgz
```

## Quick Start

Check whether Slack Desktop auth is available:

```bash
slack auth status
```

Open Slack Desktop if auth is missing:

```bash
slack auth login
```

List workspaces:

```bash
slack workspace list
```

Set the default workspace:

```bash
slack workspace use example-workspace
```

Search for a person and dry-run a message:

```bash
slack dm search alex
slack dm send --handle @alex.morgan --message "hello from the CLI" --dry-run
```

Send the message:

```bash
slack dm send --handle @alex.morgan --message "hello from the CLI"
```

## Commands

```bash
slack auth status
slack auth login

slack workspace list
slack workspace current
slack workspace use <workspace>
slack workspace clear

slack channel list
slack channel search <query>
slack channel send --channel <name> --message <text>
slack channel send --channel-id <id> --message <text>

slack dm list
slack dm search <query>
slack dm send --user <name> --message <text>
slack dm send --handle <handle> --message <text>
slack dm send --user-id <id> --message <text>
```

Every command and subcommand supports `--help`:

```bash
slack --help
slack dm send --help
```

## Workspace Selection

By default, the CLI follows the workspace selected in Slack Desktop. You can save a CLI default:

```bash
slack workspace use example-workspace
```

The default is stored in `~/.slack/config.json`. Clear it with:

```bash
slack workspace clear
```

Use a workspace for one command without changing the saved default:

```bash
slack dm search alex --workspace example-workspace
slack channel list --workspace T0123456789
```

`workspace list` marks each workspace:

- `desktop`: selected in Slack Desktop.
- `default`: selected by the saved CLI default.
- `auth`: a usable cached desktop token is available.
- `no-auth`: Slack Desktop knows about the workspace, but no usable cached token was found.

## Sending Messages

Use inline text:

```bash
slack channel send --channel general --message "deploy is done"
```

Use stdin:

```bash
printf 'multi-line\nmessage\n' | slack dm send --handle @alex.morgan --stdin
```

Preview target resolution and formatting:

```bash
slack dm send --handle @alex.morgan --message '**hello** @alex.morgan' --dry-run
```

Supported formatting:

- `**bold**`
- `*italic*`
- inline code with backticks
- fenced code blocks
- `[label](https://example.com)` links
- `@handle` mentions when the handle resolves in the active workspace

## How Desktop Auth Works

On macOS, `slack auth status` checks:

1. `/Applications/Slack.app`
2. `~/Library/Application Support/Slack`
3. Slack Desktop's cached workspace tokens from Electron/Chromium LevelDB
4. the encrypted Slack Desktop session cookie

The macOS adapter uses system tools that are normally available on macOS:

- `open` to launch Slack Desktop
- `security` to read Slack's safe-storage key from Keychain
- `sqlite3` to read Slack Desktop's cookie store

See [docs/security-model.md](docs/security-model.md) for what the CLI reads, where it writes, and what it does not store.

## Architecture

The project uses a small set of domain Modules:

- `src/session`: Desktop Session, Workspace Credential, Workspace Catalog, and Slack Web requests.
- `src/workspace`: Workspace Snapshot loading and Workspace Directory queries.
- `src/message`: message input, rendering, dispatch, and conversation writes.
- `src/platform`: OS adapters and local desktop storage readers.
- `src/commands`: thin Commander adapters.
- `src/cli`: CLI option parsing and output presenters.

The domain vocabulary is documented in [CONTEXT.md](CONTEXT.md). A deeper architecture overview lives in [docs/architecture.md](docs/architecture.md).

Platform support is tracked in [docs/platform-support.md](docs/platform-support.md).

## Development

```bash
npm install
npm run typecheck
npm run test
npm run test:coverage
npm run build
```

Run locally without linking:

```bash
npm run dev -- --help
```

The test suite uses portable fixtures and fake adapters. It does not read real Slack Desktop data, Keychain entries, browser profiles, or OS-specific app paths.

## Releases

Releases are automated from `main` with GitHub Actions and semantic-release. Release notes are generated from conventional commits, GitHub Releases are created automatically, and a package tarball is attached to each release.

The public install path is Homebrew:

```bash
brew tap Rana-Faraz/tap
brew install slack-gh-cli
```

See [docs/releases.md](docs/releases.md) for the release workflow and commit message rules.

## Agent Skill

This repository includes a publishable Codex skill in `skills/slack/`.

Install from the repository:

```bash
npx skills add https://github.com/Rana-Faraz/slack-gh-cli --skill slack
```

Or install just the skill folder:

```bash
npx skills add https://github.com/Rana-Faraz/slack-gh-cli/tree/main/skills/slack
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

This project follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

For security issues, please follow [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).

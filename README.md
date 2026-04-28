# slack

A local CLI intended to feel closer to `gh`, but for Slack user workflows.

## Install

Build the CLI:

```bash
npm install
npm run build
```

Install it globally from the local repo during development:

```bash
npm link
slack --help
```

Install it globally from a public GitHub repo:

```bash
npm install -g https://github.com/Rana-Faraz/slack-gh-cli.git
slack --help
```

Install it globally from a packed tarball:

```bash
npm pack
npm install -g ./slack-0.1.0.tgz
```

## Install The Agent Skill

Once this repo is public on GitHub, the bundled agent skill can be installed from the same repo with:

```bash
npx skills add https://github.com/Rana-Faraz/slack-gh-cli --skill slack
```

Or install just the skill folder directly:

```bash
npx skills add https://github.com/Rana-Faraz/slack-gh-cli/tree/main/skills/slack
```

This repo now includes the publishable skill at `skills/slack/`.

## Current status

The CLI uses the signed-in Slack Desktop app on macOS. It reads Slack Desktop's local session data and sends through that user session, so no Chrome, Chromium, Playwright browser profile, bot token, or Slack app installation is required.

## Commands

```bash
slack auth status
slack auth login
slack workspace list
slack workspace use example-workspace
slack channel list
slack channel search general
slack channel send --channel general --message "hello"
slack dm list
slack dm search alex
slack dm send --handle @alex.morgan --message "hello"
```

`auth status` checks the local Slack Desktop installation and signed-in session:

1. `/Applications/Slack.app`
2. `~/Library/Application Support/Slack`
3. Slack Desktop's cached workspace tokens from Chromium LevelDB
4. the encrypted Slack Desktop session cookie

`auth login` opens Slack Desktop. Sign in there, then re-run `auth status`.

## Architecture

The domain vocabulary lives in `CONTEXT.md`. The code follows that vocabulary so the CLI stays navigable as new operating systems and workflows are added.

The main Modules are:

- `src/session/desktop-session-manager.ts` is the command-facing Desktop Session facade.
- `src/session/credential-scanner.ts` reads local desktop state and validates cached credentials.
- `src/session/workspace-catalog.ts` lists and resolves known workspaces.
- `src/session/workspace-api-client.ts` sends Slack Web requests with the selected Workspace Credential.
- `src/workspace/workspace-snapshot-repository.ts` loads the selected Workspace Snapshot.
- `src/workspace/workspace-directory.ts` queries and resolves users, channels, and direct-message conversations.
- `src/message/message-dispatch.ts` coordinates message input, rendering, destination resolution, dry runs, and posting.
- `src/platform/macos-slack-desktop-host.ts` is the macOS Desktop Session adapter.
- `src/commands/*` are thin Commander adapters.

## Slack Desktop auth

This project intentionally targets Slack Desktop for macOS through a platform adapter. It shells out to macOS tools that are already present on a normal Mac:

- `open` to launch Slack Desktop
- `security` to read Slack's safe-storage key from Keychain
- `sqlite3` to read Slack Desktop's cookie store
- Chromium LevelDB to read Slack Desktop's `localConfig_v2` workspace token cache

The Slack behavior is separated from OS access:

- `src/platform/desktop-host.ts` defines the Desktop Host interface
- `src/platform/macos-slack-desktop-host.ts` owns macOS paths, Keychain access, app launch, and cookie storage details
- `src/platform/desktop-store.ts` owns reusable LevelDB token parsing and cookie decryption helpers
- `src/session/*` owns credential selection, workspace preference, and Slack Web requests

## Workspace selection

By default, the CLI follows the workspace selected in Slack Desktop. You can inspect and change the CLI default:

```bash
slack workspace list
slack workspace current
slack workspace use example-workspace
slack workspace clear
```

`workspace use` stores the selected workspace in `~/.slack/config.json`. Use `workspace clear` to go back to following Slack Desktop.

For one command only, pass `--workspace`:

```bash
slack dm search alex --workspace example-workspace
slack channel list --workspace T0123456789
```

`workspace list` marks each workspace:

- `desktop` means Slack Desktop is visibly selected there
- `default` means the CLI saved default points there
- `auth` means a usable cached Slack Desktop token is available
- `no-auth` means Slack knows about the workspace, but the CLI cannot find or validate a cached token for it

## Command model

- `channel list` lists accessible public/private channels
- `channel search <query>` searches channels by substring
- `channel send` sends to an exact channel name or channel ID
- `dm list` lists existing one-to-one direct messages
- `dm search <query>` searches human users by name or handle
- `dm send` sends by exact display name, user ID, or handle
- `workspace list/current/use/clear` controls which signed-in Slack Desktop workspace the CLI targets

## Send behavior

- `--message` sends inline text
- `--stdin` reads message text from stdin
- `--dry-run` resolves the target and prints the translated Slack message without sending
- markdown-ish input is translated to Slack formatting for common cases like bold, italics, code, and links

## Testing

```bash
npm run test
npm run test:coverage
```

The test suite uses portable fixtures and fake adapters. It does not read real Slack Desktop data, Keychain entries, browser profiles, or OS-specific app paths. Coverage intentionally excludes the live OS adapter in `src/platform/` and singleton default-session adapters; the reusable LevelDB token parsing, cookie decryption, desktop-session Modules, workspace directory, snapshot loading, and message dispatch behavior are covered through their public Interfaces.

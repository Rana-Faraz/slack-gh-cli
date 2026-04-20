# slack-cli

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
slack-cli --help
```

Install it globally from a public GitHub repo:

```bash
npm install -g https://github.com/Rana-Faraz/slack-gh-cli.git
slack-cli --help
```

Install it globally from a packed tarball:

```bash
npm pack
npm install -g ./slack-cli-0.1.0.tgz
```

## Install The Agent Skill

Once this repo is public on GitHub, the bundled agent skill can be installed from the same repo with:

```bash
npx skills add https://github.com/Rana-Faraz/slack-gh-cli --skill slack-cli
```

Or install just the skill folder directly:

```bash
npx skills add https://github.com/Rana-Faraz/slack-gh-cli/tree/main/skills/slack-cli
```

This repo now includes the publishable skill at `skills/slack-cli/`.

## Current status

This is an initial scaffold. The CLI currently exposes a browser-session auth flow plus early channel and DM commands.

## Commands

```bash
npm run dev -- auth status
npm run dev -- auth login
npm run dev -- channel list
npm run dev -- channel search general
npm run dev -- channel send --channel general --message "hello"
npm run dev -- dm list
npm run dev -- dm search rana
npm run dev -- dm send --handle @adil.sarwar --message "hello"
```

`auth status` currently checks these auth sources:

1. `SLACK_GH_TOKEN`
2. OS credential store item `service="slack-cli"` and `account="default"`
3. local persistent browser profile used for Slack Web

`auth login` opens Slack Web in a persistent Chrome profile that the CLI can reuse later. This avoids
the Slack app-install limit on free workspaces because it does not rely on Slack OAuth app installation.

## Browser auth

By default the CLI auto-detects a Chrome-compatible browser across macOS, Windows, and Linux. It currently checks common installs for:

- Google Chrome
- Chromium
- Microsoft Edge
- Brave
- Arc on macOS

Optional overrides:

- `SLACK_BROWSER_PATH` to point at a Chrome-compatible browser executable
- `SLACK_BROWSER_PROFILE_DIR` to change where the persistent browser profile is stored
- `SLACK_GH_KEYCHAIN_SERVICE` / `SLACK_GH_KEYCHAIN_ACCOUNT` to change the secure-store service/account labels

Example `.env`:

```bash
SLACK_BROWSER_PATH=/path/to/your/browser
```

## Command model

- `channel list` lists accessible public/private channels
- `channel search <query>` searches channels by substring
- `channel send` sends to an exact channel name or channel ID
- `dm list` lists existing one-to-one direct messages
- `dm search <query>` searches human users by name or handle
- `dm send` sends by exact display name, user ID, or handle

## Send behavior

- `--message` sends inline text
- `--stdin` reads message text from stdin
- `--dry-run` resolves the target and prints the translated Slack message without sending
- markdown-ish input is translated to Slack formatting for common cases like bold, italics, code, and links

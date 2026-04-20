---
name: slack-cli
description: Use the local Slack CLI to inspect Slack auth, search channels or people, and send messages through the logged-in Slack Web session. Trigger when Codex should operate Slack from the terminal with commands like `slack-cli auth status`, `slack-cli channel search`, `slack-cli dm search`, `slack-cli channel send`, or `slack-cli dm send`.
---

# Slack CLI

Use the installed `slack-cli` command for Slack discovery and messaging tasks in the local environment. Prefer this skill when the user wants terminal-driven Slack actions instead of manual browser clicks.

## Prerequisite

If `slack-cli` is not installed yet, install it from the repository that contains this skill:

```bash
npm install -g <git-repo-url>
```

Then verify:

```bash
slack-cli --help
```

## Quick Start

Check whether a reusable Slack browser session already exists:

```bash
slack-cli auth status
```

If auth is missing, open the login flow:

```bash
slack-cli auth login
```

## Workflow

Follow this sequence:

1. Confirm the CLI is installed and `slack-cli auth status` succeeds.
2. Discover the target with `channel search`, `channel list`, `dm search`, or `dm list`.
3. Use `--dry-run` before sending if the target is uncertain or the user is testing formatting.
4. Send the real message only when the user clearly asked to send it.

Treat sending as an external side effect. Do not send speculative or test messages unless the user explicitly wants that.

## Discovery Commands

Find channels:

```bash
slack-cli channel search "secured ai"
slack-cli channel list --limit 20
```

Find people for direct messages:

```bash
slack-cli dm search raiha
slack-cli dm list --limit 20
```

Search results typically print:

- channels as `#name<TAB>channel-id<TAB>public|private`
- people as `Display Name<TAB>@handle<TAB>user-id`

Use search before send when the exact target is not already known.

## Send Commands

Send to a channel by name or ID:

```bash
slack-cli channel send --channel general --message "hello"
slack-cli channel send --channel-id C091G22B0SD --message "hello"
```

Send a DM by display name, handle, or user ID:

```bash
slack-cli dm send --user "Talha Farrukh" --message "hello"
slack-cli dm send --handle @talha.farrukh --message "hello"
slack-cli dm send --user-id U07ULPZ0KUM --message "hello"
```

Read the message from stdin when needed:

```bash
printf 'hello from stdin' | slack-cli dm send --handle @talha.farrukh --stdin
```

Use `--show-browser` to debug visible browser behavior during a send.

## Markdown And Mentions

`slack-cli` supports a practical markdown subset for browser-based sending. It is suitable for:

- `**bold**`
- `*italic*`
- inline code with backticks
- fenced code blocks
- bullet lists
- `[label](https://example.com)` links
- `@handle` mentions when the handle resolves to a Slack user in the active workspace

When the user is testing formatting, prefer:

```bash
slack-cli dm send --handle @someone --message '**test** @someone [docs](https://example.com)' --dry-run
```

Then run the real send after confirmation.

## Operational Notes

- The CLI uses the logged-in Slack Web browser session, not a bot token.
- Discovery currently works best through the CLI search commands rather than scraping arbitrary browser UI manually.
- If `auth status` shows no browser session, run `slack-cli auth login` and let the user complete Slack sign-in.
- If a send fails, retry with `--show-browser` to inspect the active Slack UI state.

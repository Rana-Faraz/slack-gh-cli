---
name: slack
description: Use the local Slack CLI to inspect Slack Desktop auth, choose a workspace, search channels or people, and send messages through the signed-in Slack Desktop user session.
---

# Slack

Use `slack` for terminal-driven Slack actions backed by the signed-in Slack Desktop app on macOS. The CLI uses Slack Desktop's local LevelDB token cache plus the encrypted Slack session cookie.

## Start

Verify auth:

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

## Workflow

1. Confirm `slack auth status` succeeds.
2. If the user names a workspace or the target is missing, inspect `workspace list` and use `--workspace` or `workspace use`.
3. Discover the target with `channel search`, `channel list`, `dm search`, or `dm list`.
4. Use `--dry-run` before sending if the target is uncertain or the user is testing formatting.
5. Send the real message only when the user clearly asked to send it.

Treat sending as an external side effect. Do not send speculative or test messages unless the user explicitly wants that.

## Workspace

Set or clear the default workspace:

```bash
slack workspace use example-workspace
slack workspace clear
```

Use a workspace for one command:

```bash
slack dm search alex --workspace example-workspace
slack channel list --workspace T0123456789
```

Prefer `--workspace` for one-off actions. Prefer `workspace use` when the user wants future commands to keep targeting that workspace.

`workspace list` marks workspaces with `desktop`, `default`, `auth`, or `no-auth`. Only `auth` workspaces can be used for search and send.

## Discover

```bash
slack channel search "project updates"
slack channel list --limit 20
slack dm search alex
slack dm list --limit 20
```

Search results print tab-separated identifiers. Use search before send when the exact target is uncertain.

## Send

```bash
slack channel send --channel general --message "hello"
slack channel send --channel-id C0123456789 --message "hello"
slack dm send --user "Alex Morgan" --message "hello"
slack dm send --handle @alex.morgan --message "hello"
slack dm send --user-id U0123456789 --message "hello"
```

Use stdin for longer messages:

```bash
printf 'hello from stdin' | slack dm send --handle @alex.morgan --stdin
```

Use `--dry-run` before sending when the target or formatting is uncertain:

```bash
slack dm send --handle @someone --message '**test** @someone [docs](https://example.com)' --dry-run
```

## Formatting

`slack` supports a practical markdown subset:

- `**bold**`
- `*italic*`
- inline code with backticks
- fenced code blocks
- bullet lists
- `[label](https://example.com)` links
- `@handle` mentions when the handle resolves to a Slack user in the active workspace

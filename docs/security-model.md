# Security Model

This CLI is local-first. It reuses the signed-in Slack Desktop session on the same machine and sends requests as that user.

## What It Reads

On macOS, the production adapter reads:

- Slack Desktop installation path: `/Applications/Slack.app`
- Slack Desktop data directory: `~/Library/Application Support/Slack`
- Slack Desktop root state: workspace metadata and selected workspace
- Slack Desktop LevelDB local storage: cached workspace client tokens
- Slack Desktop cookie database: encrypted session cookie rows
- macOS Keychain: Slack/Chrome safe-storage key used to decrypt the local cookie

## What It Writes

The CLI writes only its workspace preference:

```text
~/.slack/config.json
```

The file stores the selected workspace ID. It does not store Slack tokens or cookies.

## What It Sends

The CLI sends Slack Web requests using the selected desktop session credential. Message-send commands are external side effects. Use `--dry-run` to inspect target resolution and rendered text before sending.

## What It Does Not Do

- It does not require a bot token.
- It does not create or install a Slack app.
- It does not automate Chrome, Chromium, Playwright, or a browser profile.
- It does not persist Slack tokens or cookies outside Slack Desktop's own local storage.
- It does not upload local Slack Desktop storage to any third-party service.

## Reporting Security Issues

Please follow [../SECURITY.md](../SECURITY.md). Do not open public issues containing tokens, cookies, workspace URLs, private channel names, or user data.

# Slack CLI Context

## Domain Language

The CLI is a local command-line interface for Slack workflows. It does not own Slack data; it reads the local desktop app session and uses that session to talk to the Slack web interface.

### Desktop Session

A **Desktop Session** is the signed-in Slack Desktop state available on the local machine. It includes the app installation, the local data directory, encrypted cookies, cached client tokens, workspace metadata, and the saved CLI workspace preference.

### Workspace Selection

A **Workspace Selection** is the rule used to choose which authenticated workspace a command should use. A per-command selector wins first, then the saved CLI default, then the workspace selected in Slack Desktop.

### Workspace Credential

A **Workspace Credential** is the usable pair of local desktop cookie and client token for a single Slack workspace. It is discovered by probing cached desktop tokens and keeping only the tokens accepted by Slack.

### Workspace Catalog

A **Workspace Catalog** is the list of workspaces known from Slack Desktop metadata plus the set of workspaces that currently have valid credentials.

### Workspace Snapshot

A **Workspace Snapshot** is the command-time view of a selected workspace: workspace identity, users, conversations, and direct-message relationships. It is loaded from Slack after a Workspace Credential has been selected.

### Workspace Directory

A **Workspace Directory** is the query interface over a Workspace Snapshot. It lists channels, lists direct messages, searches people and channels, and resolves command selectors into concrete users or conversations.

### Message Dispatch

A **Message Dispatch** resolves the destination, resolves message text, renders Slack-compatible message markup, optionally prints a dry run, and posts the message.

## Architecture Rules

- CLI command modules are adapters. They parse command-line input, call application Modules, and print command output.
- Platform-specific filesystem, Keychain, and process behavior lives behind a Desktop Session adapter.
- Tests should prefer public Module interfaces and fake adapters over mocking internal helper functions.
- Type names live with their Module vocabulary, not in broad type dumping files.

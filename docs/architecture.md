# Architecture

The CLI is organized around a small domain vocabulary instead of Slack-specific helper files. The vocabulary is defined in [../CONTEXT.md](../CONTEXT.md).

## Module Map

### `src/session`

Owns the Desktop Session:

- `DesktopSessionManager` is the command-facing facade.
- `CredentialScanner` reads root state, preference, cookie, and cached client tokens.
- `WorkspaceCredentialResolver` chooses the credential for command execution.
- `WorkspaceCatalog` lists and resolves workspaces.
- `WorkspaceApiClient` sends Slack Web requests with the selected credential.
- `default-desktop-session.ts` wires the production macOS adapter into the session Modules.

### `src/platform`

Owns OS-specific adapters and local desktop storage readers:

- `DesktopHost` is the platform interface.
- `createMacSlackDesktopHost` is the current production adapter.
- `desktop-store.ts` contains reusable LevelDB token parsing and cookie decryption helpers.

Future Windows or Linux support should add another `DesktopHost` adapter without changing `src/session`, `src/workspace`, or `src/message`.

### `src/workspace`

Owns workspace data:

- `WorkspaceSnapshotRepository` loads users and conversations for the selected workspace.
- `WorkspaceDirectory` queries and resolves users, channels, and direct messages.
- `current-workspace.ts` wires the production snapshot reader for command use.

### `src/message`

Owns message behavior:

- `MessageInputResolver` resolves message text from `--message` or stdin.
- `MessageRenderer` translates practical markdown into Slack mrkdwn.
- `ConversationGateway` opens direct messages and posts messages.
- `MessageDispatch` coordinates destination resolution, rendering, dry runs, and posting.

### `src/commands`

Commander adapters only. Command modules parse flags, call application Modules, and print output through `src/cli/presenters.ts`.

## Design Rules

- Keep OS details behind `DesktopHost`.
- Keep command files thin.
- Prefer fake adapters in tests over touching real desktop state.
- Add new domain terms to `CONTEXT.md`.
- Avoid broad type dumping files; keep types near their Module vocabulary.

## Platform Contract

The portable core should work on every OS in tests. Runtime desktop auth support depends on the active `DesktopHost` adapter.

Current runtime behavior:

- macOS: supported through Slack Desktop local state.
- Windows: unsupported but should return a clean unavailable auth status.
- Linux: unsupported but should return a clean unavailable auth status.

# Platform Support

## Runtime Support

| Platform | Status | Notes |
| --- | --- | --- |
| macOS | Supported | Uses Slack Desktop local state, Keychain, SQLite cookie store, and Electron/Chromium LevelDB. |
| Windows | Not implemented | The portable session contract exists. A Windows `DesktopHost` adapter is needed. |
| Linux | Not implemented | The portable session contract exists. A Linux `DesktopHost` adapter is needed. |

Unsupported runtime platforms should return a clean unavailable auth status and avoid touching desktop files.

## Test Support

The test suite is intended to run on Linux, macOS, and Windows. Tests use fake adapters and fixtures instead of real Slack Desktop state.

Run:

```bash
npm run typecheck
npm run test
npm run test:coverage
npm run build
```

## Adding a New Platform Adapter

Implement `DesktopHost` from `src/platform/desktop-host.ts`.

The adapter must provide:

- app path and data directory reporting
- platform support check
- app launch
- root state reading
- workspace preference read/write
- cached client token reading
- session cookie reading
- `fetch` implementation

Keep platform-specific code inside `src/platform`. The existing session, workspace, and message Modules should not need OS-specific branches.

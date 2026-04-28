import type { DesktopHost, DesktopRootState } from "../platform/desktop-host.js";
import { WorkspaceApiClient } from "./workspace-api-client.js";
import type { AuthenticatedWorkspace, CredentialScan } from "./types.js";

/**
 * Reads local desktop state and keeps only credentials accepted by Slack.
 */
export class CredentialScanner {
  constructor(
    private readonly host: DesktopHost,
    private readonly apiClient: WorkspaceApiClient,
  ) {}

  /**
   * Scans root state, workspace preference, cookie, and cached tokens together.
   */
  async scan(): Promise<CredentialScan> {
    await this.host.assertInstalled();

    const [rootState, configuredWorkspace] = await Promise.all([
      this.host.readRootState() as Promise<DesktopRootState>,
      this.host.readWorkspacePreference(),
    ]);
    const [cookie, tokens] = await Promise.all([
      this.host.readCookie("d"),
      this.host.readClientTokens(),
    ]);
    const uniqueTokens = [...new Set(tokens)];

    return {
      configuredWorkspace,
      rootState,
      scannedTokenCount: uniqueTokens.length,
      authenticatedWorkspaces: await this.authenticateTokens(uniqueTokens, cookie),
    };
  }

  private async authenticateTokens(
    tokens: string[],
    cookie: string,
  ): Promise<AuthenticatedWorkspace[]> {
    return (
      await Promise.all(
        tokens.map(async (token) => {
          try {
            return {
              auth: await this.apiClient.testToken(token, cookie),
              cookie,
              token,
            };
          } catch {
            return null;
          }
        }),
      )
    ).filter((result): result is AuthenticatedWorkspace => result !== null);
  }
}

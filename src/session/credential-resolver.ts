import { CredentialScanner } from "./credential-scanner.js";
import { selectAuthenticatedWorkspace } from "./workspace-selection.js";
import type { WorkspaceCredential } from "./types.js";

/**
 * Chooses the workspace credential that commands should use.
 */
export class WorkspaceCredentialResolver {
  constructor(private readonly scanner: CredentialScanner) {}

  /**
   * Resolves a credential using command override, saved preference, then desktop selection.
   */
  async resolve(workspaceOverride?: string): Promise<WorkspaceCredential> {
    const { authenticatedWorkspaces, configuredWorkspace, rootState, scannedTokenCount } =
      await this.scanner.scan();

    if (authenticatedWorkspaces.length === 0) {
      throw new Error(this.emptyCredentialMessage(scannedTokenCount));
    }

    const preferredWorkspace =
      workspaceOverride ??
      configuredWorkspace ??
      rootState.workspacesMeta?.selectedWorkspaceId;
    const selected = preferredWorkspace
      ? selectAuthenticatedWorkspace(
          preferredWorkspace,
          rootState,
          authenticatedWorkspaces,
        )
      : authenticatedWorkspaces[0];
    const workspace = rootState.workspaces?.[selected.auth.team_id];

    return {
      cookie: selected.cookie,
      configuredDefault: configuredWorkspace === selected.auth.team_id,
      selectedInDesktop:
        rootState.workspacesMeta?.selectedWorkspaceId === selected.auth.team_id,
      teamDomain: workspace?.domain,
      teamId: selected.auth.team_id,
      teamName: selected.auth.team || workspace?.name || selected.auth.team_id,
      teamUrl: selected.auth.url ?? workspace?.url,
      token: selected.token,
      userId: selected.auth.user_id,
      userName: selected.auth.user,
    };
  }

  private emptyCredentialMessage(scannedTokenCount: number): string {
    return scannedTokenCount > 0
      ? "Slack Desktop auth was found, but no cached client token was accepted. Open Slack Desktop and let it refresh, then retry."
      : "No Slack Desktop client token found. Open Slack Desktop and sign in first.";
  }
}

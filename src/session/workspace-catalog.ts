import type { DesktopHost } from "../platform/desktop-host.js";
import { CredentialScanner } from "./credential-scanner.js";
import { selectCatalogWorkspace } from "./workspace-selection.js";
import type { DesktopWorkspace } from "./types.js";

/**
 * Lists and resolves workspaces known to the local desktop session.
 */
export class WorkspaceCatalog {
  constructor(
    private readonly host: DesktopHost,
    private readonly scanner: CredentialScanner,
  ) {}

  /**
   * Lists workspace metadata and marks which rows have usable credentials.
   */
  async list(): Promise<DesktopWorkspace[]> {
    const { authenticatedWorkspaces, configuredWorkspace, rootState } =
      await this.scanner.scan();
    const workspaceIds = new Set<string>([
      ...Object.keys(rootState.workspaces ?? {}),
      ...authenticatedWorkspaces.map((result) => result.auth.team_id),
    ]);

    return [...workspaceIds]
      .map((id) => {
        const workspace = rootState.workspaces?.[id];
        const authenticated = authenticatedWorkspaces.find(
          (result) => result.auth.team_id === id,
        )?.auth;

        return {
          id,
          name: authenticated?.team || workspace?.name || id,
          domain: workspace?.domain,
          url: authenticated?.url ?? workspace?.url,
          userId: authenticated?.user_id,
          userName: authenticated?.user,
          selectedInDesktop: rootState.workspacesMeta?.selectedWorkspaceId === id,
          configuredDefault: configuredWorkspace === id,
          authenticated: Boolean(authenticated),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  /**
   * Resolves a human-entered selector to an authenticated workspace row.
   */
  async resolve(workspace: string): Promise<DesktopWorkspace> {
    return selectCatalogWorkspace(await this.list(), workspace);
  }

  /**
   * Saves the CLI default workspace preference.
   */
  async savePreference(workspace: string): Promise<DesktopWorkspace> {
    const selected = await this.resolve(workspace);
    await this.host.writeWorkspacePreference({ workspace: selected.id });

    return {
      ...selected,
      configuredDefault: true,
    };
  }

  /**
   * Clears the CLI default workspace preference.
   */
  async clearPreference(): Promise<boolean> {
    const existingWorkspace = await this.host.readWorkspacePreference();
    await this.host.writeWorkspacePreference({});
    return Boolean(existingWorkspace);
  }
}

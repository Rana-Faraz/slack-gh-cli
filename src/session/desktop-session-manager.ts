import type { DesktopHost } from "../platform/desktop-host.js";
import { CredentialScanner } from "./credential-scanner.js";
import { WorkspaceApiClient } from "./workspace-api-client.js";
import { WorkspaceCatalog } from "./workspace-catalog.js";
import { WorkspaceCredentialResolver } from "./credential-resolver.js";
import type {
  DesktopSessionStatus,
  DesktopWorkspace,
  WorkspaceCredential,
  WorkspaceRequestParams,
} from "./types.js";

/**
 * Facade for all command-facing desktop session operations.
 */
export class DesktopSessionManager {
  private credentialPromise: Promise<WorkspaceCredential> | undefined;
  private workspaceOverride: string | undefined;
  private readonly apiClient: WorkspaceApiClient;
  private readonly catalog: WorkspaceCatalog;
  private readonly credentialResolver: WorkspaceCredentialResolver;

  constructor(private readonly host: DesktopHost) {
    this.apiClient = new WorkspaceApiClient(host);
    const scanner = new CredentialScanner(host, this.apiClient);
    this.catalog = new WorkspaceCatalog(host, scanner);
    this.credentialResolver = new WorkspaceCredentialResolver(scanner);
  }

  /**
   * Opens Slack Desktop so the user can establish a local session.
   */
  async openLogin(): Promise<void> {
    await this.host.assertInstalled();
    await this.host.openApp();
  }

  /**
   * Overrides workspace selection for the next command flow.
   */
  setWorkspaceOverride(workspace?: string): void {
    const normalizedWorkspace = workspace?.trim();
    this.workspaceOverride =
      normalizedWorkspace && normalizedWorkspace.length > 0
        ? normalizedWorkspace
        : undefined;
    this.credentialPromise = undefined;
  }

  /**
   * Reports whether the current machine has a usable desktop session.
   */
  async lookupAuth(): Promise<DesktopSessionStatus> {
    if (!this.host.isSupported()) {
      return {
        available: false,
        appPath: this.host.appPath,
        dataDir: this.host.dataDir,
        warning: this.host.unsupportedMessage,
      };
    }

    try {
      const credential = await this.getCredential();

      return {
        available: true,
        appPath: this.host.appPath,
        dataDir: this.host.dataDir,
        teamDomain: credential.teamDomain,
        teamId: credential.teamId,
        teamName: credential.teamName,
        teamUrl: credential.teamUrl,
        userId: credential.userId,
        userName: credential.userName,
      };
    } catch (error) {
      return {
        available: false,
        appPath: this.host.appPath,
        dataDir: this.host.dataDir,
        warning:
          error instanceof Error
            ? error.message
            : "Could not read Slack Desktop authentication.",
      };
    }
  }

  /**
   * Lists desktop workspaces and their credential state.
   */
  async listWorkspaces(): Promise<DesktopWorkspace[]> {
    return await this.catalog.list();
  }

  /**
   * Returns the workspace selected for command execution.
   */
  async getCurrentWorkspace(): Promise<DesktopWorkspace> {
    const credential = await this.getCredential();

    return {
      id: credential.teamId,
      name: credential.teamName,
      domain: credential.teamDomain,
      url: credential.teamUrl,
      userId: credential.userId,
      userName: credential.userName,
      selectedInDesktop: credential.selectedInDesktop,
      configuredDefault: credential.configuredDefault,
      authenticated: true,
    };
  }

  /**
   * Returns the selected workspace credential, cached per manager instance.
   */
  async getCredential(): Promise<WorkspaceCredential> {
    this.credentialPromise ??= this.credentialResolver.resolve(this.workspaceOverride);
    return await this.credentialPromise;
  }

  /**
   * Saves the default workspace preference.
   */
  async saveWorkspacePreference(workspace: string): Promise<DesktopWorkspace> {
    const selected = await this.catalog.savePreference(workspace);
    this.credentialPromise = undefined;
    return selected;
  }

  /**
   * Clears the default workspace preference.
   */
  async clearWorkspacePreference(): Promise<boolean> {
    const removed = await this.catalog.clearPreference();
    this.credentialPromise = undefined;
    return removed;
  }

  /**
   * Calls a Slack Web method with the selected workspace credential.
   */
  async request<T>(method: string, params: WorkspaceRequestParams): Promise<T> {
    return await this.apiClient.request<T>(
      await this.getCredential(),
      method,
      params,
    );
  }
}

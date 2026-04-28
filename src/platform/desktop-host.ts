/**
 * Workspace metadata recorded by Slack Desktop root state.
 */
export type DesktopWorkspaceMetadata = {
  id?: string;
  name?: string;
  domain?: string;
  url?: string;
};

/**
 * Root state shape read from Slack Desktop local storage.
 */
export type DesktopRootState = {
  workspaces?: Record<string, DesktopWorkspaceMetadata>;
  workspacesMeta?: {
    selectedWorkspaceId?: string;
    selectedUserId?: string;
  };
};

/**
 * Platform adapter used by the desktop session Modules.
 */
export type DesktopHost = {
  appPath: string;
  dataDir: string;
  unsupportedMessage: string;
  isSupported(): boolean;
  assertInstalled(): Promise<void>;
  openApp(): Promise<void>;
  readRootState(): Promise<unknown>;
  readWorkspacePreference(): Promise<string | undefined>;
  writeWorkspacePreference(config: unknown): Promise<void>;
  readClientTokens(): Promise<string[]>;
  readCookie(name: string): Promise<string>;
  fetch(input: string | URL, init?: RequestInit): Promise<Response>;
};

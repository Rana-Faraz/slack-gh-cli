import type { DesktopRootState } from "../platform/desktop-host.js";

/**
 * Slack Web response envelope used by desktop-session requests.
 */
export type WorkspaceApiResponse<T> = T & {
  ok: boolean;
  error?: string;
  needed?: string;
};

/**
 * Response shape returned by Slack auth.test.
 */
export type AuthTestResult = {
  team: string;
  team_id: string;
  user: string;
  user_id: string;
  url?: string;
};

/**
 * Parameters accepted by Slack Web methods used by this CLI.
 */
export type WorkspaceRequestParams = Record<
  string,
  string | number | boolean | undefined
>;

/**
 * Credential proven valid for one workspace.
 */
export type AuthenticatedWorkspace = {
  auth: AuthTestResult;
  cookie: string;
  token: string;
};

/**
 * Result of scanning the local desktop session.
 */
export type CredentialScan = {
  configuredWorkspace?: string;
  rootState: DesktopRootState;
  scannedTokenCount: number;
  authenticatedWorkspaces: AuthenticatedWorkspace[];
};

/**
 * Public status for the local desktop session.
 */
export type DesktopSessionStatus = {
  available: boolean;
  appPath: string;
  dataDir: string;
  teamId?: string;
  teamName?: string;
  teamDomain?: string;
  teamUrl?: string;
  userId?: string;
  userName?: string;
  warning?: string;
};

/**
 * Workspace row known to the local desktop session.
 */
export type DesktopWorkspace = {
  id: string;
  name: string;
  domain?: string;
  url?: string;
  userId?: string;
  userName?: string;
  selectedInDesktop: boolean;
  configuredDefault: boolean;
  authenticated: boolean;
};

/**
 * Usable credential selected for command execution.
 */
export type WorkspaceCredential = {
  configuredDefault: boolean;
  cookie: string;
  selectedInDesktop: boolean;
  teamDomain?: string;
  teamId: string;
  teamName: string;
  teamUrl?: string;
  token: string;
  userId: string;
  userName: string;
};

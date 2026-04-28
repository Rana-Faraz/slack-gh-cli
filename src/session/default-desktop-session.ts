import { createMacSlackDesktopHost } from "../platform/macos-slack-desktop-host.js";
import { DesktopSessionManager } from "./desktop-session-manager.js";
import type {
  DesktopSessionStatus,
  DesktopWorkspace,
  WorkspaceCredential,
  WorkspaceRequestParams,
} from "./types.js";

const session = new DesktopSessionManager(createMacSlackDesktopHost());

/**
 * Overrides workspace selection for the next command flow.
 */
export function setWorkspaceOverride(workspace?: string): void {
  session.setWorkspaceOverride(workspace);
}

/**
 * Opens Slack Desktop so the user can sign in.
 */
export async function openDesktopLogin(): Promise<void> {
  await session.openLogin();

  console.log("Opened Slack Desktop.");
  console.log("Sign in there, then run `slack auth status`.");
}

/**
 * Reports local desktop-session availability.
 */
export async function lookupDesktopSession(): Promise<DesktopSessionStatus> {
  return await session.lookupAuth();
}

/**
 * Lists workspaces known to the desktop session.
 */
export async function listDesktopWorkspaces(): Promise<DesktopWorkspace[]> {
  return await session.listWorkspaces();
}

/**
 * Returns the workspace selected for command execution.
 */
export async function getCurrentDesktopWorkspace(): Promise<DesktopWorkspace> {
  return await session.getCurrentWorkspace();
}

/**
 * Saves the default workspace preference.
 */
export async function saveWorkspacePreference(
  workspace: string,
): Promise<DesktopWorkspace> {
  return await session.saveWorkspacePreference(workspace);
}

/**
 * Clears the default workspace preference.
 */
export async function clearWorkspacePreference(): Promise<boolean> {
  return await session.clearWorkspacePreference();
}

/**
 * Sends a Slack Web request through the selected desktop session.
 */
export async function requestWorkspace<T>(
  method: string,
  params: WorkspaceRequestParams,
): Promise<T> {
  return await session.request<T>(method, params);
}

/**
 * Returns the selected workspace credential.
 */
export async function getWorkspaceCredential(): Promise<WorkspaceCredential> {
  return await session.getCredential();
}

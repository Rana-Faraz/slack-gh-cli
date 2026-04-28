import { createMacSlackDesktopHost } from "../platform/macos-slack-desktop-host.js";
import {
  createSlackDesktopClient,
  type SlackDesktopAuthStatus,
  type SlackDesktopCredential,
  type SlackDesktopWorkspace,
} from "./desktop-client.js";

export type {
  SlackDesktopAuthStatus,
  SlackDesktopCredential,
  SlackDesktopWorkspace,
};

const client = createSlackDesktopClient(createMacSlackDesktopHost());

export function setSlackDesktopWorkspaceOverride(workspace?: string): void {
  client.setWorkspaceOverride(workspace);
}

export async function openSlackDesktopLogin(): Promise<void> {
  await client.openLogin();

  console.log("Opened Slack Desktop.");
  console.log("Sign in there, then run `slack auth status`.");
}

export async function lookupSlackDesktopAuth(): Promise<SlackDesktopAuthStatus> {
  return await client.lookupAuth();
}

export async function listSlackDesktopWorkspaces(): Promise<SlackDesktopWorkspace[]> {
  return await client.listWorkspaces();
}

export async function getCurrentSlackDesktopWorkspace(): Promise<SlackDesktopWorkspace> {
  return await client.getCurrentWorkspace();
}

export async function saveSlackDesktopWorkspacePreference(
  workspace: string,
): Promise<SlackDesktopWorkspace> {
  return await client.saveWorkspacePreference(workspace);
}

export async function clearSlackDesktopWorkspacePreference(): Promise<boolean> {
  return await client.clearWorkspacePreference();
}

export async function callSlackDesktopApi<T>(
  method: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  return await client.callApi<T>(method, params);
}

export async function getSlackDesktopCredential(): Promise<SlackDesktopCredential> {
  return await client.getCredential();
}

import type {
  ChannelListItem,
  DirectMessageListItem,
} from "../domain/workspace.js";
import type { DesktopSessionStatus, DesktopWorkspace } from "../session/types.js";

/**
 * Formats auth status output for command-line presentation.
 */
export function printAuthStatus(status: DesktopSessionStatus): void {
  if (status.available) {
    console.log("Slack Desktop authentication is available.");
    console.log(`Slack Desktop app: ${status.appPath}`);
    console.log(`Slack Desktop data: ${status.dataDir}`);

    if (status.userName) {
      console.log(`Slack Desktop user: ${status.userName}`);
    }

    if (status.userId) {
      console.log(`Slack Desktop user ID: ${status.userId}`);
    }

    if (status.teamName || status.teamId) {
      console.log(`Slack Desktop workspace: ${status.teamName ?? status.teamId}`);
    }

    if (status.teamId) {
      console.log(`Slack Desktop workspace ID: ${status.teamId}`);
    }

    if (status.teamDomain) {
      console.log(`Slack Desktop workspace domain: ${status.teamDomain}`);
    }

    if (status.teamUrl) {
      console.log(`Slack Desktop workspace URL: ${status.teamUrl}`);
    }
  } else {
    console.log("No Slack Desktop auth found.");
    console.log("Checked:");
    console.log(`- Slack Desktop data ${status.dataDir}`);
    console.log("Next step: run `slack auth login` and sign in to Slack Desktop.");
    process.exitCode = 1;
  }

  if (status.warning) {
    console.warn(`Warning: ${status.warning}`);
  }
}

/**
 * Prints workspace rows in a stable tab-separated format.
 */
export function printWorkspaceList(items: DesktopWorkspace[]): void {
  for (const item of items) {
    const markers = [
      item.selectedInDesktop ? "desktop" : undefined,
      item.configuredDefault ? "default" : undefined,
      item.authenticated ? "auth" : "no-auth",
    ]
      .filter(Boolean)
      .join(",");

    console.log(
      [item.name, item.id, item.domain ?? "", item.userId ?? "", markers].join("\t"),
    );
  }
}

/**
 * Prints the workspace selected for command execution.
 */
export function printCurrentWorkspace(current: DesktopWorkspace): void {
  console.log(`Workspace: ${current.name}`);
  console.log(`Workspace ID: ${current.id}`);

  if (current.domain) {
    console.log(`Domain: ${current.domain}`);
  }

  if (current.userName) {
    console.log(`User: ${current.userName}`);
  }

  if (current.userId) {
    console.log(`User ID: ${current.userId}`);
  }

  console.log(`Selected in Slack Desktop: ${current.selectedInDesktop ? "yes" : "no"}`);
  console.log(`Configured default: ${current.configuredDefault ? "yes" : "no"}`);
}

/**
 * Prints channel list rows in a stable tab-separated format.
 */
export function printChannels(items: ChannelListItem[]): void {
  for (const item of items) {
    console.log(`#${item.name}\t${item.id}\t${item.visibility}`);
  }
}

/**
 * Prints direct-message list rows in a stable tab-separated format.
 */
export function printDirectMessages(items: DirectMessageListItem[]): void {
  for (const item of items) {
    console.log(`${item.displayName}\t@${item.handle}\t${item.userId}`);
  }
}

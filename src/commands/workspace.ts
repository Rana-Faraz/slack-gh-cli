import { Command } from "commander";
import {
  clearSlackDesktopWorkspacePreference,
  getCurrentSlackDesktopWorkspace,
  listSlackDesktopWorkspaces,
  saveSlackDesktopWorkspacePreference,
} from "../slack/desktop.js";

export function registerWorkspaceCommands(program: Command): void {
  const workspace = program
    .command("workspace")
    .description("Choose which Slack Desktop workspace the CLI should use.");

  workspace
    .command("list")
    .description("List Slack Desktop workspaces with cached auth.")
    .action(async () => {
      const items = await listSlackDesktopWorkspaces();

      for (const item of items) {
        const markers = [
          item.selectedInDesktop ? "desktop" : undefined,
          item.configuredDefault ? "default" : undefined,
          item.authenticated ? "auth" : "no-auth",
        ]
          .filter(Boolean)
          .join(",");

        console.log(
          [
            item.name,
            item.id,
            item.domain ?? "",
            item.userId ?? "",
            markers,
          ].join("\t"),
        );
      }
    });

  workspace
    .command("current")
    .description("Show the workspace currently selected by the CLI.")
    .action(async () => {
      const current = await getCurrentSlackDesktopWorkspace();

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
    });

  workspace
    .command("use")
    .description("Set the default workspace by ID, domain, or exact name.")
    .argument("<workspace>", "Workspace ID, domain, or name")
    .action(async (workspaceSelector: string) => {
      const selected = await saveSlackDesktopWorkspacePreference(workspaceSelector);
      console.log(`Default workspace set to ${selected.name} (${selected.id}).`);
    });

  workspace
    .command("clear")
    .description("Clear the saved default workspace and follow Slack Desktop again.")
    .action(async () => {
      const removed = await clearSlackDesktopWorkspacePreference();
      console.log(
        removed
          ? "Default workspace cleared."
          : "No default workspace was configured.",
      );
    });
}

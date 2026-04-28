import { Command } from "commander";
import { printCurrentWorkspace, printWorkspaceList } from "../cli/presenters.js";
import {
  clearWorkspacePreference,
  getCurrentDesktopWorkspace,
  listDesktopWorkspaces,
  saveWorkspacePreference,
} from "../session/default-desktop-session.js";

/**
 * Registers workspace selection commands on the root CLI program.
 */
export function registerWorkspaceCommands(program: Command): void {
  const workspace = program
    .command("workspace")
    .description("Choose which Slack Desktop workspace the CLI should use.");

  workspace
    .command("list")
    .description("List Slack Desktop workspaces with cached auth.")
    .action(async () => {
      printWorkspaceList(await listDesktopWorkspaces());
    });

  workspace
    .command("current")
    .description("Show the workspace currently selected by the CLI.")
    .action(async () => {
      printCurrentWorkspace(await getCurrentDesktopWorkspace());
    });

  workspace
    .command("use")
    .description("Set the default workspace by ID, domain, or exact name.")
    .argument("<workspace>", "Workspace ID, domain, or name")
    .action(async (workspaceSelector: string) => {
      const selected = await saveWorkspacePreference(workspaceSelector);
      console.log(`Default workspace set to ${selected.name} (${selected.id}).`);
    });

  workspace
    .command("clear")
    .description("Clear the saved default workspace and follow Slack Desktop again.")
    .action(async () => {
      const removed = await clearWorkspacePreference();
      console.log(
        removed
          ? "Default workspace cleared."
          : "No default workspace was configured.",
      );
    });
}

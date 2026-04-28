import { Command } from "commander";
import {
  lookupSlackDesktopAuth,
  openSlackDesktopLogin,
  setSlackDesktopWorkspaceOverride,
} from "../slack/desktop.js";
import type { WorkspaceScopedOptions } from "../slack/types.js";

export function registerAuthCommands(program: Command): void {
  const auth = program
    .command("auth")
    .description("Manage local Slack authentication.");

  auth
    .command("login")
    .description("Open Slack Desktop so the CLI can reuse its signed-in session.")
    .action(async () => {
      await openSlackDesktopLogin();
    });

  auth
    .command("status")
    .description("Show whether local Slack auth is available.")
    .option("-w, --workspace <workspace>", "Workspace ID, domain, or name")
    .action(async (options: WorkspaceScopedOptions) => {
      setSlackDesktopWorkspaceOverride(options.workspace);
      const desktopAuth = await lookupSlackDesktopAuth();

      if (desktopAuth.available) {
        console.log("Slack Desktop authentication is available.");

        console.log(`Slack Desktop app: ${desktopAuth.appPath}`);
        console.log(`Slack Desktop data: ${desktopAuth.dataDir}`);

        if (desktopAuth.userName) {
          console.log(`Slack Desktop user: ${desktopAuth.userName}`);
        }

        if (desktopAuth.userId) {
          console.log(`Slack Desktop user ID: ${desktopAuth.userId}`);
        }

        if (desktopAuth.teamName || desktopAuth.teamId) {
          console.log(
            `Slack Desktop workspace: ${desktopAuth.teamName ?? desktopAuth.teamId}`,
          );
        }

        if (desktopAuth.teamId) {
          console.log(`Slack Desktop workspace ID: ${desktopAuth.teamId}`);
        }

        if (desktopAuth.teamDomain) {
          console.log(`Slack Desktop workspace domain: ${desktopAuth.teamDomain}`);
        }

        if (desktopAuth.teamUrl) {
          console.log(`Slack Desktop workspace URL: ${desktopAuth.teamUrl}`);
        }
      } else {
        console.log("No Slack Desktop auth found.");
        console.log("Checked:");
        console.log(`- Slack Desktop data ${desktopAuth.dataDir}`);
        console.log(
          "Next step: run `slack auth login` and sign in to Slack Desktop.",
        );

        process.exitCode = 1;
      }

      if (desktopAuth.warning) {
        console.warn(`Warning: ${desktopAuth.warning}`);
      }
    });
}

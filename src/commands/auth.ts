import { Command } from "commander";
import { printAuthStatus } from "../cli/presenters.js";
import type { WorkspaceScopedOptions } from "../cli/options.js";
import {
  lookupDesktopSession,
  openDesktopLogin,
  setWorkspaceOverride,
} from "../session/default-desktop-session.js";

/**
 * Registers auth commands on the root CLI program.
 */
export function registerAuthCommands(program: Command): void {
  const auth = program
    .command("auth")
    .description("Manage local Slack authentication.");

  auth
    .command("login")
    .description("Open Slack Desktop so the CLI can reuse its signed-in session.")
    .action(async () => {
      await openDesktopLogin();
    });

  auth
    .command("status")
    .description("Show whether local Slack auth is available.")
    .option("-w, --workspace <workspace>", "Workspace ID, domain, or name")
    .action(async (options: WorkspaceScopedOptions) => {
      setWorkspaceOverride(options.workspace);
      printAuthStatus(await lookupDesktopSession());
    });
}

import { Command } from "commander";
import { parsePositiveIntegerOption } from "../cli/options.js";
import { printDirectMessages } from "../cli/presenters.js";
import type { WorkspaceScopedOptions } from "../cli/options.js";
import type { DirectMessageSendOptions } from "../domain/message.js";
import { sendDirectMessage } from "../message/default-message-dispatch.js";
import { setWorkspaceOverride } from "../session/default-desktop-session.js";
import {
  listCurrentDirectMessages,
  searchCurrentUsers,
} from "../workspace/current-workspace.js";

/**
 * Registers direct-message commands on the root CLI program.
 */
export function registerDmCommands(program: Command): void {
  const dm = program.command("dm").description("Work with Slack direct messages.");

  dm
    .command("list")
    .description("List existing direct messages.")
    .option("-L, --limit <limit>", "Number of direct messages to show", "20")
    .option("-w, --workspace <workspace>", "Workspace ID, domain, or name")
    .action(async (options: { limit: string } & WorkspaceScopedOptions) => {
      setWorkspaceOverride(options.workspace);
      printDirectMessages(
        await listCurrentDirectMessages(parsePositiveIntegerOption("limit", options.limit)),
      );
    });

  dm
    .command("search")
    .description("Search people you can message.")
    .argument("<query>", "Direct message search query")
    .option("-L, --limit <limit>", "Number of people to show", "20")
    .option("-w, --workspace <workspace>", "Workspace ID, domain, or name")
    .action(async (query: string, options: { limit: string } & WorkspaceScopedOptions) => {
      setWorkspaceOverride(options.workspace);
      printDirectMessages(
        await searchCurrentUsers(query, parsePositiveIntegerOption("limit", options.limit)),
      );
    });

  dm
    .command("send")
    .description("Send a direct message.")
    .option("--user <user>", "Exact display name or real name")
    .option("--user-id <userId>", "Slack user ID")
    .option("--handle <handle>", "Slack handle, with or without @")
    .option("-m, --message <message>", "Message text")
    .option("--stdin", "Read message text from stdin")
    .option("--dry-run", "Resolve target and show the translated message without sending")
    .option("-w, --workspace <workspace>", "Workspace ID, domain, or name")
    .action(async (options: DirectMessageSendOptions) => {
      setWorkspaceOverride(options.workspace);
      await sendDirectMessage(options);
    });
}

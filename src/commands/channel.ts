import { Command } from "commander";
import { parsePositiveIntegerOption } from "../cli/options.js";
import { printChannels } from "../cli/presenters.js";
import type { WorkspaceScopedOptions } from "../cli/options.js";
import type { ChannelSendOptions } from "../domain/message.js";
import { sendChannelMessage } from "../message/default-message-dispatch.js";
import { setWorkspaceOverride } from "../session/default-desktop-session.js";
import {
  listCurrentChannels,
  searchCurrentChannels,
} from "../workspace/current-workspace.js";

/**
 * Registers channel commands on the root CLI program.
 */
export function registerChannelCommands(program: Command): void {
  const channel = program.command("channel").description("Work with Slack channels.");

  channel
    .command("list")
    .description("List channels available to the logged-in user.")
    .option("-L, --limit <limit>", "Number of channels to show", "20")
    .option("-w, --workspace <workspace>", "Workspace ID, domain, or name")
    .action(async (options: { limit: string } & WorkspaceScopedOptions) => {
      setWorkspaceOverride(options.workspace);
      printChannels(
        await listCurrentChannels(parsePositiveIntegerOption("limit", options.limit)),
      );
    });

  channel
    .command("search")
    .description("Search channels by name.")
    .argument("<query>", "Channel search query")
    .option("-L, --limit <limit>", "Number of channels to show", "20")
    .option("-w, --workspace <workspace>", "Workspace ID, domain, or name")
    .action(async (query: string, options: { limit: string } & WorkspaceScopedOptions) => {
      setWorkspaceOverride(options.workspace);
      printChannels(
        await searchCurrentChannels(query, parsePositiveIntegerOption("limit", options.limit)),
      );
    });

  channel
    .command("send")
    .description("Send a message to a channel.")
    .option("--channel <channel>", "Exact channel name")
    .option("--channel-id <channelId>", "Channel ID")
    .option("-m, --message <message>", "Message text")
    .option("--stdin", "Read message text from stdin")
    .option("--dry-run", "Resolve target and show the translated message without sending")
    .option("-w, --workspace <workspace>", "Workspace ID, domain, or name")
    .action(async (options: ChannelSendOptions) => {
      setWorkspaceOverride(options.workspace);
      await sendChannelMessage(options);
    });
}

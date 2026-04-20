import { Command } from "commander";
import { liveSearchChannels } from "../slack/live-search.js";
import { listChannels, readSlackWorkspaceSnapshot } from "../slack/state.js";
import { sendChannelMessage } from "../slack/send.js";
import type { ChannelSendOptions } from "../slack/types.js";

export function registerChannelCommands(program: Command): void {
  const channel = program.command("channel").description("Work with Slack channels.");

  channel
    .command("list")
    .description("List channels available to the logged-in user.")
    .option("-L, --limit <limit>", "Number of channels to show", "20")
    .action(async (options: { limit: string }) => {
      const snapshot = await readSlackWorkspaceSnapshot();
      const items = listChannels(snapshot, parseLimit(options.limit));

      for (const item of items) {
        console.log(`#${item.name}\t${item.id}\t${item.visibility}`);
      }
    });

  channel
    .command("search")
    .description("Search channels by name.")
    .argument("<query>", "Channel search query")
    .option("-L, --limit <limit>", "Number of channels to show", "20")
    .action(async (query: string, options: { limit: string }) => {
      const items = await liveSearchChannels(query, parseLimit(options.limit));

      for (const item of items) {
        console.log(`#${item.name}\t${item.id}\t${item.visibility}`);
      }
    });

  channel
    .command("send")
    .description("Send a message to a channel.")
    .option("--channel <channel>", "Exact channel name")
    .option("--channel-id <channelId>", "Channel ID")
    .option("-m, --message <message>", "Message text")
    .option("--stdin", "Read message text from stdin")
    .option("--dry-run", "Resolve target and show the translated message without sending")
    .option("--show-browser", "Show the browser while sending")
    .action(async (options: ChannelSendOptions) => {
      await sendChannelMessage(options);
    });
}

function parseLimit(value: string): number {
  const limit = Number.parseInt(value, 10);

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`Invalid limit: ${value}`);
  }

  return limit;
}

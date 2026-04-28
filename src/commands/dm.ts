import { Command } from "commander";
import { setSlackDesktopWorkspaceOverride } from "../slack/desktop.js";
import { liveSearchUsers } from "../slack/live-search.js";
import { listDirectMessages, readSlackWorkspaceSnapshot } from "../slack/state.js";
import { sendDirectMessage } from "../slack/send.js";
import type { DmSendOptions, WorkspaceScopedOptions } from "../slack/types.js";

export function registerDmCommands(program: Command): void {
  const dm = program.command("dm").description("Work with Slack direct messages.");

  dm
    .command("list")
    .description("List existing direct messages.")
    .option("-L, --limit <limit>", "Number of direct messages to show", "20")
    .option("-w, --workspace <workspace>", "Workspace ID, domain, or name")
    .action(async (options: { limit: string } & WorkspaceScopedOptions) => {
      setSlackDesktopWorkspaceOverride(options.workspace);
      const snapshot = await readSlackWorkspaceSnapshot();
      const items = listDirectMessages(snapshot, parseLimit(options.limit));

      for (const item of items) {
        console.log(`${item.displayName}\t@${item.handle}\t${item.userId}`);
      }
    });

  dm
    .command("search")
    .description("Search people you can message.")
    .argument("<query>", "Direct message search query")
    .option("-L, --limit <limit>", "Number of people to show", "20")
    .option("-w, --workspace <workspace>", "Workspace ID, domain, or name")
    .action(async (query: string, options: { limit: string } & WorkspaceScopedOptions) => {
      setSlackDesktopWorkspaceOverride(options.workspace);
      const items = await liveSearchUsers(query, parseLimit(options.limit));

      for (const item of items) {
        console.log(`${item.displayName}\t@${item.handle}\t${item.userId}`);
      }
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
    .action(async (options: DmSendOptions) => {
      setSlackDesktopWorkspaceOverride(options.workspace);
      await sendDirectMessage(options);
    });
}

function parseLimit(value: string): number {
  const limit = Number.parseInt(value, 10);

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`Invalid limit: ${value}`);
  }

  return limit;
}

import { callSlackDesktopApi } from "./desktop.js";
import { resolveMessageInput, translateMarkdownToSlack } from "./message.js";
import {
  findExistingDirectMessage,
  readSlackWorkspaceSnapshot,
  resolveChannel,
  resolveUser,
} from "./state.js";
import type { ChannelSendOptions, DmSendOptions } from "./types.js";

type ConversationsOpenResponse = {
  channel: {
    id: string;
  };
};

export async function sendChannelMessage(options: ChannelSendOptions): Promise<void> {
  const snapshot = await readSlackWorkspaceSnapshot();
  const channel = resolveChannel(snapshot, options);
  const rawMessage = await resolveMessageInput(options);
  const preview = translateMarkdownToSlack(rawMessage, snapshot.users);

  if (options.dryRun) {
    console.log(`Would send to #${channel.name}`);
    console.log(preview);
    return;
  }

  await postSlackMessage(channel.id, preview);

  console.log(`Sent to #${channel.name}`);
}

export async function sendDirectMessage(options: DmSendOptions): Promise<void> {
  const snapshot = await readSlackWorkspaceSnapshot();
  const user = resolveUser(snapshot, options);
  const rawMessage = await resolveMessageInput(options);
  const preview = translateMarkdownToSlack(rawMessage, snapshot.users);
  const existingDm = findExistingDirectMessage(snapshot, user.id);

  if (options.dryRun) {
    console.log(`Would send to ${user.displayName} (@${user.handle})`);
    console.log(preview);
    return;
  }

  const conversationId = existingDm?.id ?? (await openDirectMessage(user.id));
  await postSlackMessage(conversationId, preview);

  console.log(`Sent to ${user.displayName} (@${user.handle})`);
}

async function openDirectMessage(userId: string): Promise<string> {
  const response = await callSlackDesktopApi<ConversationsOpenResponse>(
    "conversations.open",
    {
      users: userId,
      return_im: true,
    },
  );

  return response.channel.id;
}

async function postSlackMessage(channelId: string, text: string): Promise<void> {
  await callSlackDesktopApi("chat.postMessage", {
    channel: channelId,
    text,
    mrkdwn: true,
  });
}

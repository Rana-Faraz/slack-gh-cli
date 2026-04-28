import { callSlackDesktopApi, getSlackDesktopCredential } from "./desktop.js";
import type {
  ChannelListItem,
  DirectMessageListItem,
  SlackConversation,
  SlackUser,
  SlackWorkspaceSnapshot,
} from "./types.js";

type SlackUsersListResponse = {
  members: Array<{
    id: string;
    name?: string;
    real_name?: string;
    team_id?: string;
    deleted?: boolean;
    is_bot?: boolean;
    is_app_user?: boolean;
    profile?: {
      display_name?: string;
      display_name_normalized?: string;
      real_name?: string;
      real_name_normalized?: string;
      email?: string;
    };
  }>;
  response_metadata?: {
    next_cursor?: string;
  };
};

type SlackConversationsListResponse = {
  channels: Array<{
    id: string;
    name?: string;
    name_normalized?: string;
    is_channel?: boolean;
    is_group?: boolean;
    is_im?: boolean;
    is_mpim?: boolean;
    is_private?: boolean;
    is_member?: boolean;
    is_open?: boolean;
    user?: string;
    members?: string[];
  }>;
  response_metadata?: {
    next_cursor?: string;
  };
};

export async function readSlackWorkspaceSnapshot(): Promise<SlackWorkspaceSnapshot> {
  const [credential, users, conversations] = await Promise.all([
    getSlackDesktopCredential(),
    readAllSlackUsers(),
    readAllSlackConversations(),
  ]);
  const usersWithSelf = users.map((user) => ({
    ...user,
    isSelf: user.id === credential.userId,
  }));

  return {
    teamId: credential.teamId,
    teamName: credential.teamName,
    teamDomain: credential.teamDomain,
    teamUrl: credential.teamUrl,
    selfUserId: credential.userId,
    users: usersWithSelf,
    conversations,
  };
}

async function readAllSlackUsers(): Promise<SlackUser[]> {
  const users: SlackUser[] = [];
  let cursor: string | undefined;

  do {
    const response = await callSlackDesktopApi<SlackUsersListResponse>("users.list", {
      limit: 200,
      cursor,
    });

    users.push(
      ...response.members.map((member) => ({
        id: member.id,
        handle: member.name ?? member.id,
        displayName:
          member.profile?.display_name_normalized ||
          member.profile?.display_name ||
          member.profile?.real_name_normalized ||
          member.profile?.real_name ||
          member.real_name ||
          member.name ||
          member.id,
        realName:
          member.profile?.real_name_normalized ||
          member.profile?.real_name ||
          member.real_name ||
          "",
        email: member.profile?.email,
        isBot: Boolean(member.is_bot || member.is_app_user),
        deleted: Boolean(member.deleted),
        isSelf: false,
      })),
    );

    cursor = response.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return users;
}

async function readAllSlackConversations(): Promise<SlackConversation[]> {
  const conversations: SlackConversation[] = [];
  let cursor: string | undefined;

  do {
    const response = await callSlackDesktopApi<SlackConversationsListResponse>(
      "conversations.list",
      {
        types: "public_channel,private_channel,im,mpim",
        exclude_archived: true,
        limit: 200,
        cursor,
      },
    );

    conversations.push(
      ...response.channels.map((channel) => ({
        id: channel.id,
        name: channel.name ?? channel.id,
        normalizedName: channel.name_normalized || channel.name || channel.id,
        kind: (
          channel.is_im ? "dm" : channel.is_mpim ? "mpdm" : "channel"
        ) as SlackConversation["kind"],
        isPrivate: Boolean(channel.is_private || channel.is_group || channel.is_mpim),
        isMember: Boolean(channel.is_member || channel.is_im || channel.is_mpim),
        userId: channel.user,
        memberIds: Array.isArray(channel.members) ? channel.members : [],
        isOpen: Boolean(channel.is_open),
      })),
    );

    cursor = response.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return conversations;
}

export function listChannels(
  snapshot: SlackWorkspaceSnapshot,
  limit: number,
): ChannelListItem[] {
  return snapshot.conversations
    .filter((conversation) => conversation.kind === "channel" && conversation.isMember)
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, limit)
    .map((conversation) => ({
      id: conversation.id,
      name: conversation.name,
      visibility: conversation.isPrivate ? "private" : "public",
    }));
}

export function searchChannels(
  snapshot: SlackWorkspaceSnapshot,
  query: string,
  limit: number,
): ChannelListItem[] {
  const queryTokens = tokenizeSearchQuery(query);

  return snapshot.conversations
    .filter((conversation) => conversation.kind === "channel" && conversation.isMember)
    .filter((conversation) =>
      matchesSearchTokens(
        [conversation.name, conversation.normalizedName],
        queryTokens,
      ),
    )
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, limit)
    .map((conversation) => ({
      id: conversation.id,
      name: conversation.name,
      visibility: conversation.isPrivate ? "private" : "public",
    }));
}

export function listDirectMessages(
  snapshot: SlackWorkspaceSnapshot,
  limit: number,
): DirectMessageListItem[] {
  type ExistingDirectMessage = {
    userId: string;
    displayName: string;
    handle: string;
    conversationId: string;
    isBot: boolean;
    deleted: boolean;
    isSelf: boolean;
  };

  return snapshot.conversations
    .filter((conversation) => conversation.kind === "dm")
    .map((conversation) => {
      const user = snapshot.users.find((candidate) => candidate.id === conversation.userId);
      return user
        ? {
            userId: user.id,
            displayName: user.displayName,
            handle: user.handle,
            conversationId: conversation.id,
            isBot: user.isBot,
            deleted: user.deleted,
            isSelf: user.isSelf,
          }
        : null;
    })
    .filter((item): item is ExistingDirectMessage => item !== null)
    .filter(
      (item) =>
        !item.isBot &&
        !item.deleted &&
        !item.isSelf &&
        item.userId !== "USLACKBOT",
    )
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
    .slice(0, limit)
    .map(({ isBot: _isBot, deleted: _deleted, isSelf: _isSelf, ...item }) => item);
}

export function searchUsers(
  snapshot: SlackWorkspaceSnapshot,
  query: string,
  limit: number,
): DirectMessageListItem[] {
  const queryTokens = tokenizeSearchQuery(query);

  return snapshot.users
    .filter((user) => !user.isBot && !user.deleted && !user.isSelf)
    .filter((user) => {
      const haystacks = [user.displayName, user.realName, user.handle, user.email ?? ""];
      return matchesSearchTokens(haystacks, queryTokens);
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
    .slice(0, limit)
    .map((user) => ({
      userId: user.id,
      displayName: user.displayName,
      handle: user.handle,
      conversationId: findExistingDirectMessage(snapshot, user.id)?.id,
    }));
}

export function resolveChannel(
  snapshot: SlackWorkspaceSnapshot,
  input: {
    channel?: string;
    channelId?: string;
  },
): SlackConversation {
  const provided = [input.channel, input.channelId].filter(Boolean);

  if (provided.length !== 1) {
    throw new Error("Provide exactly one of --channel or --channel-id.");
  }

  if (input.channelId) {
    const match = snapshot.conversations.find(
      (conversation) =>
        conversation.kind === "channel" &&
        conversation.isMember &&
        conversation.id === input.channelId,
    );

    if (!match) {
      throw new Error(`No channel found for ID ${input.channelId}.`);
    }

    return match;
  }

  const requestedName = normalizeChannelName(input.channel!);
  const matches = snapshot.conversations.filter(
    (conversation) =>
      conversation.kind === "channel" &&
      conversation.isMember &&
      normalizeChannelName(conversation.name) === requestedName,
  );

  if (matches.length === 0) {
    throw new Error(`No channel found matching "${input.channel}".`);
  }

  if (matches.length > 1) {
    throw new Error(`Multiple channels matched "${input.channel}". Use --channel-id.`);
  }

  return matches[0];
}

export function resolveUser(
  snapshot: SlackWorkspaceSnapshot,
  input: {
    user?: string;
    userId?: string;
    handle?: string;
  },
): SlackUser {
  const selectors = [input.user, input.userId, input.handle].filter(Boolean);

  if (selectors.length !== 1) {
    throw new Error("Provide exactly one of --user, --user-id, or --handle.");
  }

  const candidates = snapshot.users.filter(
    (user) => !user.isBot && !user.deleted && !user.isSelf,
  );

  if (input.userId) {
    const match = candidates.find((user) => user.id === input.userId);

    if (!match) {
      throw new Error(`No user found for ID ${input.userId}.`);
    }

    return match;
  }

  if (input.handle) {
    const requestedHandle = normalizeHandle(input.handle);
    const matches = candidates.filter(
      (user) => normalizeHandle(user.handle) === requestedHandle,
    );
    const match = selectSingleUserMatch(snapshot, matches);

    if (!match) {
      throw new Error(`No user found matching handle "${input.handle}".`);
    }

    return match;
  }

  const requestedName = normalizeQuery(input.user!);
  const matches = candidates.filter((user) => {
    const names = [user.displayName, user.realName].map(normalizeQuery);
    return names.includes(requestedName);
  });
  const match = selectSingleUserMatch(snapshot, matches);

  if (!match) {
    throw new Error(`No user found matching "${input.user}".`);
  }

  return match;
}

export function findExistingDirectMessage(
  snapshot: SlackWorkspaceSnapshot,
  userId: string,
): SlackConversation | undefined {
  return snapshot.conversations.find(
    (conversation) => conversation.kind === "dm" && conversation.userId === userId,
  );
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function tokenizeSearchQuery(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function matchesSearchTokens(values: string[], tokens: string[]): boolean {
  if (tokens.length === 0) {
    return false;
  }

  const normalizedValues = values.map((value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim(),
  );

  return normalizedValues.some((value) => tokens.every((token) => value.includes(token)));
}

function normalizeChannelName(value: string): string {
  return normalizeQuery(value.startsWith("#") ? value.slice(1) : value);
}

function normalizeHandle(value: string): string {
  return normalizeQuery(value.startsWith("@") ? value.slice(1) : value);
}

function selectSingleUserMatch(
  snapshot: SlackWorkspaceSnapshot,
  matches: SlackUser[],
): SlackUser | undefined {
  if (matches.length <= 1) {
    return matches[0];
  }

  const matchesWithExistingDm = matches.filter((user) =>
    Boolean(findExistingDirectMessage(snapshot, user.id)),
  );

  if (matchesWithExistingDm.length === 1) {
    return matchesWithExistingDm[0];
  }

  const candidatesLabel = matches
    .map((user) => `${user.displayName} (@${user.handle}, ${user.id})`)
    .join(", ");

  throw new Error(`Multiple users matched: ${candidatesLabel}. Use --user-id.`);
}

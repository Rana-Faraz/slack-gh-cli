import { getSlackLandingPage, withSlackBrowserContext } from "./browser-session.js";
import type {
  ChannelListItem,
  DirectMessageListItem,
  SlackConversation,
  SlackUser,
  SlackWorkspaceSnapshot,
} from "./types.js";

type RawSlackState = {
  channels: Record<string, any>;
  members: Record<string, any>;
};

export async function readSlackWorkspaceSnapshot(): Promise<SlackWorkspaceSnapshot> {
  return await withSlackBrowserContext(
    {
      headless: true,
      useProfileCopy: true,
    },
    async (context) => {
      const page = await getSlackLandingPage(context);
      await page.waitForTimeout(3_000);

      return await page.evaluate(async () => {
        const localConfig = JSON.parse(localStorage.getItem("localConfig_v2") ?? "null");
        const lastActiveTeamId = localConfig?.lastActiveTeamId;
        const team = lastActiveTeamId ? localConfig?.teams?.[lastActiveTeamId] : null;

        const state = await new Promise<RawSlackState>((resolve, reject) => {
          const req = indexedDB.open("reduxPersistence");

          req.onerror = () => reject(new Error(String(req.error)));
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction("reduxPersistenceStore", "readonly");
            const store = tx.objectStore("reduxPersistenceStore");
            const key = `persist:slack-client-${team?.id}-${team?.user_id}`;
            const getReq = store.get(key);

            getReq.onerror = () => {
              db.close();
              reject(new Error(String(getReq.error)));
            };

            getReq.onsuccess = () => {
              db.close();
              resolve(getReq.result as RawSlackState);
            };
          };
        });

        const users = Object.values(state.members ?? {}).map((member: any) => ({
          id: member.id,
          handle: member.name,
          displayName:
            member.profile?.display_name_normalized ||
            member.profile?.display_name ||
            member.real_name_normalized ||
            member.real_name ||
            member.name,
          realName:
            member.real_name_normalized || member.real_name || member.profile?.real_name || "",
          email: member.profile?.email,
          isBot: Boolean(member.is_bot),
          deleted: Boolean(member.deleted),
          isSelf: Boolean(member.is_self),
        }));

        const conversations = Object.values(state.channels ?? {}).map((channel: any) => ({
          id: channel.id,
          name: channel.name,
          normalizedName: channel.name_normalized || channel.name || "",
          kind: (
            channel.is_im ? "dm" : channel.is_mpim ? "mpdm" : "channel"
          ) as SlackConversation["kind"],
          isPrivate: Boolean(channel.is_private || channel.is_group || channel.is_mpim),
          isMember: Boolean(channel.is_member),
          userId: channel.user,
          memberIds: Array.isArray(channel.members) ? channel.members : [],
          isOpen: Boolean(channel.is_open),
        }));

        return {
          teamId: team?.id,
          teamName: team?.name,
          teamDomain: team?.domain,
          teamUrl: team?.url,
          selfUserId: team?.user_id,
          users,
          conversations,
        };
      });
    },
  );
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
    const match = candidates.find(
      (user) => normalizeHandle(user.handle) === requestedHandle,
    );

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

  if (matches.length === 0) {
    throw new Error(`No user found matching "${input.user}".`);
  }

  if (matches.length > 1) {
    const candidatesLabel = matches
      .map((user) => `${user.displayName} (@${user.handle})`)
      .join(", ");
    throw new Error(
      `Multiple users matched "${input.user}": ${candidatesLabel}. Use --handle or --user-id.`,
    );
  }

  return matches[0];
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

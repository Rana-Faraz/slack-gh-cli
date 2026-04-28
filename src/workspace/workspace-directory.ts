import type {
  ChannelListItem,
  ChannelSelector,
  Conversation,
  DirectMessageListItem,
  UserSelector,
  WorkspaceSnapshot,
  WorkspaceUser,
} from "../domain/workspace.js";
import {
  matchesSearchTokens,
  normalizeChannelName,
  normalizeHandle,
  normalizeHumanText,
  tokenizeSearchQuery,
} from "../utils/text-match.js";

/**
 * Query interface over a workspace snapshot.
 */
export class WorkspaceDirectory {
  constructor(private readonly snapshot: WorkspaceSnapshot) {}

  /**
   * Lists member channels sorted by display name.
   */
  listChannels(limit: number): ChannelListItem[] {
    return this.channelConversations()
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, limit)
      .map(toChannelListItem);
  }

  /**
   * Searches member channels by tokenized channel names.
   */
  searchChannels(query: string, limit: number): ChannelListItem[] {
    const queryTokens = tokenizeSearchQuery(query);

    return this.channelConversations()
      .filter((conversation) =>
        matchesSearchTokens(
          [conversation.name, conversation.normalizedName],
          queryTokens,
        ),
      )
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, limit)
      .map(toChannelListItem);
  }

  /**
   * Lists existing direct messages for messageable people.
   */
  listDirectMessages(limit: number): DirectMessageListItem[] {
    return this.snapshot.conversations
      .filter((conversation) => conversation.kind === "dm")
      .map((conversation) => this.directMessageItem(conversation))
      .filter((item): item is DirectMessageListItem => item !== null)
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .slice(0, limit);
  }

  /**
   * Searches messageable people by name, handle, and email.
   */
  searchUsers(query: string, limit: number): DirectMessageListItem[] {
    const queryTokens = tokenizeSearchQuery(query);

    return this.messageableUsers()
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
        conversationId: this.findDirectMessage(user.id)?.id,
      }));
  }

  /**
   * Resolves channel command selectors to one concrete conversation.
   */
  resolveChannel(input: ChannelSelector): Conversation {
    const provided = [input.channel, input.channelId].filter(Boolean);

    if (provided.length !== 1) {
      throw new Error("Provide exactly one of --channel or --channel-id.");
    }

    if (input.channelId) {
      const match = this.channelConversations().find(
        (conversation) => conversation.id === input.channelId,
      );

      if (!match) {
        throw new Error(`No channel found for ID ${input.channelId}.`);
      }

      return match;
    }

    const requestedName = normalizeChannelName(input.channel!);
    const matches = this.channelConversations().filter(
      (conversation) => normalizeChannelName(conversation.name) === requestedName,
    );

    if (matches.length === 0) {
      throw new Error(`No channel found matching "${input.channel}".`);
    }

    if (matches.length > 1) {
      throw new Error(`Multiple channels matched "${input.channel}". Use --channel-id.`);
    }

    return matches[0];
  }

  /**
   * Resolves user command selectors to one concrete user.
   */
  resolveUser(input: UserSelector): WorkspaceUser {
    const selectors = [input.user, input.userId, input.handle].filter(Boolean);

    if (selectors.length !== 1) {
      throw new Error("Provide exactly one of --user, --user-id, or --handle.");
    }

    if (input.userId) {
      const match = this.messageableUsers().find((user) => user.id === input.userId);

      if (!match) {
        throw new Error(`No user found for ID ${input.userId}.`);
      }

      return match;
    }

    if (input.handle) {
      const requestedHandle = normalizeHandle(input.handle);
      const matches = this.messageableUsers().filter(
        (user) => normalizeHandle(user.handle) === requestedHandle,
      );
      const match = this.selectSingleUserMatch(matches);

      if (!match) {
        throw new Error(`No user found matching handle "${input.handle}".`);
      }

      return match;
    }

    const requestedName = normalizeHumanText(input.user!);
    const matches = this.messageableUsers().filter((user) => {
      const names = [user.displayName, user.realName].map(normalizeHumanText);
      return names.includes(requestedName);
    });
    const match = this.selectSingleUserMatch(matches);

    if (!match) {
      throw new Error(`No user found matching "${input.user}".`);
    }

    return match;
  }

  /**
   * Finds an existing one-to-one conversation for a user.
   */
  findDirectMessage(userId: string): Conversation | undefined {
    return this.snapshot.conversations.find(
      (conversation) => conversation.kind === "dm" && conversation.userId === userId,
    );
  }

  private channelConversations(): Conversation[] {
    return this.snapshot.conversations.filter(
      (conversation) => conversation.kind === "channel" && conversation.isMember,
    );
  }

  private messageableUsers(): WorkspaceUser[] {
    return this.snapshot.users.filter(
      (user) => !user.isBot && !user.deleted && !user.isSelf,
    );
  }

  private directMessageItem(conversation: Conversation): DirectMessageListItem | null {
    const user = this.snapshot.users.find((candidate) => candidate.id === conversation.userId);

    if (!user || user.isBot || user.deleted || user.isSelf || user.id === "USLACKBOT") {
      return null;
    }

    return {
      userId: user.id,
      displayName: user.displayName,
      handle: user.handle,
      conversationId: conversation.id,
    };
  }

  private selectSingleUserMatch(matches: WorkspaceUser[]): WorkspaceUser | undefined {
    if (matches.length <= 1) {
      return matches[0];
    }

    const matchesWithExistingDm = matches.filter((user) =>
      Boolean(this.findDirectMessage(user.id)),
    );

    if (matchesWithExistingDm.length === 1) {
      return matchesWithExistingDm[0];
    }

    const candidatesLabel = matches
      .map((user) => `${user.displayName} (@${user.handle}, ${user.id})`)
      .join(", ");

    throw new Error(`Multiple users matched: ${candidatesLabel}. Use --user-id.`);
  }
}

function toChannelListItem(conversation: Conversation): ChannelListItem {
  return {
    id: conversation.id,
    name: conversation.name,
    visibility: conversation.isPrivate ? "private" : "public",
  };
}

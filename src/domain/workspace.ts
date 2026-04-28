/**
 * A human or bot account visible in a workspace snapshot.
 */
export type WorkspaceUser = {
  id: string;
  handle: string;
  displayName: string;
  realName: string;
  email?: string;
  isBot: boolean;
  deleted: boolean;
  isSelf: boolean;
};

/**
 * A Slack conversation known to the selected workspace.
 */
export type Conversation = {
  id: string;
  name: string;
  normalizedName: string;
  kind: "channel" | "dm" | "mpdm";
  isPrivate: boolean;
  isMember: boolean;
  userId?: string;
  memberIds: string[];
  isOpen: boolean;
};

/**
 * Command-time view of the selected workspace.
 */
export type WorkspaceSnapshot = {
  teamId: string;
  teamName: string;
  teamDomain?: string;
  teamUrl?: string;
  selfUserId?: string;
  users: WorkspaceUser[];
  conversations: Conversation[];
};

/**
 * Public channel row shown by list and search commands.
 */
export type ChannelListItem = {
  id: string;
  name: string;
  visibility: "public" | "private";
};

/**
 * Public direct-message row shown by list and search commands.
 */
export type DirectMessageListItem = {
  userId: string;
  displayName: string;
  handle: string;
  conversationId?: string;
};

/**
 * Selector accepted by channel commands.
 */
export type ChannelSelector = {
  channel?: string;
  channelId?: string;
};

/**
 * Selector accepted by direct-message commands.
 */
export type UserSelector = {
  user?: string;
  userId?: string;
  handle?: string;
};

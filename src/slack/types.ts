export type SlackUser = {
  id: string;
  handle: string;
  displayName: string;
  realName: string;
  email?: string;
  isBot: boolean;
  deleted: boolean;
  isSelf: boolean;
};

export type SlackConversation = {
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

export type SlackWorkspaceSnapshot = {
  teamId: string;
  teamName: string;
  teamDomain?: string;
  teamUrl?: string;
  selfUserId?: string;
  users: SlackUser[];
  conversations: SlackConversation[];
};

export type ChannelListItem = {
  id: string;
  name: string;
  visibility: "public" | "private";
};

export type DirectMessageListItem = {
  userId: string;
  displayName: string;
  handle: string;
  conversationId?: string;
};

export type ChannelSendOptions = {
  channel?: string;
  channelId?: string;
  message?: string;
  stdin?: boolean;
  dryRun?: boolean;
  workspace?: string;
};

export type DmSendOptions = {
  user?: string;
  userId?: string;
  handle?: string;
  message?: string;
  stdin?: boolean;
  dryRun?: boolean;
  workspace?: string;
};

export type WorkspaceScopedOptions = {
  workspace?: string;
};

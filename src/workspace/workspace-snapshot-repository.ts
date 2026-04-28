import type { WorkspaceCredential, WorkspaceRequestParams } from "../session/types.js";
import {
  getWorkspaceCredential,
  requestWorkspace,
} from "../session/default-desktop-session.js";
import type {
  Conversation,
  WorkspaceSnapshot,
  WorkspaceUser,
} from "../domain/workspace.js";

type UsersListResponse = {
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

type ConversationsListResponse = {
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

/**
 * Session interface needed to load a workspace snapshot.
 */
export type WorkspaceSession = {
  getCredential(): Promise<WorkspaceCredential>;
  request<T>(method: string, params: WorkspaceRequestParams): Promise<T>;
};

const defaultWorkspaceSession: WorkspaceSession = {
  getCredential: async () => await getWorkspaceCredential(),
  request: async (method, params) => await requestWorkspace(method, params),
};

/**
 * Loads workspace snapshots through the selected desktop session.
 */
export class WorkspaceSnapshotRepository {
  constructor(private readonly session: WorkspaceSession = defaultWorkspaceSession) {}

  /**
   * Reads users and conversations for the selected workspace.
   */
  async read(): Promise<WorkspaceSnapshot> {
    const [credential, users, conversations] = await Promise.all([
      this.session.getCredential(),
      this.readAllUsers(),
      this.readAllConversations(),
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

  private async readAllUsers(): Promise<WorkspaceUser[]> {
    const users: WorkspaceUser[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.session.request<UsersListResponse>("users.list", {
        limit: 200,
        cursor,
      });

      users.push(...response.members.map(mapUser));
      cursor = response.response_metadata?.next_cursor || undefined;
    } while (cursor);

    return users;
  }

  private async readAllConversations(): Promise<Conversation[]> {
    const conversations: Conversation[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.session.request<ConversationsListResponse>(
        "conversations.list",
        {
          types: "public_channel,private_channel,im,mpim",
          exclude_archived: true,
          limit: 200,
          cursor,
        },
      );

      conversations.push(...response.channels.map(mapConversation));
      cursor = response.response_metadata?.next_cursor || undefined;
    } while (cursor);

    return conversations;
  }
}

function mapUser(member: UsersListResponse["members"][number]): WorkspaceUser {
  return {
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
  };
}

function mapConversation(
  channel: ConversationsListResponse["channels"][number],
): Conversation {
  return {
    id: channel.id,
    name: channel.name ?? channel.id,
    normalizedName: channel.name_normalized || channel.name || channel.id,
    kind: channel.is_im ? "dm" : channel.is_mpim ? "mpdm" : "channel",
    isPrivate: Boolean(channel.is_private || channel.is_group || channel.is_mpim),
    isMember: Boolean(channel.is_member || channel.is_im || channel.is_mpim),
    userId: channel.user,
    memberIds: Array.isArray(channel.members) ? channel.members : [],
    isOpen: Boolean(channel.is_open),
  };
}

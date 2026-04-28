import {
  readSlackWorkspaceSnapshot,
  searchChannels,
  searchUsers,
} from "./state.js";
import type { ChannelListItem, DirectMessageListItem } from "./types.js";

export async function liveSearchChannels(
  query: string,
  limit: number,
): Promise<ChannelListItem[]> {
  return searchChannels(await readSlackWorkspaceSnapshot(), query, limit);
}

export async function liveSearchUsers(
  query: string,
  limit: number,
): Promise<DirectMessageListItem[]> {
  return searchUsers(await readSlackWorkspaceSnapshot(), query, limit);
}

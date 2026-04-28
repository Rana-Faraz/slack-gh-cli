import type {
  ChannelListItem,
  DirectMessageListItem,
  WorkspaceSnapshot,
} from "../domain/workspace.js";
import { WorkspaceDirectory } from "./workspace-directory.js";
import { WorkspaceSnapshotRepository } from "./workspace-snapshot-repository.js";

const snapshots = new WorkspaceSnapshotRepository();

/**
 * Reads the snapshot for the workspace selected by the desktop session.
 */
export async function readCurrentWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  return await snapshots.read();
}

/**
 * Lists channels for the selected workspace.
 */
export async function listCurrentChannels(limit: number): Promise<ChannelListItem[]> {
  return new WorkspaceDirectory(await readCurrentWorkspaceSnapshot()).listChannels(limit);
}

/**
 * Searches channels for the selected workspace.
 */
export async function searchCurrentChannels(
  query: string,
  limit: number,
): Promise<ChannelListItem[]> {
  return new WorkspaceDirectory(await readCurrentWorkspaceSnapshot()).searchChannels(
    query,
    limit,
  );
}

/**
 * Lists direct messages for the selected workspace.
 */
export async function listCurrentDirectMessages(
  limit: number,
): Promise<DirectMessageListItem[]> {
  return new WorkspaceDirectory(await readCurrentWorkspaceSnapshot())
    .listDirectMessages(limit);
}

/**
 * Searches messageable users for the selected workspace.
 */
export async function searchCurrentUsers(
  query: string,
  limit: number,
): Promise<DirectMessageListItem[]> {
  return new WorkspaceDirectory(await readCurrentWorkspaceSnapshot()).searchUsers(
    query,
    limit,
  );
}

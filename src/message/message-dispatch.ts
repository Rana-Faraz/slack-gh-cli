import type {
  ChannelSendOptions,
  DirectMessageSendOptions,
  MessageLogger,
} from "../domain/message.js";
import type { WorkspaceSnapshot } from "../domain/workspace.js";
import { WorkspaceDirectory } from "../workspace/workspace-directory.js";
import { WorkspaceSnapshotRepository } from "../workspace/workspace-snapshot-repository.js";
import { ConversationGateway } from "./conversation-gateway.js";
import { MessageInputResolver } from "./message-input.js";
import { MessageRenderer } from "./message-renderer.js";

/**
 * Snapshot interface used by Message Dispatch.
 */
export type SnapshotReader = {
  read(): Promise<WorkspaceSnapshot>;
};

/**
 * Conversation write interface used by Message Dispatch.
 */
export type ConversationWriter = {
  openDirectMessage(userId: string): Promise<string>;
  postMessage(conversationId: string, text: string): Promise<void>;
};

/**
 * Coordinates message input, destination resolution, rendering, and posting.
 */
export class MessageDispatch {
  constructor(
    private readonly snapshots: SnapshotReader = new WorkspaceSnapshotRepository(),
    private readonly conversations: ConversationWriter = new ConversationGateway(),
    private readonly inputResolver = new MessageInputResolver(),
    private readonly renderer = new MessageRenderer(),
    private readonly logger: MessageLogger = console,
  ) {}

  /**
   * Sends a message to a channel or prints the dry-run preview.
   */
  async sendChannel(options: ChannelSendOptions): Promise<void> {
    const snapshot = await this.snapshots.read();
    const directory = new WorkspaceDirectory(snapshot);
    const channel = directory.resolveChannel(options);
    const rendered = await this.renderMessage(options, snapshot);

    if (options.dryRun) {
      this.logger.log(`Would send to #${channel.name}`);
      this.logger.log(rendered);
      return;
    }

    await this.conversations.postMessage(channel.id, rendered);
    this.logger.log(`Sent to #${channel.name}`);
  }

  /**
   * Sends a direct message or prints the dry-run preview.
   */
  async sendDirectMessage(options: DirectMessageSendOptions): Promise<void> {
    const snapshot = await this.snapshots.read();
    const directory = new WorkspaceDirectory(snapshot);
    const user = directory.resolveUser(options);
    const rendered = await this.renderMessage(options, snapshot);
    const existingDm = directory.findDirectMessage(user.id);

    if (options.dryRun) {
      this.logger.log(`Would send to ${user.displayName} (@${user.handle})`);
      this.logger.log(rendered);
      return;
    }

    const conversationId =
      existingDm?.id ?? (await this.conversations.openDirectMessage(user.id));
    await this.conversations.postMessage(conversationId, rendered);
    this.logger.log(`Sent to ${user.displayName} (@${user.handle})`);
  }

  private async renderMessage(
    options: ChannelSendOptions | DirectMessageSendOptions,
    snapshot: WorkspaceSnapshot,
  ): Promise<string> {
    return this.renderer.render(await this.inputResolver.resolve(options), snapshot.users);
  }
}

import { requestWorkspace } from "../session/default-desktop-session.js";

type ConversationsOpenResponse = {
  channel: {
    id: string;
  };
};

/**
 * Writes messages and opens conversations through the selected workspace.
 */
export class ConversationGateway {
  /**
   * Opens or returns a direct-message conversation for a user.
   */
  async openDirectMessage(userId: string): Promise<string> {
    const response = await requestWorkspace<ConversationsOpenResponse>(
      "conversations.open",
      {
        users: userId,
        return_im: true,
      },
    );

    return response.channel.id;
  }

  /**
   * Posts Slack-compatible message text to a conversation.
   */
  async postMessage(conversationId: string, text: string): Promise<void> {
    await requestWorkspace("chat.postMessage", {
      channel: conversationId,
      text,
      mrkdwn: true,
    });
  }
}

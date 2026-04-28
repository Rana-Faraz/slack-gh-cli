import type { WorkspaceUser } from "../domain/workspace.js";

/**
 * Renders command markdown into Slack-compatible message markup.
 */
export class MessageRenderer {
  /**
   * Preserves code spans, translates links and bold, and resolves @mentions.
   */
  render(message: string, users: WorkspaceUser[] = []): string {
    const codeBlocks: string[] = [];
    const inlineCode: string[] = [];
    const boldSegments: string[] = [];

    let output = message.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `@@CODE_BLOCK_${codeBlocks.length - 1}@@`;
    });

    output = output.replace(/`[^`\n]+`/g, (match) => {
      inlineCode.push(match);
      return `@@INLINE_CODE_${inlineCode.length - 1}@@`;
    });

    output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "<$2|$1>");
    output = output.replace(/\*\*([^*\n]+)\*\*/g, (_, text) => {
      boldSegments.push(`*${text}*`);
      return `@@BOLD_${boldSegments.length - 1}@@`;
    });
    output = output.replace(/__([^_\n]+)__/g, (_, text) => {
      boldSegments.push(`*${text}*`);
      return `@@BOLD_${boldSegments.length - 1}@@`;
    });
    output = output.replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,!?:;])/g, "$1_$2_");
    output = output.replace(/(^|[^A-Za-z0-9._-])@([A-Za-z0-9._-]+)/g, (match, prefix, handle) => {
      const user = this.findUserByHandle(users, handle);
      return user ? `${prefix}<@${user.id}>` : match;
    });

    output = output.replace(/@@INLINE_CODE_(\d+)@@/g, (_, index) => inlineCode[Number(index)]);
    output = output.replace(/@@BOLD_(\d+)@@/g, (_, index) => boldSegments[Number(index)]);
    output = output.replace(/@@CODE_BLOCK_(\d+)@@/g, (_, index) => codeBlocks[Number(index)]);

    return output;
  }

  private findUserByHandle(
    users: WorkspaceUser[],
    handle: string,
  ): WorkspaceUser | undefined {
    const normalizedHandle = handle.toLowerCase();
    return users.find((user) => user.handle.toLowerCase() === normalizedHandle);
  }
}

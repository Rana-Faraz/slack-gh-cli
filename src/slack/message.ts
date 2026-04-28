import { stdin } from "node:process";
import type { SlackUser } from "./types.js";

export async function resolveMessageInput(input: {
  message?: string;
  stdin?: boolean;
  inputStream?: AsyncIterable<Buffer | string>;
}): Promise<string> {
  if (input.message && input.message.length > 0) {
    return input.message;
  }

  if (input.stdin || !stdin.isTTY) {
    const inputStream = input.inputStream ?? stdin;
    const chunks: Buffer[] = [];

    for await (const chunk of inputStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const text = Buffer.concat(chunks).toString("utf8").trimEnd();

    if (text.length > 0) {
      return text;
    }
  }

  throw new Error("Provide --message or pipe message text on stdin.");
}

export function translateMarkdownToSlack(
  message: string,
  users: SlackUser[] = [],
): string {
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
    const user = findUserByHandle(users, handle);
    return user ? `${prefix}<@${user.id}>` : match;
  });

  output = output.replace(/@@INLINE_CODE_(\d+)@@/g, (_, index) => inlineCode[Number(index)]);
  output = output.replace(/@@BOLD_(\d+)@@/g, (_, index) => boldSegments[Number(index)]);
  output = output.replace(/@@CODE_BLOCK_(\d+)@@/g, (_, index) => codeBlocks[Number(index)]);

  return output;
}

function findUserByHandle(users: SlackUser[], handle: string): SlackUser | undefined {
  const normalizedHandle = handle.toLowerCase();
  return users.find((user) => user.handle.toLowerCase() === normalizedHandle);
}

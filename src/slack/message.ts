import { stdin } from "node:process";
import { escapeHtml } from "../lib/utils.js";
import type { SlackUser } from "./types.js";

export async function resolveMessageInput(input: {
  message?: string;
  stdin?: boolean;
}): Promise<string> {
  if (input.message && input.message.length > 0) {
    return input.message;
  }

  if (input.stdin || !stdin.isTTY) {
    const chunks: Buffer[] = [];

    for await (const chunk of stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const text = Buffer.concat(chunks).toString("utf8").trimEnd();

    if (text.length > 0) {
      return text;
    }
  }

  throw new Error("Provide --message or pipe message text on stdin.");
}

export function translateMarkdownToSlack(message: string): string {
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

  output = output.replace(/@@INLINE_CODE_(\d+)@@/g, (_, index) => inlineCode[Number(index)]);
  output = output.replace(/@@BOLD_(\d+)@@/g, (_, index) => boldSegments[Number(index)]);
  output = output.replace(/@@CODE_BLOCK_(\d+)@@/g, (_, index) => codeBlocks[Number(index)]);

  return output;
}

export function renderMarkdownToSlackHtml(
  message: string,
  users: SlackUser[] = [],
): string {
  const lines = message.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];

    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];

      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(`<li>${formatInlineMarkdown(lines[index].slice(2), users)}</li>`);
        index += 1;
      }

      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    const paragraphLines: string[] = [];

    while (
      index < lines.length &&
      lines[index].trim().length > 0 &&
      !lines[index].startsWith("- ") &&
      !lines[index].startsWith("```")
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push(`<p>${paragraphLines.map((line) => formatInlineMarkdown(line, users)).join("<br>")}</p>`);
  }

  return blocks.join("");
}

function formatInlineMarkdown(text: string, users: SlackUser[]): string {
  let index = 0;
  let output = "";

  while (index < text.length) {
    const remaining = text.slice(index);

    const linkMatch = remaining.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/);

    if (linkMatch) {
      output += `<a href="${escapeAttribute(linkMatch[2])}">${escapeHtml(linkMatch[1])}</a>`;
      index += linkMatch[0].length;
      continue;
    }

    const inlineCodeMatch = remaining.match(/^`([^`\n]+)`/);

    if (inlineCodeMatch) {
      output += `<code>${escapeHtml(inlineCodeMatch[1])}</code>`;
      index += inlineCodeMatch[0].length;
      continue;
    }

    const boldMatch = remaining.match(/^(?:\*\*([^*\n]+)\*\*|__([^_\n]+)__)/);

    if (boldMatch) {
      const textValue = boldMatch[1] ?? boldMatch[2] ?? "";
      output += `<strong>${escapeHtml(textValue)}</strong>`;
      index += boldMatch[0].length;
      continue;
    }

    const italicMatch = remaining.match(/^(?:\*([^*\n]+)\*|_([^_\n]+)_)/);

    if (italicMatch) {
      const textValue = italicMatch[1] ?? italicMatch[2] ?? "";
      output += `<em>${escapeHtml(textValue)}</em>`;
      index += italicMatch[0].length;
      continue;
    }

    const mentionMatch = remaining.match(/^@([a-z0-9._-]+)/i);

    if (mentionMatch) {
      const user = findUserByHandle(users, mentionMatch[1]);

      if (user) {
        output += renderMentionHtml(user);
        index += mentionMatch[0].length;
        continue;
      }
    }

    output += escapeHtml(text[index]);
    index += 1;
  }

  return output;
}

function findUserByHandle(users: SlackUser[], handle: string): SlackUser | undefined {
  const normalizedHandle = handle.toLowerCase();
  return users.find((user) => user.handle.toLowerCase() === normalizedHandle);
}

function renderMentionHtml(user: SlackUser): string {
  const label = `@${user.displayName}`;
  return `<ts-mention data-id="${escapeAttribute(user.id)}" data-label="${escapeAttribute(label)}" spellcheck="false" class="c-member_slug c-member_slug--link ts_tip_texty" dir="ltr">${escapeHtml(label)}</ts-mention>`;
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

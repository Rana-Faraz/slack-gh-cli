import { stdin } from "node:process";
import type { MessageInputOptions } from "../domain/message.js";

/**
 * Resolves message text from an explicit option or standard input.
 */
export class MessageInputResolver {
  /**
   * Reads message text and raises a CLI-friendly error when none is available.
   */
  async resolve(input: MessageInputOptions): Promise<string> {
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
}

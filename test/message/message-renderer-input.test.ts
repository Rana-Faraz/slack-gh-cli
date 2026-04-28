import { describe, expect, it } from "vitest";
import { MessageInputResolver } from "../../src/message/message-input.js";
import { MessageRenderer } from "../../src/message/message-renderer.js";
import { users } from "../fixtures/slack.js";

describe("MessageRenderer", () => {
  const renderer = new MessageRenderer();

  it("translates common markdown into Slack mrkdwn", () => {
    expect(
      renderer.render("**ship it** *soon* [docs](https://example.test/docs)"),
    ).toBe("*ship it* _soon_ <https://example.test/docs|docs>");
  });

  it("resolves user handles outside code spans", () => {
    expect(renderer.render("hi @alex.morgan and `@sam.rivera`", users)).toBe(
      "hi <@U_ALEX> and `@sam.rivera`",
    );
  });

  it("preserves fenced code blocks while translating surrounding text", () => {
    const message = [
      "**before**",
      "```",
      "**not bold** @alex.morgan",
      "```",
      "@sam.rivera",
    ].join("\n");

    expect(renderer.render(message, users)).toBe([
      "*before*",
      "```",
      "**not bold** @alex.morgan",
      "```",
      "<@U_SAM>",
    ].join("\n"));
  });

  it("leaves unknown handles unchanged", () => {
    expect(renderer.render("hello @unknown.person", users)).toBe(
      "hello @unknown.person",
    );
  });
});

describe("MessageInputResolver", () => {
  const resolver = new MessageInputResolver();

  it("uses explicit message text first", async () => {
    await expect(
      resolver.resolve({
        inputStream: streamChunks(["ignored"]),
        message: "hello",
        stdin: true,
      }),
    ).resolves.toBe("hello");
  });

  it("reads non-empty piped text and trims trailing newlines", async () => {
    await expect(
      resolver.resolve({
        inputStream: streamChunks(["hello", " world\n"]),
        stdin: true,
      }),
    ).resolves.toBe("hello world");
  });

  it("rejects missing message text", async () => {
    await expect(
      resolver.resolve({
        inputStream: streamChunks(["\n"]),
        stdin: true,
      }),
    ).rejects.toThrow("Provide --message or pipe message text on stdin.");
  });
});

async function* streamChunks(
  chunks: Array<Buffer | string>,
): AsyncIterable<Buffer | string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

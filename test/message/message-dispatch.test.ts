import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageDispatch } from "../../src/message/message-dispatch.js";
import type { WorkspaceSnapshot } from "../../src/domain/workspace.js";
import { makeSnapshot } from "../fixtures/slack.js";

describe("MessageDispatch", () => {
  let logs: string[];
  let postedMessages: Array<{ conversationId: string; text: string }>;
  let openedDirectMessages: string[];

  beforeEach(() => {
    logs = [];
    postedMessages = [];
    openedDirectMessages = [];
  });

  it("prints a channel dry-run without posting", async () => {
    await makeDispatch().sendChannel({
      channel: "general",
      dryRun: true,
      message: "hello @alex.morgan",
    });

    expect(logs).toEqual(["Would send to #general", "hello <@U_ALEX>"]);
    expect(postedMessages).toEqual([]);
  });

  it("posts channel messages to a resolved channel", async () => {
    await makeDispatch().sendChannel({
      channelId: "C_PROJECT",
      message: "**ready**",
    });

    expect(postedMessages).toEqual([
      { conversationId: "C_PROJECT", text: "*ready*" },
    ]);
    expect(logs).toEqual(["Sent to #project-updates"]);
  });

  it("uses an existing DM conversation when available", async () => {
    await makeDispatch().sendDirectMessage({
      handle: "@alex.morgan",
      message: "hello",
    });

    expect(openedDirectMessages).toEqual([]);
    expect(postedMessages).toEqual([{ conversationId: "D_ALEX", text: "hello" }]);
    expect(logs).toEqual(["Sent to Alex Morgan (@alex.morgan)"]);
  });

  it("opens a DM conversation when one does not already exist", async () => {
    await makeDispatch().sendDirectMessage({
      handle: "@sam.rivera",
      message: "hello",
    });

    expect(openedDirectMessages).toEqual(["U_SAM"]);
    expect(postedMessages).toEqual([{ conversationId: "D_SAM", text: "hello" }]);
  });

  it("uses snapshots supplied by callers", async () => {
    const snapshot: WorkspaceSnapshot = makeSnapshot();

    await makeDispatch(snapshot).sendDirectMessage({
      userId: "U_ALEX",
      dryRun: true,
      message: "ping",
    });

    expect(logs).toEqual(["Would send to Alex Morgan (@alex.morgan)", "ping"]);
  });

  function makeDispatch(snapshot = makeSnapshot()): MessageDispatch {
    return new MessageDispatch(
      { read: async () => snapshot },
      {
        openDirectMessage: vi.fn(async (userId: string) => {
          openedDirectMessages.push(userId);
          return "D_SAM";
        }),
        postMessage: vi.fn(async (conversationId: string, text: string) => {
          postedMessages.push({ conversationId, text });
        }),
      },
      undefined,
      undefined,
      {
        log: (message: string) => logs.push(message),
      },
    );
  }
});

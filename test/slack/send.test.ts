import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SlackWorkspaceSnapshot } from "../../src/slack/types.js";
import { makeSnapshot } from "../fixtures/slack.js";

vi.mock("../../src/slack/desktop.js", () => ({
  callSlackDesktopApi: vi.fn(),
}));

vi.mock("../../src/slack/state.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/slack/state.js")>();

  return {
    ...actual,
    readSlackWorkspaceSnapshot: vi.fn(),
  };
});

const { callSlackDesktopApi } = await import("../../src/slack/desktop.js");
const { readSlackWorkspaceSnapshot } = await import("../../src/slack/state.js");
const { sendChannelMessage, sendDirectMessage } = await import("../../src/slack/send.js");

describe("send helpers", () => {
  const mockedCallSlackDesktopApi = vi.mocked(callSlackDesktopApi);
  const mockedReadSlackWorkspaceSnapshot = vi.mocked(readSlackWorkspaceSnapshot);
  let logs: string[];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      logs.push(String(message ?? ""));
    });
    mockedReadSlackWorkspaceSnapshot.mockResolvedValue(makeSnapshot());
    mockedCallSlackDesktopApi.mockReset();
  });

  it("prints a channel dry-run without posting", async () => {
    await sendChannelMessage({
      channel: "general",
      dryRun: true,
      message: "hello @alex.morgan",
    });

    expect(logs).toEqual(["Would send to #general", "hello <@U_ALEX>"]);
    expect(mockedCallSlackDesktopApi).not.toHaveBeenCalled();
  });

  it("posts channel messages to Slack", async () => {
    await sendChannelMessage({
      channelId: "C_PROJECT",
      message: "**ready**",
    });

    expect(mockedCallSlackDesktopApi).toHaveBeenCalledWith("chat.postMessage", {
      channel: "C_PROJECT",
      mrkdwn: true,
      text: "*ready*",
    });
    expect(logs).toEqual(["Sent to #project-updates"]);
  });

  it("uses an existing DM conversation when available", async () => {
    await sendDirectMessage({
      handle: "@alex.morgan",
      message: "hello",
    });

    expect(mockedCallSlackDesktopApi).toHaveBeenCalledTimes(1);
    expect(mockedCallSlackDesktopApi).toHaveBeenCalledWith("chat.postMessage", {
      channel: "D_ALEX",
      mrkdwn: true,
      text: "hello",
    });
    expect(logs).toEqual(["Sent to Alex Morgan (@alex.morgan)"]);
  });

  it("opens a DM conversation when one does not already exist", async () => {
    mockedCallSlackDesktopApi.mockResolvedValueOnce({ channel: { id: "D_SAM" } });

    await sendDirectMessage({
      handle: "@sam.rivera",
      message: "hello",
    });

    expect(mockedCallSlackDesktopApi).toHaveBeenNthCalledWith(
      1,
      "conversations.open",
      {
        return_im: true,
        users: "U_SAM",
      },
    );
    expect(mockedCallSlackDesktopApi).toHaveBeenNthCalledWith(2, "chat.postMessage", {
      channel: "D_SAM",
      mrkdwn: true,
      text: "hello",
    });
  });

  it("supports snapshots supplied by callers", async () => {
    const snapshot: SlackWorkspaceSnapshot = makeSnapshot();
    mockedReadSlackWorkspaceSnapshot.mockResolvedValue(snapshot);

    await sendDirectMessage({
      userId: "U_ALEX",
      dryRun: true,
      message: "ping",
    });

    expect(logs).toEqual(["Would send to Alex Morgan (@alex.morgan)", "ping"]);
  });
});

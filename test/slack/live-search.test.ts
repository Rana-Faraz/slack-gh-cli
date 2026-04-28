import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSnapshot } from "../fixtures/slack.js";

vi.mock("../../src/slack/state.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/slack/state.js")>();

  return {
    ...actual,
    readSlackWorkspaceSnapshot: vi.fn(),
  };
});

const { readSlackWorkspaceSnapshot } = await import("../../src/slack/state.js");
const { liveSearchChannels, liveSearchUsers } = await import(
  "../../src/slack/live-search.js"
);

describe("live search wrappers", () => {
  beforeEach(() => {
    vi.mocked(readSlackWorkspaceSnapshot).mockResolvedValue(makeSnapshot());
  });

  it("searches channels from the live workspace snapshot", async () => {
    await expect(liveSearchChannels("project", 10)).resolves.toEqual([
      { id: "C_PROJECT", name: "project-updates", visibility: "private" },
    ]);
  });

  it("searches users from the live workspace snapshot", async () => {
    await expect(liveSearchUsers("sam", 10)).resolves.toEqual([
      {
        conversationId: undefined,
        displayName: "Sam Rivera",
        handle: "sam.rivera",
        userId: "U_SAM",
      },
    ]);
  });
});

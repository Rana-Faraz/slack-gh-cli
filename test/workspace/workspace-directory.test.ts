import { describe, expect, it } from "vitest";
import { WorkspaceDirectory } from "../../src/workspace/workspace-directory.js";
import { makeSnapshot } from "../fixtures/slack.js";

describe("WorkspaceDirectory", () => {
  const snapshot = makeSnapshot();
  const directory = new WorkspaceDirectory(snapshot);

  it("lists member channels sorted by name", () => {
    expect(directory.listChannels(10)).toEqual([
      { id: "C_GENERAL", name: "general", visibility: "public" },
      { id: "C_PROJECT", name: "project-updates", visibility: "private" },
    ]);
  });

  it("searches channels by tokenized names", () => {
    expect(directory.searchChannels("project updates", 5)).toEqual([
      { id: "C_PROJECT", name: "project-updates", visibility: "private" },
    ]);
  });

  it("lists direct messages without bots, deleted users, or self", () => {
    expect(directory.listDirectMessages(10)).toEqual([
      {
        conversationId: "D_ALEX",
        displayName: "Alex Morgan",
        handle: "alex.morgan",
        userId: "U_ALEX",
      },
      {
        conversationId: "D_DUPLICATE_B",
        displayName: "Jordan Lee",
        handle: "jordan.b",
        userId: "U_DUPLICATE_B",
      },
    ]);
  });

  it("searches users by display name, real name, handle, and email", () => {
    expect(directory.searchUsers("alex example", 5)).toEqual([
      {
        conversationId: "D_ALEX",
        displayName: "Alex Morgan",
        handle: "alex.morgan",
        userId: "U_ALEX",
      },
    ]);
  });

  it("resolves channels by ID or normalized name", () => {
    expect(directory.resolveChannel({ channelId: "C_PROJECT" }).id).toBe("C_PROJECT");
    expect(directory.resolveChannel({ channel: "#general" }).id).toBe("C_GENERAL");
  });

  it("rejects invalid channel selectors", () => {
    expect(() => directory.resolveChannel({})).toThrow(
      "Provide exactly one of --channel or --channel-id.",
    );
    expect(() => directory.resolveChannel({ channelId: "C_MISSING" })).toThrow(
      "No channel found for ID C_MISSING.",
    );
  });

  it("resolves users by ID, handle, or exact name", () => {
    expect(directory.resolveUser({ userId: "U_ALEX" }).id).toBe("U_ALEX");
    expect(directory.resolveUser({ handle: "@sam.rivera" }).id).toBe("U_SAM");
    expect(directory.resolveUser({ user: "Alex Morgan" }).id).toBe("U_ALEX");
  });

  it("uses an existing DM to disambiguate duplicate user names", () => {
    expect(directory.resolveUser({ user: "Jordan Lee" }).id).toBe("U_DUPLICATE_B");
  });

  it("reports ambiguous users when no existing DM can disambiguate", () => {
    const withoutDuplicateDms = makeSnapshot({
      conversations: snapshot.conversations.filter(
        (conversation) => conversation.id !== "D_DUPLICATE_B",
      ),
    });

    const directoryWithoutDuplicateDms = new WorkspaceDirectory(withoutDuplicateDms);

    expect(() => directoryWithoutDuplicateDms.resolveUser({ user: "Jordan Lee" }))
      .toThrow("Multiple users matched:");
  });

  it("finds existing direct messages by user ID", () => {
    expect(directory.findDirectMessage("U_ALEX")?.id).toBe("D_ALEX");
    expect(directory.findDirectMessage("U_SAM")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import {
  findExistingDirectMessage,
  listChannels,
  listDirectMessages,
  resolveChannel,
  resolveUser,
  searchChannels,
  searchUsers,
} from "../../src/slack/state.js";
import { makeSnapshot } from "../fixtures/slack.js";

describe("Slack workspace state selectors", () => {
  const snapshot = makeSnapshot();

  it("lists member channels sorted by name", () => {
    expect(listChannels(snapshot, 10)).toEqual([
      { id: "C_GENERAL", name: "general", visibility: "public" },
      { id: "C_PROJECT", name: "project-updates", visibility: "private" },
    ]);
  });

  it("searches channels by tokenized names", () => {
    expect(searchChannels(snapshot, "project updates", 5)).toEqual([
      { id: "C_PROJECT", name: "project-updates", visibility: "private" },
    ]);
  });

  it("lists direct messages without bots, deleted users, or self", () => {
    expect(listDirectMessages(snapshot, 10)).toEqual([
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
    expect(searchUsers(snapshot, "alex example", 5)).toEqual([
      {
        conversationId: "D_ALEX",
        displayName: "Alex Morgan",
        handle: "alex.morgan",
        userId: "U_ALEX",
      },
    ]);
  });

  it("resolves channels by ID or normalized name", () => {
    expect(resolveChannel(snapshot, { channelId: "C_PROJECT" }).id).toBe("C_PROJECT");
    expect(resolveChannel(snapshot, { channel: "#general" }).id).toBe("C_GENERAL");
  });

  it("rejects invalid channel selectors", () => {
    expect(() => resolveChannel(snapshot, {})).toThrow(
      "Provide exactly one of --channel or --channel-id.",
    );
    expect(() => resolveChannel(snapshot, { channelId: "C_MISSING" })).toThrow(
      "No channel found for ID C_MISSING.",
    );
  });

  it("resolves users by ID, handle, or exact name", () => {
    expect(resolveUser(snapshot, { userId: "U_ALEX" }).id).toBe("U_ALEX");
    expect(resolveUser(snapshot, { handle: "@sam.rivera" }).id).toBe("U_SAM");
    expect(resolveUser(snapshot, { user: "Alex Morgan" }).id).toBe("U_ALEX");
  });

  it("uses an existing DM to disambiguate duplicate user names", () => {
    expect(resolveUser(snapshot, { user: "Jordan Lee" }).id).toBe("U_DUPLICATE_B");
  });

  it("reports ambiguous users when no existing DM can disambiguate", () => {
    const withoutDuplicateDms = makeSnapshot({
      conversations: snapshot.conversations.filter(
        (conversation) => conversation.id !== "D_DUPLICATE_B",
      ),
    });

    expect(() => resolveUser(withoutDuplicateDms, { user: "Jordan Lee" })).toThrow(
      "Multiple users matched:",
    );
  });

  it("finds existing direct messages by user ID", () => {
    expect(findExistingDirectMessage(snapshot, "U_ALEX")?.id).toBe("D_ALEX");
    expect(findExistingDirectMessage(snapshot, "U_SAM")).toBeUndefined();
  });
});

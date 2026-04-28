import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/session/default-desktop-session.js", () => ({
  getWorkspaceCredential: vi.fn(),
  requestWorkspace: vi.fn(),
}));

const { getWorkspaceCredential, requestWorkspace } = await import(
  "../../src/session/default-desktop-session.js"
);
const { WorkspaceSnapshotRepository } = await import(
  "../../src/workspace/workspace-snapshot-repository.js"
);

describe("WorkspaceSnapshotRepository", () => {
  const mockedRequestWorkspace = vi.mocked(requestWorkspace);
  const mockedGetWorkspaceCredential = vi.mocked(getWorkspaceCredential);

  beforeEach(() => {
    mockedGetWorkspaceCredential.mockResolvedValue({
      appPath: "/example/Slack.app",
      cookie: "xoxd-cookie",
      dataDir: "/example/data",
      teamDomain: "example",
      teamId: "T_EXAMPLE",
      teamName: "Example",
      teamUrl: "https://example.slack.com/",
      token: "xoxc-token",
      userId: "U_SELF",
      userName: "self",
    });
    mockedRequestWorkspace.mockReset();
  });

  it("loads paginated users and conversations through the desktop API", async () => {
    mockedRequestWorkspace
      .mockResolvedValueOnce({
        members: [
          {
            id: "U_SELF",
            name: "self",
            profile: { real_name: "Self User" },
          },
        ],
        response_metadata: { next_cursor: "users-page-2" },
      })
      .mockResolvedValueOnce({
        channels: [
          {
            id: "C_GENERAL",
            is_channel: true,
            is_member: true,
            name: "general",
          },
        ],
        response_metadata: { next_cursor: "channels-page-2" },
      })
      .mockResolvedValueOnce({
        members: [
          {
            deleted: false,
            id: "U_ALEX",
            is_bot: false,
            name: "alex",
            profile: {
              display_name: "Alex",
              email: "alex@example.test",
              real_name: "Alex Morgan",
            },
          },
        ],
        response_metadata: {},
      })
      .mockResolvedValueOnce({
        channels: [
          {
            id: "D_ALEX",
            is_im: true,
            is_open: true,
            name: "D_ALEX",
            user: "U_ALEX",
          },
        ],
        response_metadata: {},
      });

    const snapshot = await new WorkspaceSnapshotRepository().read();

    expect(snapshot.teamId).toBe("T_EXAMPLE");
    expect(snapshot.users).toMatchObject([
      { displayName: "Self User", id: "U_SELF", isSelf: true },
      {
        displayName: "Alex",
        email: "alex@example.test",
        handle: "alex",
        id: "U_ALEX",
        realName: "Alex Morgan",
      },
    ]);
    expect(snapshot.conversations).toMatchObject([
      {
        id: "C_GENERAL",
        isMember: true,
        kind: "channel",
        name: "general",
      },
      {
        id: "D_ALEX",
        isMember: true,
        kind: "dm",
        userId: "U_ALEX",
      },
    ]);
    expect(mockedRequestWorkspace).toHaveBeenNthCalledWith(1, "users.list", {
      cursor: undefined,
      limit: 200,
    });
    expect(mockedRequestWorkspace).toHaveBeenNthCalledWith(
      2,
      "conversations.list",
      {
        cursor: undefined,
        exclude_archived: true,
        limit: 200,
        types: "public_channel,private_channel,im,mpim",
      },
    );
    expect(mockedRequestWorkspace).toHaveBeenNthCalledWith(3, "users.list", {
      cursor: "users-page-2",
      limit: 200,
    });
    expect(mockedRequestWorkspace).toHaveBeenNthCalledWith(
      4,
      "conversations.list",
      {
        cursor: "channels-page-2",
        exclude_archived: true,
        limit: 200,
        types: "public_channel,private_channel,im,mpim",
      },
    );
  });
});

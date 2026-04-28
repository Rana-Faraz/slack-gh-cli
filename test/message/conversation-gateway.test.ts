import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/session/default-desktop-session.js", () => ({
  requestWorkspace: vi.fn(),
}));

const { requestWorkspace } = await import(
  "../../src/session/default-desktop-session.js"
);
const { ConversationGateway } = await import(
  "../../src/message/conversation-gateway.js"
);

describe("ConversationGateway", () => {
  const mockedRequestWorkspace = vi.mocked(requestWorkspace);

  beforeEach(() => {
    mockedRequestWorkspace.mockReset();
  });

  it("opens direct messages through the selected workspace session", async () => {
    mockedRequestWorkspace.mockResolvedValueOnce({ channel: { id: "D_EXAMPLE" } });

    await expect(new ConversationGateway().openDirectMessage("U_EXAMPLE"))
      .resolves.toBe("D_EXAMPLE");

    expect(mockedRequestWorkspace).toHaveBeenCalledWith("conversations.open", {
      return_im: true,
      users: "U_EXAMPLE",
    });
  });

  it("posts messages through the selected workspace session", async () => {
    await new ConversationGateway().postMessage("C_EXAMPLE", "hello");

    expect(mockedRequestWorkspace).toHaveBeenCalledWith("chat.postMessage", {
      channel: "C_EXAMPLE",
      mrkdwn: true,
      text: "hello",
    });
  });
});

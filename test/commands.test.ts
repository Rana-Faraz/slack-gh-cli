import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/session/default-desktop-session.js", () => ({
  clearWorkspacePreference: vi.fn(),
  getCurrentDesktopWorkspace: vi.fn(),
  listDesktopWorkspaces: vi.fn(),
  lookupDesktopSession: vi.fn(),
  openDesktopLogin: vi.fn(),
  saveWorkspacePreference: vi.fn(),
  setWorkspaceOverride: vi.fn(),
}));

vi.mock("../src/workspace/current-workspace.js", () => ({
  listCurrentChannels: vi.fn(),
  listCurrentDirectMessages: vi.fn(),
  searchCurrentChannels: vi.fn(),
  searchCurrentUsers: vi.fn(),
}));

vi.mock("../src/message/default-message-dispatch.js", () => ({
  sendChannelMessage: vi.fn(),
  sendDirectMessage: vi.fn(),
}));

const desktopSession = await import("../src/session/default-desktop-session.js");
const currentWorkspace = await import("../src/workspace/current-workspace.js");
const messageDispatch = await import("../src/message/default-message-dispatch.js");
const { createSlackProgram } = await import("../src/cli.js");

describe("command actions", () => {
  let logs: string[];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      logs.push(String(message ?? ""));
    });
    vi.spyOn(console, "warn").mockImplementation((message?: unknown) => {
      logs.push(String(message ?? ""));
    });
    process.exitCode = undefined;
    vi.mocked(currentWorkspace.listCurrentChannels).mockResolvedValue([
      { id: "C_GENERAL", name: "general", visibility: "public" },
    ]);
    vi.mocked(currentWorkspace.searchCurrentChannels).mockResolvedValue([
      { id: "C_PROJECT", name: "project-updates", visibility: "private" },
    ]);
    vi.mocked(currentWorkspace.listCurrentDirectMessages).mockResolvedValue([
      {
        conversationId: "D_ALEX",
        displayName: "Alex Morgan",
        handle: "alex.morgan",
        userId: "U_ALEX",
      },
    ]);
    vi.mocked(currentWorkspace.searchCurrentUsers).mockResolvedValue([
      {
        displayName: "Alex Morgan",
        handle: "alex.morgan",
        userId: "U_ALEX",
      },
    ]);
    vi.mocked(desktopSession.lookupDesktopSession).mockResolvedValue({
      appPath: "/example/Slack.app",
      available: true,
      dataDir: "/example/data",
      teamDomain: "example",
      teamId: "T_EXAMPLE",
      teamName: "Example",
      teamUrl: "https://example.slack.com/",
      userId: "U_SELF",
      userName: "self",
    });
    vi.mocked(desktopSession.listDesktopWorkspaces).mockResolvedValue([
      {
        authenticated: true,
        configuredDefault: false,
        domain: "example",
        id: "T_EXAMPLE",
        name: "Example",
        selectedInDesktop: true,
        userId: "U_SELF",
      },
    ]);
    vi.mocked(desktopSession.getCurrentDesktopWorkspace).mockResolvedValue({
      authenticated: true,
      configuredDefault: true,
      domain: "example",
      id: "T_EXAMPLE",
      name: "Example",
      selectedInDesktop: true,
      userId: "U_SELF",
      userName: "self",
    });
    vi.mocked(desktopSession.saveWorkspacePreference).mockResolvedValue({
      authenticated: true,
      configuredDefault: true,
      id: "T_EXAMPLE",
      name: "Example",
      selectedInDesktop: true,
    });
    vi.mocked(desktopSession.clearWorkspacePreference).mockResolvedValue(true);
  });

  it("prints auth status", async () => {
    await parse("auth", "status", "--workspace", "example");

    expect(desktopSession.setWorkspaceOverride).toHaveBeenCalledWith("example");
    expect(logs).toContain("Slack Desktop authentication is available.");
    expect(logs).toContain("Slack Desktop workspace ID: T_EXAMPLE");
  });

  it("prints workspace list and current workspace", async () => {
    await parse("workspace", "list");
    await parse("workspace", "current");

    expect(logs).toContain("Example\tT_EXAMPLE\texample\tU_SELF\tdesktop,auth");
    expect(logs).toContain("Workspace: Example");
    expect(logs).toContain("Configured default: yes");
  });

  it("saves and clears workspace defaults", async () => {
    await parse("workspace", "use", "example");
    await parse("workspace", "clear");

    expect(desktopSession.saveWorkspacePreference).toHaveBeenCalledWith("example");
    expect(logs).toContain("Default workspace set to Example (T_EXAMPLE).");
    expect(logs).toContain("Default workspace cleared.");
  });

  it("lists, searches, and sends channels", async () => {
    await parse("channel", "list", "--limit", "1", "--workspace", "example");
    await parse("channel", "search", "project", "--limit", "5");
    await parse("channel", "send", "--channel", "general", "--message", "hello");

    expect(logs).toContain("#general\tC_GENERAL\tpublic");
    expect(currentWorkspace.searchCurrentChannels).toHaveBeenCalledWith("project", 5);
    expect(logs).toContain("#project-updates\tC_PROJECT\tprivate");
    expect(messageDispatch.sendChannelMessage).toHaveBeenCalledWith({
      channel: "general",
      message: "hello",
    });
  });

  it("lists, searches, and sends direct messages", async () => {
    await parse("dm", "list", "--limit", "1");
    await parse("dm", "search", "alex");
    await parse("dm", "send", "--handle", "@alex.morgan", "--message", "hello");

    expect(logs).toContain("Alex Morgan\t@alex.morgan\tU_ALEX");
    expect(currentWorkspace.searchCurrentUsers).toHaveBeenCalledWith("alex", 20);
    expect(messageDispatch.sendDirectMessage).toHaveBeenCalledWith({
      handle: "@alex.morgan",
      message: "hello",
    });
  });
});

async function parse(...args: string[]): Promise<void> {
  await createSlackProgram().parseAsync(["node", "slack", ...args]);
}

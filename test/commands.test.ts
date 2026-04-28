import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSnapshot } from "./fixtures/slack.js";

vi.mock("../src/slack/desktop.js", () => ({
  clearSlackDesktopWorkspacePreference: vi.fn(),
  getCurrentSlackDesktopWorkspace: vi.fn(),
  listSlackDesktopWorkspaces: vi.fn(),
  lookupSlackDesktopAuth: vi.fn(),
  openSlackDesktopLogin: vi.fn(),
  saveSlackDesktopWorkspacePreference: vi.fn(),
  setSlackDesktopWorkspaceOverride: vi.fn(),
}));

vi.mock("../src/slack/state.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/slack/state.js")>();

  return {
    ...actual,
    readSlackWorkspaceSnapshot: vi.fn(),
  };
});

vi.mock("../src/slack/live-search.js", () => ({
  liveSearchChannels: vi.fn(),
  liveSearchUsers: vi.fn(),
}));

vi.mock("../src/slack/send.js", () => ({
  sendChannelMessage: vi.fn(),
  sendDirectMessage: vi.fn(),
}));

const desktop = await import("../src/slack/desktop.js");
const state = await import("../src/slack/state.js");
const liveSearch = await import("../src/slack/live-search.js");
const send = await import("../src/slack/send.js");
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
    vi.mocked(state.readSlackWorkspaceSnapshot).mockResolvedValue(makeSnapshot());
    vi.mocked(liveSearch.liveSearchChannels).mockResolvedValue([
      { id: "C_PROJECT", name: "project-updates", visibility: "private" },
    ]);
    vi.mocked(liveSearch.liveSearchUsers).mockResolvedValue([
      {
        displayName: "Alex Morgan",
        handle: "alex.morgan",
        userId: "U_ALEX",
      },
    ]);
    vi.mocked(desktop.lookupSlackDesktopAuth).mockResolvedValue({
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
    vi.mocked(desktop.listSlackDesktopWorkspaces).mockResolvedValue([
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
    vi.mocked(desktop.getCurrentSlackDesktopWorkspace).mockResolvedValue({
      authenticated: true,
      configuredDefault: true,
      domain: "example",
      id: "T_EXAMPLE",
      name: "Example",
      selectedInDesktop: true,
      userId: "U_SELF",
      userName: "self",
    });
    vi.mocked(desktop.saveSlackDesktopWorkspacePreference).mockResolvedValue({
      authenticated: true,
      configuredDefault: true,
      id: "T_EXAMPLE",
      name: "Example",
      selectedInDesktop: true,
    });
    vi.mocked(desktop.clearSlackDesktopWorkspacePreference).mockResolvedValue(true);
  });

  it("prints auth status", async () => {
    await parse("auth", "status", "--workspace", "example");

    expect(desktop.setSlackDesktopWorkspaceOverride).toHaveBeenCalledWith("example");
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

    expect(desktop.saveSlackDesktopWorkspacePreference).toHaveBeenCalledWith("example");
    expect(logs).toContain("Default workspace set to Example (T_EXAMPLE).");
    expect(logs).toContain("Default workspace cleared.");
  });

  it("lists, searches, and sends channels", async () => {
    await parse("channel", "list", "--limit", "1", "--workspace", "example");
    await parse("channel", "search", "project", "--limit", "5");
    await parse("channel", "send", "--channel", "general", "--message", "hello");

    expect(logs).toContain("#general\tC_GENERAL\tpublic");
    expect(liveSearch.liveSearchChannels).toHaveBeenCalledWith("project", 5);
    expect(logs).toContain("#project-updates\tC_PROJECT\tprivate");
    expect(send.sendChannelMessage).toHaveBeenCalledWith({
      channel: "general",
      message: "hello",
    });
  });

  it("lists, searches, and sends direct messages", async () => {
    await parse("dm", "list", "--limit", "1");
    await parse("dm", "search", "alex");
    await parse("dm", "send", "--handle", "@alex.morgan", "--message", "hello");

    expect(logs).toContain("Alex Morgan\t@alex.morgan\tU_ALEX");
    expect(liveSearch.liveSearchUsers).toHaveBeenCalledWith("alex", 20);
    expect(send.sendDirectMessage).toHaveBeenCalledWith({
      handle: "@alex.morgan",
      message: "hello",
    });
  });
});

async function parse(...args: string[]): Promise<void> {
  await createSlackProgram().parseAsync(["node", "slack", ...args]);
}

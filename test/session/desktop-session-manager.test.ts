import { describe, expect, it, vi } from "vitest";
import { DesktopSessionManager } from "../../src/session/desktop-session-manager.js";
import type { DesktopHost } from "../../src/platform/desktop-host.js";

describe("DesktopSessionManager", () => {
  it("treats an unsupported Windows host as unavailable without reading desktop state", async () => {
    const host = makeHost({
      appPath: "C:\\Users\\Example\\AppData\\Local\\slack\\slack.exe",
      dataDir: "C:\\Users\\Example\\AppData\\Roaming\\Slack",
      isSupported: () => false,
      unsupportedMessage: "Slack Desktop auth is not supported on this host.",
    });

    await expect(new DesktopSessionManager(host).lookupAuth()).resolves.toEqual({
      appPath: "C:\\Users\\Example\\AppData\\Local\\slack\\slack.exe",
      available: false,
      dataDir: "C:\\Users\\Example\\AppData\\Roaming\\Slack",
      warning: "Slack Desktop auth is not supported on this host.",
    });
    expect(host.assertInstalled).not.toHaveBeenCalled();
    expect(host.openApp).not.toHaveBeenCalled();
    expect(host.readRootState).not.toHaveBeenCalled();
    expect(host.readWorkspacePreference).not.toHaveBeenCalled();
    expect(host.readClientTokens).not.toHaveBeenCalled();
    expect(host.readCookie).not.toHaveBeenCalled();
    expect(host.fetch).not.toHaveBeenCalled();
    expect(host.writeWorkspacePreference).not.toHaveBeenCalled();
  });

  it("reports unsupported hosts without touching Slack Desktop files", async () => {
    const host = makeHost({
      isSupported: () => false,
      unsupportedMessage: "Slack Desktop auth is not supported on this host.",
    });

    await expect(new DesktopSessionManager(host).lookupAuth()).resolves.toEqual({
      appPath: "/example/Slack.app",
      available: false,
      dataDir: "/example/slack-data",
      warning: "Slack Desktop auth is not supported on this host.",
    });
    expect(host.assertInstalled).not.toHaveBeenCalled();
    expect(host.readRootState).not.toHaveBeenCalled();
    expect(host.readClientTokens).not.toHaveBeenCalled();
  });

  it("resolves the configured workspace through host-provided storage and API", async () => {
    const host = makeHost({
      fetch: vi.fn(async (_input, init) => {
        const body = init?.body as URLSearchParams;
        const token = body.get("token");

        return jsonResponse({
          ok: true,
          team: token === "xoxc-beta" ? "Beta" : "Alpha",
          team_id: token === "xoxc-beta" ? "T_BETA" : "T_ALPHA",
          url: token === "xoxc-beta"
            ? "https://beta.example.test/"
            : "https://alpha.example.test/",
          user: token === "xoxc-beta" ? "beta-user" : "alpha-user",
          user_id: token === "xoxc-beta" ? "U_BETA" : "U_ALPHA",
        });
      }),
      readClientTokens: vi.fn(async () => ["xoxc-alpha", "xoxc-beta"]),
      readCookie: vi.fn(async () => "xoxd-cookie"),
      readRootState: vi.fn(async () => ({
        workspaces: {
          T_ALPHA: { domain: "alpha", id: "T_ALPHA", name: "Alpha" },
          T_BETA: { domain: "beta", id: "T_BETA", name: "Beta" },
        },
        workspacesMeta: { selectedWorkspaceId: "T_ALPHA" },
      })),
      readWorkspacePreference: vi.fn(async () => "beta"),
    });

    await expect(new DesktopSessionManager(host).lookupAuth()).resolves.toEqual({
      appPath: "/example/Slack.app",
      available: true,
      dataDir: "/example/slack-data",
      teamDomain: "beta",
      teamId: "T_BETA",
      teamName: "Beta",
      teamUrl: "https://beta.example.test/",
      userId: "U_BETA",
      userName: "beta-user",
    });
    expect(host.fetch).toHaveBeenCalledTimes(2);
  });

  it("saves and clears workspace preferences through the host", async () => {
    const host = makeHost({
      fetch: vi.fn(async () =>
        jsonResponse({
          ok: true,
          team: "Example",
          team_id: "T_EXAMPLE",
          user: "example-user",
          user_id: "U_EXAMPLE",
        }),
      ),
      readClientTokens: vi.fn(async () => ["xoxc-example"]),
      readCookie: vi.fn(async () => "xoxd-cookie"),
      readRootState: vi.fn(async () => ({
        workspaces: {
          T_EXAMPLE: { domain: "example", id: "T_EXAMPLE", name: "Example" },
        },
        workspacesMeta: { selectedWorkspaceId: "T_EXAMPLE" },
      })),
      readWorkspacePreference: vi.fn(async () => "T_EXAMPLE"),
    });
    const client = new DesktopSessionManager(host);

    await expect(client.saveWorkspacePreference("example")).resolves.toMatchObject({
      configuredDefault: true,
      id: "T_EXAMPLE",
      name: "Example",
    });
    expect(host.writeWorkspacePreference).toHaveBeenCalledWith({
      workspace: "T_EXAMPLE",
    });
    await expect(client.clearWorkspacePreference()).resolves.toBe(true);
    expect(host.writeWorkspacePreference).toHaveBeenCalledWith({});
  });

  it("opens Slack through the host", async () => {
    const host = makeHost();

    await new DesktopSessionManager(host).openLogin();

    expect(host.assertInstalled).toHaveBeenCalledOnce();
    expect(host.openApp).toHaveBeenCalledOnce();
  });

  it("lists authenticated and known unauthenticated workspaces", async () => {
    const host = makeHost({
      fetch: vi.fn(async () =>
        jsonResponse({
          ok: true,
          team: "Alpha",
          team_id: "T_ALPHA",
          user: "alpha-user",
          user_id: "U_ALPHA",
        }),
      ),
      readClientTokens: vi.fn(async () => ["xoxc-alpha"]),
      readCookie: vi.fn(async () => "xoxd-cookie"),
      readRootState: vi.fn(async () => ({
        workspaces: {
          T_ALPHA: { domain: "alpha", id: "T_ALPHA", name: "Alpha" },
          T_GAMMA: { domain: "gamma", id: "T_GAMMA", name: "Gamma" },
        },
        workspacesMeta: { selectedWorkspaceId: "T_GAMMA" },
      })),
      readWorkspacePreference: vi.fn(async () => undefined),
    });

    await expect(new DesktopSessionManager(host).listWorkspaces()).resolves.toEqual([
      {
        authenticated: true,
        configuredDefault: false,
        domain: "alpha",
        id: "T_ALPHA",
        name: "Alpha",
        selectedInDesktop: false,
        url: undefined,
        userId: "U_ALPHA",
        userName: "alpha-user",
      },
      {
        authenticated: false,
        configuredDefault: false,
        domain: "gamma",
        id: "T_GAMMA",
        name: "Gamma",
        selectedInDesktop: true,
        url: undefined,
        userId: undefined,
        userName: undefined,
      },
    ]);
  });

  it("uses the selected workspace when no default is configured", async () => {
    const host = makeHost({
      fetch: vi.fn(async (_input, init) => {
        const token = (init?.body as URLSearchParams).get("token");
        return jsonResponse({
          ok: true,
          team: token === "xoxc-selected" ? "Selected" : "Other",
          team_id: token === "xoxc-selected" ? "T_SELECTED" : "T_OTHER",
          user: "user",
          user_id: "U_USER",
        });
      }),
      readClientTokens: vi.fn(async () => ["xoxc-other", "xoxc-selected"]),
      readCookie: vi.fn(async () => "xoxd-cookie"),
      readRootState: vi.fn(async () => ({
        workspacesMeta: { selectedWorkspaceId: "T_SELECTED" },
      })),
      readWorkspacePreference: vi.fn(async () => undefined),
    });

    await expect(new DesktopSessionManager(host).getCurrentWorkspace()).resolves.toMatchObject({
      configuredDefault: false,
      id: "T_SELECTED",
      selectedInDesktop: true,
    });
  });

  it("calls Slack API with the selected credential", async () => {
    const host = makeHost({
      fetch: vi.fn(async (input, init) => {
        const url = String(input);
        if (url.endsWith("/auth.test")) {
          return jsonResponse({
            ok: true,
            team: "Example",
            team_id: "T_EXAMPLE",
            user: "example-user",
            user_id: "U_EXAMPLE",
          });
        }

        expect(url).toBe("https://slack.com/api/chat.postMessage");
        expect((init?.body as URLSearchParams).get("channel")).toBe("C_EXAMPLE");
        return jsonResponse({ ok: true, ts: "1.234" });
      }),
      readClientTokens: vi.fn(async () => ["xoxc-example"]),
      readCookie: vi.fn(async () => "xoxd-cookie"),
      readRootState: vi.fn(async () => ({})),
      readWorkspacePreference: vi.fn(async () => undefined),
    });

    await expect(
      new DesktopSessionManager(host).request("chat.postMessage", {
        channel: "C_EXAMPLE",
        text: "hello",
      }),
    ).resolves.toEqual({ ok: true, ts: "1.234" });
  });

  it("reports unavailable auth when cached tokens are rejected", async () => {
    const host = makeHost({
      fetch: vi.fn(async () => jsonResponse({ error: "invalid_auth", ok: false })),
      readClientTokens: vi.fn(async () => ["xoxc-invalid"]),
      readCookie: vi.fn(async () => "xoxd-cookie"),
      readRootState: vi.fn(async () => ({})),
      readWorkspacePreference: vi.fn(async () => undefined),
    });

    await expect(new DesktopSessionManager(host).lookupAuth()).resolves.toMatchObject({
      available: false,
      warning:
        "Slack Desktop auth was found, but no cached client token was accepted. Open Slack Desktop and let it refresh, then retry.",
    });
  });

  it("reports unavailable auth when no client tokens are cached", async () => {
    const host = makeHost({
      readClientTokens: vi.fn(async () => []),
      readCookie: vi.fn(async () => "xoxd-cookie"),
      readRootState: vi.fn(async () => ({})),
      readWorkspacePreference: vi.fn(async () => undefined),
    });

    await expect(new DesktopSessionManager(host).lookupAuth()).resolves.toMatchObject({
      available: false,
      warning: "No Slack Desktop client token found. Open Slack Desktop and sign in first.",
    });
    expect(host.fetch).not.toHaveBeenCalled();
  });

  it("surfaces Slack API failures from client calls", async () => {
    const host = makeHost({
      fetch: vi.fn(async (input) => {
        if (String(input).endsWith("/auth.test")) {
          return jsonResponse({
            ok: true,
            team: "Example",
            team_id: "T_EXAMPLE",
            user: "example-user",
            user_id: "U_EXAMPLE",
          });
        }

        return jsonResponse({ error: "channel_not_found", ok: false });
      }),
      readClientTokens: vi.fn(async () => ["xoxc-example"]),
      readCookie: vi.fn(async () => "xoxd-cookie"),
      readRootState: vi.fn(async () => ({})),
      readWorkspacePreference: vi.fn(async () => undefined),
    });

    await expect(
      new DesktopSessionManager(host).request("chat.postMessage", {
        channel: "C_MISSING",
      }),
    ).rejects.toThrow("channel_not_found");
  });

  it("rejects unknown and ambiguous workspace preference selections", async () => {
    const host = makeHost({
      fetch: vi.fn(async (_input, init) => {
        const token = (init?.body as URLSearchParams).get("token");
        return jsonResponse({
          ok: true,
          team: token === "xoxc-alpha" ? "Shared" : "Shared Team",
          team_id: token === "xoxc-alpha" ? "T_ALPHA" : "T_BETA",
          user: "user",
          user_id: "U_USER",
        });
      }),
      readClientTokens: vi.fn(async () => ["xoxc-alpha", "xoxc-beta"]),
      readCookie: vi.fn(async () => "xoxd-cookie"),
      readRootState: vi.fn(async () => ({
        workspaces: {
          T_ALPHA: { domain: "shared-alpha", id: "T_ALPHA", name: "Shared" },
          T_BETA: { domain: "shared-beta", id: "T_BETA", name: "Shared Team" },
        },
      })),
      readWorkspacePreference: vi.fn(async () => undefined),
    });
    const client = new DesktopSessionManager(host);

    await expect(client.saveWorkspacePreference("missing")).rejects.toThrow(
      'No Slack Desktop workspace found matching "missing".',
    );
    await expect(client.saveWorkspacePreference("shared-")).rejects.toThrow(
      "Multiple workspaces matched",
    );
  });
});

function makeHost(
  overrides: Partial<DesktopHost> = {},
): DesktopHost {
  return {
    appPath: "/example/Slack.app",
    assertInstalled: vi.fn(),
    dataDir: "/example/slack-data",
    fetch: vi.fn(),
    isSupported: () => true,
    openApp: vi.fn(),
    readClientTokens: vi.fn(),
    readCookie: vi.fn(),
    readRootState: vi.fn(),
    readWorkspacePreference: vi.fn(),
    unsupportedMessage: "unsupported",
    writeWorkspacePreference: vi.fn(),
    ...overrides,
  };
}

function jsonResponse(payload: unknown): Response {
  return {
    json: async () => payload,
    ok: true,
    status: 200,
  } as Response;
}

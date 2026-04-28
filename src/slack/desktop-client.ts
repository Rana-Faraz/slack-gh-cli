export type SlackDesktopHost = {
  appPath: string;
  dataDir: string;
  unsupportedMessage: string;
  isSupported(): boolean;
  assertInstalled(): Promise<void>;
  openApp(): Promise<void>;
  readRootState(): Promise<unknown>;
  readWorkspacePreference(): Promise<string | undefined>;
  writeWorkspacePreference(config: unknown): Promise<void>;
  readClientTokens(): Promise<string[]>;
  readCookie(name: string): Promise<string>;
  fetch(input: string | URL, init?: RequestInit): Promise<Response>;
};

type SlackApiResponse<T> = T & {
  ok: boolean;
  error?: string;
  needed?: string;
};

type SlackAuthTestResponse = {
  team: string;
  team_id: string;
  user: string;
  user_id: string;
  url?: string;
};

type SlackRootState = {
  workspaces?: Record<
    string,
    {
      id?: string;
      name?: string;
      domain?: string;
      url?: string;
    }
  >;
  workspacesMeta?: {
    selectedWorkspaceId?: string;
    selectedUserId?: string;
  };
};

export type SlackDesktopAuthStatus = {
  available: boolean;
  appPath: string;
  dataDir: string;
  teamId?: string;
  teamName?: string;
  teamDomain?: string;
  teamUrl?: string;
  userId?: string;
  userName?: string;
  warning?: string;
};

export type SlackDesktopWorkspace = {
  id: string;
  name: string;
  domain?: string;
  url?: string;
  userId?: string;
  userName?: string;
  selectedInDesktop: boolean;
  configuredDefault: boolean;
  authenticated: boolean;
};

export type SlackDesktopClient = {
  openLogin(): Promise<void>;
  lookupAuth(): Promise<SlackDesktopAuthStatus>;
  listWorkspaces(): Promise<SlackDesktopWorkspace[]>;
  getCurrentWorkspace(): Promise<SlackDesktopWorkspace>;
  getCredential(): Promise<SlackDesktopCredential>;
  saveWorkspacePreference(workspace: string): Promise<SlackDesktopWorkspace>;
  clearWorkspacePreference(): Promise<boolean>;
  callApi<T>(
    method: string,
    params: Record<string, string | number | boolean | undefined>,
  ): Promise<T>;
  setWorkspaceOverride(workspace?: string): void;
};

export type SlackDesktopCredential = {
  configuredDefault: boolean;
  cookie: string;
  selectedInDesktop: boolean;
  teamDomain?: string;
  teamId: string;
  teamName: string;
  teamUrl?: string;
  token: string;
  userId: string;
  userName: string;
};

export function createSlackDesktopClient(host: SlackDesktopHost): SlackDesktopClient {
  let credentialPromise: Promise<SlackDesktopCredential> | undefined;
  let workspaceOverride: string | undefined;

  return {
    async openLogin(): Promise<void> {
      await host.assertInstalled();
      await host.openApp();
    },

    setWorkspaceOverride(workspace?: string): void {
      const normalizedWorkspace = workspace?.trim();
      workspaceOverride = normalizedWorkspace && normalizedWorkspace.length > 0
        ? normalizedWorkspace
        : undefined;
      credentialPromise = undefined;
    },

    async lookupAuth(): Promise<SlackDesktopAuthStatus> {
      if (!host.isSupported()) {
        return {
          available: false,
          appPath: host.appPath,
          dataDir: host.dataDir,
          warning: host.unsupportedMessage,
        };
      }

      try {
        const credential = await getCredential();

        return {
          available: true,
          appPath: host.appPath,
          dataDir: host.dataDir,
          teamDomain: credential.teamDomain,
          teamId: credential.teamId,
          teamName: credential.teamName,
          teamUrl: credential.teamUrl,
          userId: credential.userId,
          userName: credential.userName,
        };
      } catch (error) {
        return {
          available: false,
          appPath: host.appPath,
          dataDir: host.dataDir,
          warning:
            error instanceof Error
              ? error.message
              : "Could not read Slack Desktop authentication.",
        };
      }
    },

    async listWorkspaces(): Promise<SlackDesktopWorkspace[]> {
      return await listWorkspaces(host);
    },

    async getCurrentWorkspace(): Promise<SlackDesktopWorkspace> {
      const credential = await getCredential();

      return {
        id: credential.teamId,
        name: credential.teamName,
        domain: credential.teamDomain,
        url: credential.teamUrl,
        userId: credential.userId,
        userName: credential.userName,
        selectedInDesktop: credential.selectedInDesktop,
        configuredDefault: credential.configuredDefault,
        authenticated: true,
      };
    },

    async getCredential(): Promise<SlackDesktopCredential> {
      return await getCredential();
    },

    async saveWorkspacePreference(workspace: string): Promise<SlackDesktopWorkspace> {
      const selected = await resolveWorkspace(host, workspace);
      await host.writeWorkspacePreference({ workspace: selected.id });
      credentialPromise = undefined;
      return {
        ...selected,
        configuredDefault: true,
      };
    },

    async clearWorkspacePreference(): Promise<boolean> {
      const existingWorkspace = await host.readWorkspacePreference();
      await host.writeWorkspacePreference({});
      credentialPromise = undefined;
      return Boolean(existingWorkspace);
    },

    async callApi<T>(
      method: string,
      params: Record<string, string | number | boolean | undefined>,
    ): Promise<T> {
      const credential = await getCredential();
      return await callSlackApiWithCredential<T>(
        host,
        credential.token,
        credential.cookie,
        method,
        params,
      );
    },
  };

  async function getCredential() {
    credentialPromise ??= readCredential(host, workspaceOverride);
    return await credentialPromise;
  }
}

async function listWorkspaces(host: SlackDesktopHost): Promise<SlackDesktopWorkspace[]> {
  await host.assertInstalled();

  const [rootState, configuredWorkspace] = await Promise.all([
    host.readRootState() as Promise<SlackRootState>,
    host.readWorkspacePreference(),
  ]);
  const [cookie, tokens] = await Promise.all([
    host.readCookie("d"),
    host.readClientTokens(),
  ]);
  const authResults = (
    await Promise.all(
      [...new Set(tokens)].map(async (token) => {
        try {
          const auth = await callSlackApiWithCredential<SlackAuthTestResponse>(
            host,
            token,
            cookie,
            "auth.test",
            {},
          );
          return { auth, cookie, token };
        } catch {
          return null;
        }
      }),
    )
  ).filter(
    (
      result,
    ): result is { token: string; cookie: string; auth: SlackAuthTestResponse } =>
      result !== null,
  );
  const workspaceIds = new Set<string>([
    ...Object.keys(rootState.workspaces ?? {}),
    ...authResults.map((result) => result.auth.team_id),
  ]);

  return [...workspaceIds]
    .map((id) => {
      const workspace = rootState.workspaces?.[id];
      const auth = authResults.find((result) => result.auth.team_id === id)?.auth;

      return {
        id,
        name: auth?.team || workspace?.name || id,
        domain: workspace?.domain,
        url: auth?.url ?? workspace?.url,
        userId: auth?.user_id,
        userName: auth?.user,
        selectedInDesktop: rootState.workspacesMeta?.selectedWorkspaceId === id,
        configuredDefault: configuredWorkspace === id,
        authenticated: Boolean(auth),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function resolveWorkspace(
  host: SlackDesktopHost,
  workspace: string,
): Promise<SlackDesktopWorkspace> {
  const workspaces = await listWorkspaces(host);
  const normalizedWorkspace = normalizeWorkspaceSelector(workspace);
  const exactMatches = workspaces.filter((candidate) =>
    [
      candidate.id,
      candidate.domain,
      candidate.name,
    ].some((value) => value && normalizeWorkspaceSelector(value) === normalizedWorkspace),
  );
  const matches =
    exactMatches.length > 0
      ? exactMatches
      : workspaces.filter((candidate) =>
          [candidate.id, candidate.domain, candidate.name].some((value) =>
            value
              ? normalizeWorkspaceSelector(value).includes(normalizedWorkspace)
              : false,
          ),
        );

  if (matches.length === 0) {
    throw new Error(`No Slack Desktop workspace found matching "${workspace}".`);
  }

  const authenticatedMatches = matches.filter((candidate) => candidate.authenticated);

  if (authenticatedMatches.length === 1) {
    return authenticatedMatches[0];
  }

  if (matches.length === 1) {
    const match = matches[0];

    if (!match.authenticated) {
      throw new Error(
        `Workspace "${match.name}" was found, but Slack Desktop does not have a usable session token for it.`,
      );
    }

    return match;
  }

  const labels = matches
    .map((candidate) => `${candidate.name} (${candidate.id})`)
    .join(", ");
  throw new Error(`Multiple workspaces matched "${workspace}": ${labels}. Use the workspace ID.`);
}

async function readCredential(
  host: SlackDesktopHost,
  workspaceOverride?: string,
): Promise<SlackDesktopCredential> {
  await host.assertInstalled();

  const [rootState, configuredWorkspace] = await Promise.all([
    host.readRootState() as Promise<SlackRootState>,
    host.readWorkspacePreference(),
  ]);
  const [cookie, tokens] = await Promise.all([
    host.readCookie("d"),
    host.readClientTokens(),
  ]);
  const uniqueTokens = [...new Set(tokens)];

  if (uniqueTokens.length === 0) {
    throw new Error("No Slack Desktop client token found. Open Slack Desktop and sign in first.");
  }

  const authResults = (
    await Promise.all(
      uniqueTokens.map(async (token) => {
        try {
          const auth = await callSlackApiWithCredential<SlackAuthTestResponse>(
            host,
            token,
            cookie,
            "auth.test",
            {},
          );
          return { auth, cookie, token };
        } catch {
          return null;
        }
      }),
    )
  ).filter(
    (
      result,
    ): result is { token: string; cookie: string; auth: SlackAuthTestResponse } =>
      result !== null,
  );

  if (authResults.length === 0) {
    throw new Error(
      "Slack Desktop auth was found, but no cached client token was accepted. Open Slack Desktop and let it refresh, then retry.",
    );
  }

  const preferredWorkspace =
    workspaceOverride ??
    configuredWorkspace ??
    rootState.workspacesMeta?.selectedWorkspaceId;
  const selected = preferredWorkspace
    ? resolveAuthResultForWorkspace(preferredWorkspace, rootState, authResults)
    : authResults[0];
  const workspace = rootState.workspaces?.[selected.auth.team_id];

  return {
    cookie: selected.cookie,
    configuredDefault: configuredWorkspace === selected.auth.team_id,
    selectedInDesktop: rootState.workspacesMeta?.selectedWorkspaceId === selected.auth.team_id,
    teamDomain: workspace?.domain,
    teamId: selected.auth.team_id,
    teamName: selected.auth.team || workspace?.name || selected.auth.team_id,
    teamUrl: selected.auth.url ?? workspace?.url,
    token: selected.token,
    userId: selected.auth.user_id,
    userName: selected.auth.user,
  };
}

async function callSlackApiWithCredential<T>(
  host: SlackDesktopHost,
  token: string,
  cookie: string,
  method: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const body = new URLSearchParams();

  body.set("token", token);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      body.set(key, String(value));
    }
  }

  const response = await host.fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    body,
    headers: {
      cookie: `d=${cookie};`,
      "user-agent": "Slack Desktop",
    },
  });
  const payload = (await response.json()) as SlackApiResponse<T>;

  if (!payload.ok) {
    throw new Error(payload.error ?? "unknown_error");
  }

  return payload as T;
}

function resolveAuthResultForWorkspace(
  workspace: string,
  rootState: SlackRootState,
  validResults: Array<{ token: string; cookie: string; auth: SlackAuthTestResponse }>,
): { token: string; cookie: string; auth: SlackAuthTestResponse } {
  const normalizedWorkspace = normalizeWorkspaceSelector(workspace);
  const matches = validResults.filter((result) => {
    const metadata = rootState.workspaces?.[result.auth.team_id];
    return [result.auth.team_id, result.auth.team, metadata?.name, metadata?.domain].some(
      (value) =>
        value && normalizeWorkspaceSelector(value) === normalizedWorkspace,
    );
  });

  if (matches.length === 0) {
    throw new Error(`No authenticated Slack Desktop workspace matched "${workspace}".`);
  }

  if (matches.length > 1) {
    const labels = matches
      .map((result) => `${result.auth.team} (${result.auth.team_id})`)
      .join(", ");
    throw new Error(`Multiple authenticated workspaces matched "${workspace}": ${labels}. Use the workspace ID.`);
  }

  return matches[0];
}

function normalizeWorkspaceSelector(value: string): string {
  return value.trim().toLowerCase();
}

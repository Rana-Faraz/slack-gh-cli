import { execFile } from "node:child_process";
import { createDecipheriv, createHash, pbkdf2Sync } from "node:crypto";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ClassicLevel } from "classic-level";

const SLACK_APP_PATH = "/Applications/Slack.app";
const SLACK_DATA_DIR = join(homedir(), "Library", "Application Support", "Slack");
const LOCAL_STORAGE_DIR = join(SLACK_DATA_DIR, "Local Storage", "leveldb");
const COOKIE_DB_PATH = join(SLACK_DATA_DIR, "Cookies");
const ROOT_STATE_PATH = join(SLACK_DATA_DIR, "storage", "root-state.json");
const CLI_CONFIG_PATH = join(homedir(), ".slack", "config.json");
const SLACK_SAFE_STORAGE_SERVICES = ["Slack Safe Storage", "Chrome Safe Storage"];
const COOKIE_IV = Buffer.from("                ");

type SlackApiResponse<T> = T & {
  ok: boolean;
  error?: string;
  needed?: string;
  provided?: string;
  response_metadata?: {
    next_cursor?: string;
  };
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

type SlackCliConfig = {
  workspace?: string;
};

type SlackLocalConfig = {
  teams?: Record<
    string,
    {
      token?: string;
    }
  >;
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

type SlackDesktopCredential = Required<
  Pick<SlackDesktopAuthStatus, "appPath" | "dataDir" | "teamId" | "teamName" | "userId">
> &
  Pick<SlackDesktopAuthStatus, "teamDomain" | "teamUrl" | "userName"> & {
    token: string;
    cookie: string;
  };

let credentialPromise: Promise<SlackDesktopCredential> | undefined;
let workspaceOverride: string | undefined;

export function setSlackDesktopWorkspaceOverride(workspace?: string): void {
  const normalizedWorkspace = workspace?.trim();
  workspaceOverride = normalizedWorkspace && normalizedWorkspace.length > 0
    ? normalizedWorkspace
    : undefined;
  credentialPromise = undefined;
}

export async function openSlackDesktopLogin(): Promise<void> {
  await assertMacOS();
  await assertSlackDesktopInstalled();
  await runCommand("open", ["-a", "Slack"]);

  console.log("Opened Slack Desktop.");
  console.log("Sign in there, then run `slack auth status`.");
}

export async function lookupSlackDesktopAuth(): Promise<SlackDesktopAuthStatus> {
  if (process.platform !== "darwin") {
    return {
      available: false,
      appPath: SLACK_APP_PATH,
      dataDir: SLACK_DATA_DIR,
      warning: "Slack Desktop auth is currently supported on macOS only.",
    };
  }

  try {
    const credential = await getSlackDesktopCredential();

    return {
      available: true,
      appPath: credential.appPath,
      dataDir: credential.dataDir,
      teamId: credential.teamId,
      teamName: credential.teamName,
      teamDomain: credential.teamDomain,
      teamUrl: credential.teamUrl,
      userId: credential.userId,
      userName: credential.userName,
    };
  } catch (error) {
    return {
      available: false,
      appPath: SLACK_APP_PATH,
      dataDir: SLACK_DATA_DIR,
      warning:
        error instanceof Error
          ? error.message
          : "Could not read Slack Desktop authentication.",
    };
  }
}

export async function listSlackDesktopWorkspaces(): Promise<SlackDesktopWorkspace[]> {
  await assertMacOS();
  await assertSlackDesktopInstalled();

  const [rootState, configuredWorkspace] = await Promise.all([
    readSlackRootState(),
    readConfiguredWorkspacePreference(),
  ]);
  const validResults = await readValidSlackAuthResults();
  const workspaceIds = new Set<string>([
    ...Object.keys(rootState.workspaces ?? {}),
    ...validResults.map((result) => result.auth.team_id),
  ]);

  return [...workspaceIds]
    .map((id) => {
      const workspace = rootState.workspaces?.[id];
      const auth = validResults.find((result) => result.auth.team_id === id)?.auth;

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

export async function getCurrentSlackDesktopWorkspace(): Promise<SlackDesktopWorkspace> {
  const credential = await getSlackDesktopCredential();

  return {
    id: credential.teamId,
    name: credential.teamName,
    domain: credential.teamDomain,
    url: credential.teamUrl,
    userId: credential.userId,
    userName: credential.userName,
    selectedInDesktop: await isWorkspaceSelectedInDesktop(credential.teamId),
    configuredDefault: (await readConfiguredWorkspacePreference()) === credential.teamId,
    authenticated: true,
  };
}

export async function saveSlackDesktopWorkspacePreference(
  workspace: string,
): Promise<SlackDesktopWorkspace> {
  const selected = await resolveSlackDesktopWorkspace(workspace);
  await writeSlackCliConfig({ workspace: selected.id });
  credentialPromise = undefined;
  return {
    ...selected,
    configuredDefault: true,
  };
}

export async function clearSlackDesktopWorkspacePreference(): Promise<boolean> {
  const existingWorkspace = await readConfiguredWorkspacePreference();
  await writeSlackCliConfig({});
  credentialPromise = undefined;
  return Boolean(existingWorkspace);
}

export async function callSlackDesktopApi<T>(
  method: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const credential = await getSlackDesktopCredential();
  const body = new URLSearchParams();

  body.set("token", credential.token);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      body.set(key, String(value));
    }
  }

  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    body,
    headers: {
      cookie: `d=${credential.cookie};`,
      "user-agent": "Slack Desktop",
    },
  });

  if (!response.ok) {
    throw new Error(`Slack API request failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as SlackApiResponse<T>;

  if (!payload.ok) {
    const detail = payload.needed
      ? `${payload.error ?? "unknown_error"}; needed: ${payload.needed}`
      : payload.error ?? "unknown_error";
    throw new Error(`Slack API ${method} failed: ${detail}`);
  }

  return payload as T;
}

export async function getSlackDesktopCredential(): Promise<SlackDesktopCredential> {
  credentialPromise ??= readSlackDesktopCredential();
  return await credentialPromise;
}

async function readSlackDesktopCredential(): Promise<SlackDesktopCredential> {
  await assertMacOS();
  await assertSlackDesktopInstalled();

  const [rootState, configuredWorkspace] = await Promise.all([
    readSlackRootState(),
    readConfiguredWorkspacePreference(),
  ]);

  const preferredWorkspace =
    workspaceOverride ??
    process.env.SLACK_DESKTOP_WORKSPACE?.trim() ??
    process.env.SLACK_DESKTOP_TEAM_ID?.trim() ??
    configuredWorkspace ??
    rootState.workspacesMeta?.selectedWorkspaceId;
  const validResults = await readValidSlackAuthResults();

  if (validResults.length === 0) {
    throw new Error(
      "Slack Desktop auth was found, but no cached client token was accepted. Open Slack Desktop and let it refresh, then retry.",
    );
  }

  const selected = preferredWorkspace
    ? resolveAuthResultForWorkspace(preferredWorkspace, rootState, validResults)
    : validResults[0];
  const workspace = rootState.workspaces?.[selected.auth.team_id];

  return {
    appPath: SLACK_APP_PATH,
    dataDir: SLACK_DATA_DIR,
    token: selected.token,
    cookie: selected.cookie,
    teamId: selected.auth.team_id,
    teamName: selected.auth.team || workspace?.name || selected.auth.team_id,
    teamDomain: workspace?.domain,
    teamUrl: selected.auth.url ?? workspace?.url,
    userId: selected.auth.user_id,
    userName: selected.auth.user,
  };
}

async function readValidSlackAuthResults(): Promise<
  Array<{ token: string; cookie: string; auth: SlackAuthTestResponse }>
> {
  const [cookie, tokens] = await Promise.all([
    readSlackCookie("d"),
    readSlackClientTokens(),
  ]);
  const uniqueTokens = [...new Set(tokens)];

  if (uniqueTokens.length === 0) {
    throw new Error(
      "No Slack Desktop client token found. Open Slack Desktop and sign in first.",
    );
  }

  const authResults = await Promise.all(
    uniqueTokens.map(async (token) => {
      try {
        const auth = await callSlackApiWithCredential<SlackAuthTestResponse>(
          token,
          cookie,
          "auth.test",
          {},
        );
        return { token, cookie, auth };
      } catch {
        return null;
      }
    }),
  );

  return authResults.filter(
    (
      result,
    ): result is { token: string; cookie: string; auth: SlackAuthTestResponse } =>
      result !== null,
  );
}

async function resolveSlackDesktopWorkspace(
  workspace: string,
): Promise<SlackDesktopWorkspace> {
  const workspaces = await listSlackDesktopWorkspaces();
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
    const knownWorkspace = Object.entries(rootState.workspaces ?? {}).find(
      ([id, metadata]) =>
        [id, metadata.name, metadata.domain].some(
          (value) =>
            value && normalizeWorkspaceSelector(value) === normalizedWorkspace,
        ),
    );

    if (knownWorkspace) {
      const [teamId, metadata] = knownWorkspace;
      throw new Error(
        `Workspace "${metadata.name ?? teamId}" was found, but Slack Desktop does not currently expose a usable cached token for it. Open or reload that workspace in Slack Desktop, then retry.`,
      );
    }

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

async function callSlackApiWithCredential<T>(
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

  const response = await fetch(`https://slack.com/api/${method}`, {
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

async function readSlackRootState(): Promise<SlackRootState> {
  try {
    const raw = await readFile(ROOT_STATE_PATH, "utf8");
    return JSON.parse(raw) as SlackRootState;
  } catch {
    return {};
  }
}

async function readConfiguredWorkspacePreference(): Promise<string | undefined> {
  try {
    const raw = await readFile(CLI_CONFIG_PATH, "utf8");
    const config = JSON.parse(raw) as SlackCliConfig;
    return config.workspace?.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function writeSlackCliConfig(config: SlackCliConfig): Promise<void> {
  await mkdir(dirname(CLI_CONFIG_PATH), { recursive: true });
  await writeFile(CLI_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

async function isWorkspaceSelectedInDesktop(teamId: string): Promise<boolean> {
  const rootState = await readSlackRootState();
  return rootState.workspacesMeta?.selectedWorkspaceId === teamId;
}

async function readSlackClientTokens(): Promise<string[]> {
  return await readSlackLocalConfigTokens();
}

async function readSlackLocalConfigTokens(): Promise<string[]> {
  const tempDir = await mkdtemp(join(tmpdir(), "slack-leveldb-"));
  const copiedStorageDir = join(tempDir, "leveldb");
  const tokens = new Set<string>();
  let db: ClassicLevel<string, string> | undefined;

  try {
    await cp(LOCAL_STORAGE_DIR, copiedStorageDir, { recursive: true });

    db = new ClassicLevel(copiedStorageDir, {
      keyEncoding: "utf8",
      valueEncoding: "utf8",
    });
    await db.open();

    for await (const [key, value] of db.iterator()) {
      if (!key.endsWith("localConfig_v2")) {
        continue;
      }

      let localConfig: SlackLocalConfig;

      try {
        localConfig = parseChromiumLocalStorageJson<SlackLocalConfig>(value);
      } catch {
        continue;
      }

      for (const team of Object.values(localConfig.teams ?? {})) {
        if (team.token?.startsWith("xoxc-")) {
          tokens.add(team.token);
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Could not read Slack Desktop LevelDB token cache: ${message}`);
  } finally {
    if (db?.status === "open") {
      await db.close().catch(() => undefined);
    }

    await rm(tempDir, { recursive: true, force: true });
  }

  return [...tokens];
}

function parseChromiumLocalStorageJson<T>(value: string): T {
  const normalizedValue = value.charCodeAt(0) === 1 ? value.slice(1) : value;
  return JSON.parse(normalizedValue) as T;
}

async function readSlackCookie(name: string): Promise<string> {
  const cookieRows = await queryCookieRows(name);
  const keys = await readMacSafeStorageKeys();

  for (const row of cookieRows) {
    for (const key of keys) {
      const decrypted = decryptChromiumCookieValue(row.hostKey, row.encryptedValue, key);

      if (decrypted && (name !== "d" || decrypted.startsWith("xoxd-"))) {
        return decrypted;
      }
    }
  }

  throw new Error(`Could not decrypt Slack Desktop cookie "${name}".`);
}

async function queryCookieRows(
  name: string,
): Promise<Array<{ hostKey: string; encryptedValue: Buffer }>> {
  const sql = [
    "select host_key || char(9) || hex(encrypted_value)",
    "from cookies",
    "where host_key like '%slack.com%'",
    `and name = '${escapeSqlString(name)}'`,
    "order by last_access_utc desc;",
  ].join(" ");
  const output = await runCommand("sqlite3", [COOKIE_DB_PATH, sql]);

  return output
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((line) => {
      const [hostKey, hexValue] = line.split("\t");

      return {
        hostKey,
        encryptedValue: Buffer.from(hexValue, "hex"),
      };
    });
}

async function readMacSafeStorageKeys(): Promise<Buffer[]> {
  const keys: Buffer[] = [];

  for (const service of SLACK_SAFE_STORAGE_SERVICES) {
    try {
      const password = (await runCommand("security", [
        "find-generic-password",
        "-w",
        "-s",
        service,
      ])).trim();

      if (password.length > 0) {
        keys.push(pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1"));
      }
    } catch {
      // Try the next safe-storage service name.
    }
  }

  if (keys.length === 0) {
    throw new Error("Could not read the Slack Desktop safe-storage key from Keychain.");
  }

  return keys;
}

function decryptChromiumCookieValue(
  hostKey: string,
  encryptedValue: Buffer,
  key: Buffer,
): string | undefined {
  try {
    const encrypted =
      encryptedValue.subarray(0, 3).toString() === "v10"
        ? encryptedValue.subarray(3)
        : encryptedValue;
    const decipher = createDecipheriv("aes-128-cbc", key, COOKIE_IV);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    const value = stripCookieHostDigest(hostKey, decrypted).toString("utf8");

    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function stripCookieHostDigest(hostKey: string, decrypted: Buffer): Buffer {
  if (decrypted.length <= 32) {
    return decrypted;
  }

  const digest = decrypted.subarray(0, 32);
  const expectedDigest = Buffer.from(
    // Chromium prepends the SHA-256 host digest in newer cookie stores.
    createHashHostKey(hostKey),
    "hex",
  );

  return digest.equals(expectedDigest) ? decrypted.subarray(32) : decrypted;
}

function createHashHostKey(hostKey: string): string {
  return createHash("sha256").update(hostKey).digest("hex");
}

function normalizeWorkspaceSelector(value: string): string {
  return value.trim().toLowerCase();
}

async function assertMacOS(): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("Slack Desktop auth is currently supported on macOS only.");
  }
}

async function assertSlackDesktopInstalled(): Promise<void> {
  try {
    await access(SLACK_APP_PATH);
  } catch {
    throw new Error(`Slack Desktop was not found at ${SLACK_APP_PATH}.`);
  }
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}

function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        reject(
          new Error(
            stderr.trim().length > 0
              ? stderr.trim()
              : `${command} ${args.join(" ")} failed.`,
          ),
        );
        return;
      }

      resolve(stdout);
    });
  });
}

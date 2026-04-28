import { execFile } from "node:child_process";
import { pbkdf2Sync } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { DesktopHost } from "./desktop-host.js";
import {
  decryptDesktopCookieValue,
  readLocalConfigTokensFromLevelDb,
} from "./desktop-store.js";

const SLACK_APP_PATH = "/Applications/Slack.app";
const SLACK_DATA_DIR = join(homedir(), "Library", "Application Support", "Slack");
const LOCAL_STORAGE_DIR = join(SLACK_DATA_DIR, "Local Storage", "leveldb");
const COOKIE_DB_PATH = join(SLACK_DATA_DIR, "Cookies");
const ROOT_STATE_PATH = join(SLACK_DATA_DIR, "storage", "root-state.json");
const CLI_CONFIG_PATH = join(homedir(), ".slack", "config.json");
const SLACK_SAFE_STORAGE_SERVICES = ["Slack Safe Storage", "Chrome Safe Storage"];

type SlackCliConfig = {
  workspace?: string;
};

/**
 * Creates the macOS adapter that reads Slack Desktop's local session.
 */
export function createMacSlackDesktopHost(): DesktopHost {
  return {
    appPath: SLACK_APP_PATH,
    dataDir: SLACK_DATA_DIR,
    unsupportedMessage: "Slack Desktop auth is currently supported on macOS only.",
    isSupported: () => process.platform === "darwin",
    assertInstalled: async () => {
      try {
        await access(SLACK_APP_PATH);
      } catch {
        throw new Error(`Slack Desktop was not found at ${SLACK_APP_PATH}.`);
      }
    },
    openApp: async () => {
      await runCommand("open", ["-a", "Slack"]);
    },
    readRootState: async () => {
      try {
        const raw = await readFile(ROOT_STATE_PATH, "utf8");
        return JSON.parse(raw) as unknown;
      } catch {
        return {};
      }
    },
    readWorkspacePreference: async () => {
      try {
        const raw = await readFile(CLI_CONFIG_PATH, "utf8");
        const config = JSON.parse(raw) as SlackCliConfig;
        return config.workspace?.trim() || undefined;
      } catch {
        return undefined;
      }
    },
    writeWorkspacePreference: async (config: unknown) => {
      await mkdir(dirname(CLI_CONFIG_PATH), { recursive: true });
      await writeFile(CLI_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
    },
    readClientTokens: async () => {
      try {
        return await readLocalConfigTokensFromLevelDb(LOCAL_STORAGE_DIR);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        throw new Error(`Could not read Slack Desktop LevelDB token cache: ${message}`);
      }
    },
    readCookie,
    fetch: async (input, init) => await fetch(input, init),
  };
}

async function readCookie(name: string): Promise<string> {
  const cookieRows = await queryCookieRows(name);
  const keys = await readMacSafeStorageKeys();

  for (const row of cookieRows) {
    for (const key of keys) {
      const decrypted = decryptDesktopCookieValue(row.hostKey, row.encryptedValue, key);

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

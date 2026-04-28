import { createDecipheriv, createHash } from "node:crypto";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClassicLevel } from "classic-level";

const COOKIE_IV = Buffer.from("                ");

type SlackLocalConfig = {
  teams?: Record<
    string,
    {
      token?: string;
    }
  >;
};

export async function readSlackLocalConfigTokensFromLevelDb(
  localStorageDir: string,
  options: {
    tempRoot?: string;
    tempPrefix?: string;
  } = {},
): Promise<string[]> {
  const tempDir = await mkdtemp(
    join(options.tempRoot ?? tmpdir(), options.tempPrefix ?? "slack-leveldb-"),
  );
  const copiedStorageDir = join(tempDir, "leveldb");
  const tokens = new Set<string>();
  let db: ClassicLevel<string, string> | undefined;

  try {
    await cp(localStorageDir, copiedStorageDir, { recursive: true });

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
  } finally {
    if (db?.status === "open") {
      await db.close().catch(() => undefined);
    }

    await rm(tempDir, { recursive: true, force: true });
  }

  return [...tokens];
}

export function parseChromiumLocalStorageJson<T>(value: string): T {
  const normalizedValue = value.charCodeAt(0) === 1 ? value.slice(1) : value;
  return JSON.parse(normalizedValue) as T;
}

export function decryptChromiumCookieValue(
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
  const expectedDigest = Buffer.from(createHashHostKey(hostKey), "hex");

  return digest.equals(expectedDigest) ? decrypted.subarray(32) : decrypted;
}

function createHashHostKey(hostKey: string): string {
  return createHash("sha256").update(hostKey).digest("hex");
}

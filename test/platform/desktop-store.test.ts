import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClassicLevel } from "classic-level";
import { afterEach, describe, expect, it } from "vitest";
import {
  decryptDesktopCookieValue,
  parseDesktopLocalStorageJson,
  readLocalConfigTokensFromLevelDb,
} from "../../src/platform/desktop-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("desktop-store", () => {
  it("parses desktop local storage JSON values with or without the binary prefix", () => {
    expect(parseDesktopLocalStorageJson<{ ok: boolean }>('\u0001{"ok":true}')).toEqual({
      ok: true,
    });
    expect(parseDesktopLocalStorageJson<{ ok: boolean }>('{"ok":true}')).toEqual({
      ok: true,
    });
  });

  it("reads Slack client tokens from a copied LevelDB fixture", async () => {
    const fixtureRoot = await makeTempDir("slack-leveldb-fixture-");
    const levelDbDir = join(fixtureRoot, "leveldb");
    const db = new ClassicLevel(levelDbDir, {
      keyEncoding: "utf8",
      valueEncoding: "utf8",
    });
    await db.open();
    await db.put(
      "_https://app.slack.com\u0000\u0001localConfig_v2",
      `\u0001${JSON.stringify({
        teams: {
          T_ALPHA: { token: "xoxc-alpha-token" },
          T_BETA: { token: "xoxc-beta-token" },
          T_INVALID: { token: "not-a-client-token" },
        },
      })}`,
    );
    await db.put("_https://app.slack.com\u0000\u0001other", '{"ignored":true}');
    await db.close();

    await expect(
      readLocalConfigTokensFromLevelDb(levelDbDir, {
        tempRoot: await makeTempDir("slack-leveldb-copy-"),
      }),
    ).resolves.toEqual(["xoxc-alpha-token", "xoxc-beta-token"]);
  });

  it("skips malformed localConfig values", async () => {
    const fixtureRoot = await makeTempDir("slack-leveldb-malformed-");
    const levelDbDir = join(fixtureRoot, "leveldb");
    const db = new ClassicLevel(levelDbDir, {
      keyEncoding: "utf8",
      valueEncoding: "utf8",
    });
    await db.open();
    await db.put("_https://app.slack.com\u0000\u0001localConfig_v2", "{not json");
    await db.close();

    await expect(readLocalConfigTokensFromLevelDb(levelDbDir)).resolves.toEqual([]);
  });

  it("decrypts desktop cookie values with host digests", () => {
    const hostKey = ".example.test";
    const key = randomBytes(16);
    const value = "xoxd-cookie-value";
    const encrypted = encryptDesktopCookieValue(hostKey, value, key);

    expect(decryptDesktopCookieValue(hostKey, encrypted, key)).toBe(value);
    expect(decryptDesktopCookieValue(".other.test", encrypted, key)).not.toBe(value);
  });
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function encryptDesktopCookieValue(
  hostKey: string,
  value: string,
  key: Buffer,
): Buffer {
  const hostDigest = createHash("sha256").update(hostKey).digest();
  const cipher = createCipheriv("aes-128-cbc", key, Buffer.from("                "));
  const encrypted = Buffer.concat([
    cipher.update(Buffer.concat([hostDigest, Buffer.from(value, "utf8")])),
    cipher.final(),
  ]);

  return Buffer.concat([Buffer.from("v10"), encrypted]);
}

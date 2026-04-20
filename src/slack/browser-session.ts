import { basename, join } from "node:path";
import { cp, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import {
  getSlackBrowserProfileDir,
  resolveSlackBrowserExecutablePath,
  SLACK_WEB_URL,
} from "./browser-config.js";

const PROFILE_LOCK_FILES = new Set([
  "SingletonLock",
  "SingletonCookie",
  "SingletonSocket",
  "DevToolsActivePort",
]);

export type SlackSessionOptions = {
  headless?: boolean;
  useProfileCopy?: boolean;
};

type SlackSessionMeta = {
  browserPath: string;
  profileDir: string;
  effectiveProfileDir: string;
};

export async function withSlackBrowserContext<T>(
  options: SlackSessionOptions,
  callback: (context: BrowserContext, meta: SlackSessionMeta) => Promise<T>,
): Promise<T> {
  const browserPath = await resolveSlackBrowserExecutablePath();
  const profileDir = getSlackBrowserProfileDir();
  const useProfileCopy = options.useProfileCopy ?? true;
  const effectiveProfileDir = useProfileCopy
    ? await createProfileCopy(profileDir)
    : profileDir;

  if (!useProfileCopy) {
    await mkdir(profileDir, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(effectiveProfileDir, {
    executablePath: browserPath,
    headless: options.headless ?? true,
  });

  try {
    return await callback(context, {
      browserPath,
      profileDir,
      effectiveProfileDir,
    });
  } finally {
    await context.close().catch(() => {});

    if (useProfileCopy) {
      await rm(join(effectiveProfileDir, ".."), {
        recursive: true,
        force: true,
      }).catch(() => {});
    }
  }
}

export async function getSlackLandingPage(context: BrowserContext): Promise<Page> {
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto(SLACK_WEB_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  return page;
}

async function createProfileCopy(profileDir: string): Promise<string> {
  const tempRoot = await mkdtemp(join(tmpdir(), "slack-cli-"));
  const copiedProfileDir = join(tempRoot, "profile");

  await cp(profileDir, copiedProfileDir, {
    recursive: true,
    filter: (source) => !PROFILE_LOCK_FILES.has(basename(source)),
  });

  return copiedProfileDir;
}

import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";
import {
  getSlackBrowserProfileDir,
  getSlackBrowserRuntimeWarning,
  resolveSlackBrowserExecutablePath,
  SLACK_WEB_URL,
} from "../slack/browser-config.js";
const LOGIN_TIMEOUT_MS = 15 * 60 * 1000;

export type BrowserAuthStatus = {
  available: boolean;
  browserPath: string;
  profileDir: string;
  teamId?: string;
  teamName?: string;
  teamDomain?: string;
  teamUrl?: string;
  userId?: string;
  userName?: string;
  warning?: string;
};

export async function runSlackLogin(): Promise<void> {
  const browserPath = await resolveSlackBrowserExecutablePath();
  const profileDir = getSlackBrowserProfileDir();
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: browserPath,
    headless: false,
  });
  const runtimeWarning = await getSlackBrowserRuntimeWarning(browserPath);

  await mkdir(profileDir, { recursive: true });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    console.log("Opening Slack in a persistent browser profile.");
    console.log(`Browser: ${browserPath}`);
    console.log(`Profile: ${profileDir}`);
    console.log("Complete Slack sign-in in the opened browser window.");

    if (runtimeWarning) {
      console.warn(`Warning: ${runtimeWarning}`);
    }

    await page.goto(SLACK_WEB_URL, {
      waitUntil: "domcontentloaded",
    });
    await waitForSlackWorkspace(context);
    const sessionInfo = await extractSlackSessionInfo(context);
    await writeBrowserSessionMetadata(browserPath, profileDir, sessionInfo);

    console.log("Slack browser session is ready.");
  } finally {
    await context.close();
  }
}

export async function lookupSlackBrowserAuth(): Promise<BrowserAuthStatus> {
  const browserPath = await resolveSlackBrowserExecutablePath();
  const profileDir = getSlackBrowserProfileDir();
  const runtimeWarning = await getSlackBrowserRuntimeWarning(browserPath);

  try {
    const entries = await readdir(profileDir);

    if (entries.length === 0) {
      return {
        available: false,
        browserPath,
        profileDir,
        warning: runtimeWarning,
      };
    }

    try {
      const sessionInfo = await inspectSlackBrowserSession(
        browserPath,
        profileDir,
      );

      return {
        available: true,
        browserPath,
        profileDir,
        ...sessionInfo,
        warning: runtimeWarning,
      };
    } catch (error) {
      const metadata = await readBrowserSessionMetadata(profileDir);

      return {
        available: true,
        browserPath,
        profileDir,
        ...metadata,
        warning: [
          runtimeWarning,
          error instanceof Error
            ? `Live browser inspection failed: ${error.message}`
            : "Live browser inspection failed.",
        ]
          .filter((value): value is string => Boolean(value))
          .join(" "),
      };
    }
  } catch {
    return {
      available: false,
      browserPath,
      profileDir,
      warning: runtimeWarning,
    };
  }
}

async function waitForSlackWorkspace(
  context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < LOGIN_TIMEOUT_MS) {
    if (hasActiveSlackWorkspacePage(context)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    "Timed out waiting for Slack Web sign-in. Re-run `auth login` and complete sign-in in the opened browser.",
  );
}

async function inspectSlackBrowserSession(
  browserPath: string,
  profileDir: string,
): Promise<
  Omit<
    BrowserAuthStatus,
    "available" | "browserPath" | "profileDir" | "warning"
  >
> {
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: browserPath,
    headless: true,
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());

    await page.goto(SLACK_WEB_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    await waitForSlackWorkspace(context);
    return await extractSlackSessionInfo(context);
  } finally {
    await context.close();
  }
}

function hasActiveSlackWorkspacePage(
  context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
): boolean {
  return context.pages().some((page) => {
    const url = page.url();
    return /^https:\/\/app\.slack\.com\/client\/T[A-Z0-9]+/.test(url);
  });
}

async function writeBrowserSessionMetadata(
  browserPath: string,
  profileDir: string,
  sessionInfo: Omit<
    BrowserAuthStatus,
    "available" | "browserPath" | "profileDir" | "warning"
  >,
): Promise<void> {
  const metadataPath = join(profileDir, "slack-cli-session.json");

  await writeFile(
    metadataPath,
    JSON.stringify(
      {
        browserPath,
        profileDir,
        slackUrl: SLACK_WEB_URL,
        updatedAt: new Date().toISOString(),
        ...sessionInfo,
      },
      null,
      2,
    ),
  );
}

async function extractSlackSessionInfo(
  context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
): Promise<
  Omit<
    BrowserAuthStatus,
    "available" | "browserPath" | "profileDir" | "warning"
  >
> {
  const page = context
    .pages()
    .find((candidate) =>
      /^https:\/\/app\.slack\.com\/client\/T[A-Z0-9]+/.test(candidate.url()),
    );

  if (!page) {
    return {};
  }

  return await page.evaluate(() => {
    const rawConfig = localStorage.getItem("localConfig_v2");
    const parsedConfig = rawConfig ? JSON.parse(rawConfig) : null;
    const lastActiveTeamId = parsedConfig?.lastActiveTeamId;
    const team = lastActiveTeamId
      ? parsedConfig?.teams?.[lastActiveTeamId]
      : null;
    const userButton = document.querySelector('[data-qa="user-button"]');
    const userLabel = userButton?.getAttribute("aria-label") ?? "";
    const userName = userLabel.startsWith("User: ")
      ? userLabel.slice("User: ".length).trim()
      : undefined;

    return {
      teamId: team?.id,
      teamName: team?.name,
      teamDomain: team?.domain,
      teamUrl: team?.url,
      userId: team?.user_id,
      userName,
    };
  });
}

async function readBrowserSessionMetadata(
  profileDir: string,
): Promise<Partial<BrowserAuthStatus>> {
  try {
    const metadataPath = join(profileDir, "slack-cli-session.json");
    const raw = await readFile(metadataPath, "utf8");
    return JSON.parse(raw) as Partial<BrowserAuthStatus>;
  } catch {
    return {};
  }
}

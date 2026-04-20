import { execFile } from "node:child_process";
import { access, constants as fsConstants } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { APP_CLI_NAME } from "../constants/app.js";

const MACOS_BROWSER_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Arc.app/Contents/MacOS/Arc",
];

const WINDOWS_BROWSER_RELATIVE_PATHS = [
  ["Google", "Chrome", "Application", "chrome.exe"],
  ["Chromium", "Application", "chrome.exe"],
  ["Microsoft", "Edge", "Application", "msedge.exe"],
  ["BraveSoftware", "Brave-Browser", "Application", "brave.exe"],
];

const LINUX_BROWSER_COMMANDS = [
  "google-chrome-stable",
  "google-chrome",
  "chromium-browser",
  "chromium",
  "microsoft-edge-stable",
  "microsoft-edge",
  "brave-browser",
  "brave-browser-stable",
];

export const SLACK_WEB_URL = "https://app.slack.com/client";

export async function resolveSlackBrowserExecutablePath(): Promise<string> {
  const configuredPath = process.env.SLACK_BROWSER_PATH?.trim();

  if (configuredPath) {
    await assertExecutableExists(configuredPath, "SLACK_BROWSER_PATH");
    return configuredPath;
  }

  const detectedPath = await detectSlackBrowserExecutablePath();

  if (detectedPath) {
    return detectedPath;
  }

  throw new Error(
    [
      "Could not find a supported Chrome-compatible browser automatically.",
      "Install Google Chrome, Chromium, Microsoft Edge, Brave, or set SLACK_BROWSER_PATH explicitly.",
    ].join(" "),
  );
}

export function getSlackBrowserProfileDir(): string {
  return (
    process.env.SLACK_BROWSER_PROFILE_DIR?.trim() ??
    join(homedir(), `.${APP_CLI_NAME}`, "chrome-profile")
  );
}

export async function getSlackBrowserRuntimeWarning(
  browserPath: string,
): Promise<string | undefined> {
  if (process.platform !== "darwin") {
    return undefined;
  }

  if (!(await isAppleSiliconMac())) {
    return undefined;
  }

  if (process.arch === "x64") {
    return [
      "This CLI is running under Rosetta on Apple Silicon.",
      "That can make Slack login and browser automation feel very slow.",
      "Use a native arm64 Node.js install and re-link `slack-cli`.",
    ].join(" ");
  }

  const browserArchitectures = await readMacBinaryArchitectures(browserPath);

  if (browserArchitectures.length > 0 && !browserArchitectures.includes("arm64")) {
    return [
      `The configured browser at ${browserPath} does not report an arm64 slice.`,
      "On Apple Silicon, use a native arm64 Chrome-compatible browser build.",
    ].join(" ");
  }

  return undefined;
}

async function detectSlackBrowserExecutablePath(): Promise<string | undefined> {
  if (process.platform === "darwin") {
    return await findExistingExecutable(MACOS_BROWSER_CANDIDATES);
  }

  if (process.platform === "win32") {
    return await detectWindowsBrowserExecutablePath();
  }

  return await detectUnixBrowserExecutablePath();
}

async function detectWindowsBrowserExecutablePath(): Promise<string | undefined> {
  const roots = [
    process.env.PROGRAMFILES,
    process.env["PROGRAMFILES(X86)"],
    process.env.LOCALAPPDATA,
  ].filter((value): value is string => Boolean(value));

  const candidates = roots.flatMap((root) =>
    WINDOWS_BROWSER_RELATIVE_PATHS.map((relativePath) => join(root, ...relativePath)),
  );

  return await findExistingExecutable(candidates);
}

async function detectUnixBrowserExecutablePath(): Promise<string | undefined> {
  for (const command of LINUX_BROWSER_COMMANDS) {
    const resolvedPath = await resolveCommandFromPath(command);

    if (resolvedPath) {
      return resolvedPath;
    }
  }

  return undefined;
}

async function findExistingExecutable(candidates: string[]): Promise<string | undefined> {
  for (const candidate of candidates) {
    if (await executableExists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function assertExecutableExists(path: string, label: string): Promise<void> {
  if (!(await executableExists(path))) {
    throw new Error(`${label} executable was not found at ${path}.`);
  }
}

async function executableExists(path: string): Promise<boolean> {
  try {
    await access(path, process.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveCommandFromPath(command: string): Promise<string | undefined> {
  try {
    const output = await runCommand("which", [command]);
    const resolvedPath = output.trim();
    return resolvedPath.length > 0 ? resolvedPath : undefined;
  } catch {
    return undefined;
  }
}

async function isAppleSiliconMac(): Promise<boolean> {
  try {
    const output = await runCommand("sysctl", ["-in", "hw.optional.arm64"]);
    return output.trim() === "1";
  } catch {
    return false;
  }
}

async function readMacBinaryArchitectures(path: string): Promise<string[]> {
  try {
    const output = await runCommand("lipo", ["-archs", path]);
    return output
      .trim()
      .split(/\s+/)
      .filter((value) => value.length > 0);
  } catch {
    return [];
  }
}

function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(stdout);
    });
  });
}

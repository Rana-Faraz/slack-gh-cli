import { execFile } from "node:child_process";
import { access, constants as fsConstants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { APP_CLI_NAME } from "../constants/app.js";

const DEFAULT_MACOS_CHROME_PATH =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export const SLACK_WEB_URL = "https://app.slack.com/client";

export async function resolveSlackBrowserExecutablePath(): Promise<string> {
  const configuredPath = process.env.SLACK_BROWSER_PATH?.trim();

  if (configuredPath) {
    await assertExecutableExists(configuredPath, "SLACK_BROWSER_PATH");
    return configuredPath;
  }

  if (process.platform === "darwin") {
    await assertExecutableExists(DEFAULT_MACOS_CHROME_PATH, "Google Chrome");
    return DEFAULT_MACOS_CHROME_PATH;
  }

  throw new Error(
    "Set SLACK_BROWSER_PATH to a Chrome-compatible browser executable on this platform.",
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

function assertExecutableExists(path: string, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    access(path, fsConstants.X_OK, (error) => {
      if (error) {
        reject(new Error(`${label} executable was not found at ${path}.`));
        return;
      }

      resolve();
    });
  });
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

import { Command } from "commander";
import { lookupSlackBrowserAuth, runSlackLogin } from "../auth/browser.js";
import { lookupSlackCredential } from "../auth/credentials.js";
import type { CredentialSource } from "../auth/types.js";

export function registerAuthCommands(program: Command): void {
  const auth = program
    .command("auth")
    .description("Manage local Slack authentication.");

  auth
    .command("login")
    .description("Open Slack Web in a persistent browser profile for local CLI use.")
    .action(async () => {
      await runSlackLogin();
    });

  auth
    .command("status")
    .description("Show whether local Slack auth is available.")
    .action(async () => {
      const result = await lookupSlackCredential();
      const browserAuth = await lookupSlackBrowserAuth();

      if (result.credential || browserAuth.available) {
        console.log("Slack authentication is available.");

        if (result.credential) {
          console.log(`Token source: ${formatCredentialSource(result.credential.source)}`);
          console.log(`Token storage format: ${result.credential.storageFormat}`);

          if (result.credential.teamName || result.credential.teamId) {
            console.log(
              `Workspace: ${result.credential.teamName ?? result.credential.teamId}`,
            );
          }

          if (result.credential.userId) {
            console.log(`User ID: ${result.credential.userId}`);
          }

          if (result.credential.scopes && result.credential.scopes.length > 0) {
            console.log(`Scopes: ${result.credential.scopes.join(", ")}`);
          }

          if (result.credential.expiresAt) {
            console.log(`Expires at: ${result.credential.expiresAt}`);
          }
        }

        console.log(`Browser profile: ${browserAuth.profileDir}`);
        console.log(`Browser executable: ${browserAuth.browserPath}`);

        if (browserAuth.userName) {
          console.log(`Browser user: ${browserAuth.userName}`);
        }

        if (browserAuth.userId) {
          console.log(`Browser user ID: ${browserAuth.userId}`);
        }

        if (browserAuth.teamName || browserAuth.teamId) {
          console.log(`Browser workspace: ${browserAuth.teamName ?? browserAuth.teamId}`);
        }

        if (browserAuth.teamId) {
          console.log(`Browser workspace ID: ${browserAuth.teamId}`);
        }

        if (browserAuth.teamDomain) {
          console.log(`Browser workspace domain: ${browserAuth.teamDomain}`);
        }

        if (browserAuth.teamUrl) {
          console.log(`Browser workspace URL: ${browserAuth.teamUrl}`);
        }
      } else {
        console.log("No Slack auth found.");
        console.log("Checked:");

        for (const source of result.checked) {
          console.log(`- ${formatCredentialSource(source)}`);
        }

        console.log(`- browser profile ${browserAuth.profileDir}`);
        console.log(
          "Next step: run `npm run dev -- auth login` or provide SLACK_GH_TOKEN for local testing.",
        );

        process.exitCode = 1;
      }

      for (const warning of result.warnings) {
        console.warn(`Warning: ${warning}`);
      }

      if (browserAuth.warning) {
        console.warn(`Warning: ${browserAuth.warning}`);
      }
    });
}

function formatCredentialSource(source: CredentialSource): string {
  if (source.kind === "env") {
    return `environment variable ${source.variable}`;
  }

  const backendLabel = source.backendName ?? "OS credential store";
  return `${backendLabel} item service="${source.service}" account="${source.account}"`;
}

import {
  deletePassword,
  getKeyring,
  getPassword,
  initBackend,
  setPassword,
} from "cross-keychain";
import type {
  CredentialLookupResult,
  CredentialRecord,
  SecureStoreCredentialSource,
  StoredSlackCredential,
} from "./types.js";
import {
  DEFAULT_CREDENTIAL_ACCOUNT,
  DEFAULT_CREDENTIAL_SERVICE,
} from "../constants/app.js";
import { formatUnknownError } from "../lib/utils.js";

export const ENV_TOKEN_NAME = "SLACK_GH_TOKEN";

let secureBackendReady = false;

export async function lookupSlackCredential(): Promise<CredentialLookupResult> {
  const checked: CredentialLookupResult["checked"] = [];
  const warnings: string[] = [];

  const envSource = {
    kind: "env" as const,
    variable: ENV_TOKEN_NAME,
  };

  checked.push(envSource);

  const envToken = process.env[ENV_TOKEN_NAME]?.trim();

  if (envToken) {
    return {
      credential: {
        accessToken: envToken,
        source: envSource,
        storageFormat: "plain-text",
      },
      checked,
      warnings,
    };
  }

  const secureStoreSource = await getSecureStoreSource();
  checked.push(secureStoreSource);

  try {
    const secret = await readSecureStoreSecret(secureStoreSource);

    if (!secret) {
      return {
        credential: null,
        checked,
        warnings,
      };
    }

    const parsed = parseStoredCredential(secret, secureStoreSource);

    if (parsed.warning) {
      warnings.push(parsed.warning);
    }

    return {
      credential: parsed.credential,
      checked,
      warnings,
    };
  } catch (error) {
    warnings.push(formatSecureStoreError(error));

    return {
      credential: null,
      checked,
      warnings,
    };
  }
}

export async function storeSlackCredential(
  credential: StoredSlackCredential,
): Promise<SecureStoreCredentialSource> {
  const source = await getSecureStoreSource();
  const secret = JSON.stringify(credential);

  await setPassword(source.service, source.account, secret);

  return source;
}

export async function deleteSlackCredential(): Promise<boolean> {
  const source = await getSecureStoreSource();
  const existingSecret = await readSecureStoreSecret(source);

  if (!existingSecret) {
    return false;
  }

  await deletePassword(source.service, source.account);
  return true;
}

async function readSecureStoreSecret(
  source: SecureStoreCredentialSource,
): Promise<string | null> {
  return await getPassword(source.service, source.account);
}

async function getSecureStoreSource(): Promise<SecureStoreCredentialSource> {
  await ensureSecureStoreBackend();

  const backend = await getKeyring();
  const { service, account } = getCredentialStoreLocation();

  return {
    kind: "secure-store",
    service,
    account,
    backendId: backend.id,
    backendName: backend.name,
  };
}

async function ensureSecureStoreBackend(): Promise<void> {
  if (secureBackendReady) {
    return;
  }

  await initBackend((backend) => backend.id !== "file" && backend.id !== "null");
  secureBackendReady = true;
}

export function getCredentialStoreLocation(): { service: string; account: string } {
  return {
    service: process.env.SLACK_GH_KEYCHAIN_SERVICE ?? DEFAULT_CREDENTIAL_SERVICE,
    account: process.env.SLACK_GH_KEYCHAIN_ACCOUNT ?? DEFAULT_CREDENTIAL_ACCOUNT,
  };
}

function parseStoredCredential(
  secret: string,
  source: SecureStoreCredentialSource,
): { credential: CredentialRecord; warning?: string } {
  const trimmed = secret.trim();

  try {
    const parsed = JSON.parse(trimmed) as Partial<StoredSlackCredential>;

    if (
      parsed.version === 1 &&
      typeof parsed.accessToken === "string" &&
      parsed.accessToken.length > 0
    ) {
      return {
        credential: {
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
          expiresAt: parsed.expiresAt,
          scopes: parsed.scopes,
          userId: parsed.userId,
          teamId: parsed.teamId,
          teamName: parsed.teamName,
          installedAt: parsed.installedAt,
          source,
          storageFormat: "json",
        },
      };
    }
  } catch {
    // Fall through to plain-text token compatibility.
  }

  return {
    credential: {
      accessToken: trimmed,
      source,
      storageFormat: "plain-text",
    },
    warning: "Stored credential is plain text; re-run auth login to upgrade it to structured storage.",
  };
}

function formatSecureStoreError(error: unknown): string {
  return formatUnknownError(error, "Secure credential store lookup failed");
}

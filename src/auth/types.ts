export type EnvCredentialSource = {
  kind: "env";
  variable: string;
};

export type SecureStoreCredentialSource = {
  kind: "secure-store";
  service: string;
  account: string;
  backendId?: string;
  backendName?: string;
};

export type CredentialSource = EnvCredentialSource | SecureStoreCredentialSource;

export type StoredSlackCredential = {
  version: 1;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
  userId?: string;
  teamId?: string;
  teamName?: string;
  installedAt: string;
};

export type CredentialRecord = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
  userId?: string;
  teamId?: string;
  teamName?: string;
  installedAt?: string;
  source: CredentialSource;
  storageFormat: "plain-text" | "json";
};

export type CredentialLookupResult = {
  credential: CredentialRecord | null;
  checked: CredentialSource[];
  warnings: string[];
};

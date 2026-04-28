import type { DesktopHost } from "../platform/desktop-host.js";
import type {
  AuthTestResult,
  WorkspaceApiResponse,
  WorkspaceCredential,
  WorkspaceRequestParams,
} from "./types.js";

/**
 * Sends Slack Web requests with credentials recovered from the desktop session.
 */
export class WorkspaceApiClient {
  constructor(private readonly host: DesktopHost) {}

  /**
   * Checks whether a cached desktop token is accepted for a workspace.
   */
  async testToken(token: string, cookie: string): Promise<AuthTestResult> {
    return await this.requestWithToken<AuthTestResult>(token, cookie, "auth.test", {});
  }

  /**
   * Calls a Slack Web method using the selected workspace credential.
   */
  async request<T>(
    credential: WorkspaceCredential,
    method: string,
    params: WorkspaceRequestParams,
  ): Promise<T> {
    return await this.requestWithToken<T>(
      credential.token,
      credential.cookie,
      method,
      params,
    );
  }

  private async requestWithToken<T>(
    token: string,
    cookie: string,
    method: string,
    params: WorkspaceRequestParams,
  ): Promise<T> {
    const body = new URLSearchParams();

    body.set("token", token);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body.set(key, String(value));
      }
    }

    const response = await this.host.fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      body,
      headers: {
        cookie: `d=${cookie};`,
        "user-agent": "Slack Desktop",
      },
    });
    const payload = (await response.json()) as WorkspaceApiResponse<T>;

    if (!payload.ok) {
      throw new Error(payload.error ?? "unknown_error");
    }

    return payload as T;
  }
}

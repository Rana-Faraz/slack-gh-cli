import type { DesktopRootState } from "../platform/desktop-host.js";
import type { AuthenticatedWorkspace, DesktopWorkspace } from "./types.js";

/**
 * Normalizes human-entered workspace selectors.
 */
export function normalizeWorkspaceSelector(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Finds a workspace row from ID, domain, name, or partial selector.
 */
export function selectCatalogWorkspace(
  workspaces: DesktopWorkspace[],
  workspace: string,
): DesktopWorkspace {
  const normalizedWorkspace = normalizeWorkspaceSelector(workspace);
  const exactMatches = workspaces.filter((candidate) =>
    [candidate.id, candidate.domain, candidate.name].some(
      (value) => value && normalizeWorkspaceSelector(value) === normalizedWorkspace,
    ),
  );
  const matches =
    exactMatches.length > 0
      ? exactMatches
      : workspaces.filter((candidate) =>
          [candidate.id, candidate.domain, candidate.name].some((value) =>
            value
              ? normalizeWorkspaceSelector(value).includes(normalizedWorkspace)
              : false,
          ),
        );

  if (matches.length === 0) {
    throw new Error(`No Slack Desktop workspace found matching "${workspace}".`);
  }

  const authenticatedMatches = matches.filter((candidate) => candidate.authenticated);

  if (authenticatedMatches.length === 1) {
    return authenticatedMatches[0];
  }

  if (matches.length === 1) {
    const match = matches[0];

    if (!match.authenticated) {
      throw new Error(
        `Workspace "${match.name}" was found, but Slack Desktop does not have a usable session token for it.`,
      );
    }

    return match;
  }

  const labels = matches.map((candidate) => `${candidate.name} (${candidate.id})`).join(", ");
  throw new Error(`Multiple workspaces matched "${workspace}": ${labels}. Use the workspace ID.`);
}

/**
 * Finds the authenticated workspace selected by command, preference, or desktop state.
 */
export function selectAuthenticatedWorkspace(
  workspace: string,
  rootState: DesktopRootState,
  candidates: AuthenticatedWorkspace[],
): AuthenticatedWorkspace {
  const normalizedWorkspace = normalizeWorkspaceSelector(workspace);
  const matches = candidates.filter((candidate) => {
    const metadata = rootState.workspaces?.[candidate.auth.team_id];
    return [
      candidate.auth.team_id,
      candidate.auth.team,
      metadata?.name,
      metadata?.domain,
    ].some((value) => value && normalizeWorkspaceSelector(value) === normalizedWorkspace);
  });

  if (matches.length === 0) {
    throw new Error(`No authenticated Slack Desktop workspace matched "${workspace}".`);
  }

  if (matches.length > 1) {
    const labels = matches
      .map((candidate) => `${candidate.auth.team} (${candidate.auth.team_id})`)
      .join(", ");
    throw new Error(`Multiple authenticated workspaces matched "${workspace}": ${labels}. Use the workspace ID.`);
  }

  return matches[0];
}

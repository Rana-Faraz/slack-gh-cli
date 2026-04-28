/**
 * Options shared by commands that can be scoped to a workspace.
 */
export type WorkspaceScopedOptions = {
  workspace?: string;
};

/**
 * Parses a positive integer command option and raises a CLI-friendly error.
 */
export function parsePositiveIntegerOption(name: string, value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid ${name}: ${value}`);
  }

  return parsed;
}

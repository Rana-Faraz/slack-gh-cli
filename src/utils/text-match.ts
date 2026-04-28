/**
 * Normalizes free-form human input for exact comparisons.
 */
export function normalizeHumanText(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Splits a search query into stable alphanumeric tokens.
 */
export function tokenizeSearchQuery(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

/**
 * Checks whether every search token appears in at least one normalized value.
 */
export function matchesSearchTokens(values: string[], tokens: string[]): boolean {
  if (tokens.length === 0) {
    return false;
  }

  const normalizedValues = values.map((value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim(),
  );

  return normalizedValues.some((value) => tokens.every((token) => value.includes(token)));
}

/**
 * Normalizes a channel selector, allowing users to include the leading '#'.
 */
export function normalizeChannelName(value: string): string {
  return normalizeHumanText(value.startsWith("#") ? value.slice(1) : value);
}

/**
 * Normalizes a user handle selector, allowing users to include the leading '@'.
 */
export function normalizeHandle(value: string): string {
  return normalizeHumanText(value.startsWith("@") ? value.slice(1) : value);
}

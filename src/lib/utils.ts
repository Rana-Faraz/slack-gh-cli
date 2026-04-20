export function normalizeDelimitedList(
  input: string,
  fallback: readonly string[] = [],
): string[] {
  const items = input
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return items.length > 0 ? items : [...fallback];
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return `${fallback}: ${error.message}`;
  }

  return `${fallback} for an unknown reason.`;
}

export function splitOptionalDelimitedList(
  input: string | undefined,
): string[] | undefined {
  if (!input) {
    return undefined;
  }

  const items = normalizeDelimitedList(input);
  return items.length > 0 ? items : undefined;
}

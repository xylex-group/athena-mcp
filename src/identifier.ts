// Allow alphanumeric, underscores, dots, and dollar signs; optional schema prefix
export const IDENTIFIER_RE =
  /^[a-zA-Z_][a-zA-Z0-9_$.]*(\.[a-zA-Z_][a-zA-Z0-9_$.]*)?$/;

export function sanitizeIdentifier(name: string, label: string): string {
  if (!IDENTIFIER_RE.test(name)) {
    throw new Error(
      `Invalid ${label}: "${name}". Only alphanumeric characters, underscores, dots, and dollar signs are allowed.`,
    );
  }
  return name;
}

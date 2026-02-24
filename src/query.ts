const WRITE_PATTERN =
  /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|REPLACE)\b/i;

export function isWriteQuery(query: string): boolean {
  return WRITE_PATTERN.test(query);
}

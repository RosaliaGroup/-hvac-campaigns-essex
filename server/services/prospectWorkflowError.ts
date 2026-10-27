/** Classify database failures without logging SQL, values, credentials, or contact data. */
export function prospectWorkflowErrorKind(error: unknown): string {
  const seen = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    if (seen.has(current)) break;
    seen.add(current);
    const item = current as { code?: unknown; errno?: unknown; cause?: unknown };
    if (item.code === "ER_NO_SUCH_TABLE" || item.errno === 1146) return "database_table_missing";
    if (item.code === "ER_BAD_FIELD_ERROR" || item.errno === 1054) return "database_column_missing";
    if (item.code === "ER_ACCESS_DENIED_ERROR" || item.errno === 1045) return "database_access_denied";
    if (item.code === "ECONNREFUSED" || item.code === "ETIMEDOUT") return "database_connection_unavailable";
    current = item.cause;
  }
  return "workflow_error";
}

/** Safe Google Business Profile API diagnostics. Never return tokens or raw bodies. */
type GoogleError = { error?: { code?: number; status?: string; message?: string; details?: Array<{ reason?: string; metadata?: Record<string, string>; violations?: Array<{ quotaMetric?: string; quotaId?: string }> }> } };
export async function describeGbpApiFailure(response: Response, operation: string): Promise<string> {
  let payload: GoogleError = {};
  try { payload = await response.json() as GoogleError; } catch { /* non-JSON errors */ }
  const error = payload.error;
  const details = error?.details ?? [];
  const reason = details.map(d => d.reason).find(Boolean) ?? error?.status ?? "UNKNOWN";
  const quota = details.map(d => d.metadata).find(m => m?.quota_metric || m?.quota_limit);
  const violation = details.flatMap(d => d.violations ?? [])[0];
  const retryAfter = response.headers.get("retry-after");
  const parts = [`${operation} failed (HTTP ${response.status}; ${String(reason).slice(0, 80)})`];
  if (quota?.quota_metric) parts.push(`quota metric: ${quota.quota_metric.slice(0, 150)}`);
  if (quota?.quota_limit) parts.push(`quota limit: ${quota.quota_limit.slice(0, 100)}`);
  if (quota?.quota_limit_value) parts.push(`reported limit: ${quota.quota_limit_value.slice(0, 30)}`);
  if (violation?.quotaMetric) parts.push(`quota metric: ${violation.quotaMetric.slice(0, 150)}`);
  if (violation?.quotaId) parts.push(`quota ID: ${violation.quotaId.slice(0, 100)}`);
  if (retryAfter && /^\d{1,5}$/.test(retryAfter)) parts.push(`retry after: ${retryAfter}s`);
  if (response.status === 429) parts.push("Check the quota for the project used by the connected OAuth client; do not repeatedly retry.");
  if (response.status === 403) parts.push("Check Business Profile API access and OAuth permissions.");
  return parts.join("; ");
}

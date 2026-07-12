/**
 * Credential safety — guarantees stored credential VALUES (access/refresh
 * tokens, API keys, client/app secrets, page tokens) never leave the server.
 *
 * The credentials-listing tRPC endpoints must return only non-secret metadata:
 * which service, whether it is connected, and which credential KEYS are
 * configured (names only — never their values, masked or otherwise). Raw and
 * encrypted values both stay server-side.
 */

export interface CredentialSummary {
  service: string;
  connected: boolean;
  /** Names of configured credential keys (e.g. ["accessToken","pageId"]). Never values. */
  configuredKeys: string[];
}

/**
 * Reduce a raw credentials map to a safe, value-free summary. Only key NAMES
 * for which a non-empty value exists are reported. No value (raw or masked) is
 * included, so this output can never leak a secret to a client.
 */
export function redactCredentials(
  service: string,
  creds: Record<string, string> | null | undefined,
): CredentialSummary {
  const configuredKeys = creds
    ? Object.keys(creds).filter((k) => typeof creds[k] === "string" && creds[k].length > 0)
    : [];
  return {
    service,
    connected: configuredKeys.length > 0,
    configuredKeys,
  };
}

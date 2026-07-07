/**
 * Generic accounting-provider contract (Task 7).
 *
 * Mechanical Enterprise is the operational CRM; the accounting provider
 * (QuickBooks Online first) is accounting-only. This interface is intentionally
 * THIN — connect/disconnect/getStatus/pushCustomer/pullCustomer, with
 * estimate/invoice typed but not yet implemented. Do not grow it speculatively.
 */

export type ProviderEnvironment = "sandbox" | "production";

/** Raised by not-yet-built provider capabilities (estimates, invoices, …). */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet`);
    this.name = "NotImplementedError";
  }
}

/** Connection metadata safe to return to the client — NEVER includes tokens. */
export interface ProviderStatus {
  connected: boolean;
  provider: string;
  environment: ProviderEnvironment;
  realmId?: string | null;
  companyName?: string | null;
  connectedAt?: Date | null;
  expiresAt?: Date | null;
  refreshExpiresAt?: Date | null;
  lastRefreshAt?: Date | null;
  lastSyncAt?: Date | null;
  status?: "connected" | "expired" | "revoked" | "error" | null;
  lastError?: string | null;
  /** True when ENCRYPTION_KEY + client credentials are present so a connect can succeed. */
  configured: boolean;
}

/** OAuth authorization-code result handed to connect(). */
export interface ConnectInput {
  code: string;
  realmId: string;
  redirectUri: string;
}

/** Normalized local customer + primary address, the input to a push. */
export interface AccountingCustomerInput {
  localId: number;
  type: "residential" | "commercial";
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  } | null;
}

/** Compact view of a QBO customer used in conflict responses (no PII beyond what's needed). */
export interface RemoteCustomerSummary {
  qbId: string;
  displayName: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  active?: boolean;
}

export type PushOutcomeKind = "created" | "linked" | "updated" | "conflict";

/** Result of a customer push. A `conflict` means "found a possible match — ask the user". */
export type PushCustomerResult =
  | { outcome: "created" | "linked" | "updated"; qbId: string; summary?: RemoteCustomerSummary }
  | { outcome: "conflict"; matchedBy: "email" | "phone" | "name"; candidate: RemoteCustomerSummary };

/** How the UI wants a conflict resolved. */
export type ConflictResolution = "link" | "update" | "skip";

export interface PullCustomerResult {
  qbId: string;
  summary: RemoteCustomerSummary;
  /** false when the QBO record is gone or inactive. */
  active: boolean;
}

export interface AccountingProvider {
  readonly name: string;
  /** Complete an OAuth connect (exchange code, persist encrypted tokens, fetch company). */
  connect(input: ConnectInput): Promise<ProviderStatus>;
  /** Revoke (best-effort) and remove the stored connection. */
  disconnect(): Promise<void>;
  /** Metadata only — never returns tokens. */
  getStatus(): Promise<ProviderStatus>;
  /**
   * Push a local customer. Runs merge protection first: if a likely match
   * exists in the provider, returns { outcome: "conflict" } instead of creating.
   * Pass a resolution to force link/update/skip after a conflict.
   */
  pushCustomer(customer: AccountingCustomerInput, resolution?: ConflictResolution): Promise<PushCustomerResult>;
  /** Fetch the current provider record for an already-linked customer. */
  pullCustomer(qbId: string): Promise<PullCustomerResult>;
  /** Not built in Task 7 — typed for the interface, throws NotImplementedError. */
  pushEstimate(...args: unknown[]): Promise<never>;
  pushInvoice(...args: unknown[]): Promise<never>;
}

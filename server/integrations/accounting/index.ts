/**
 * Accounting integration registry (Task 7).
 * QuickBooks is the only provider today; the registry keeps the router
 * provider-agnostic so a future Xero/other impl can slot in without churn.
 */
import type { AccountingProvider } from "./types";
import { quickbooksProvider } from "./quickbooks";

export type AccountingProviderName = "quickbooks";

const PROVIDERS: Record<AccountingProviderName, AccountingProvider> = {
  quickbooks: quickbooksProvider,
};

export function getAccountingProvider(name: AccountingProviderName = "quickbooks"): AccountingProvider {
  return PROVIDERS[name];
}

export * from "./types";

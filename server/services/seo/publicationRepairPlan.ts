/** Fail-closed SEO publication repair classifier.
 * Only known transient deployment/network failures are eligible for automatic
 * re-verification. Content edits, canonical changes and republishing remain gated.
 */
import type { LivePageCheck } from "./livePublicationCheck";
export type RepairPlan = { action: "retry_verification" | "manual_review" | "none"; reason: string };
export function planPublicationRepair(check: LivePageCheck): RepairPlan {
  if (check.status === "verified_live") return { action: "none", reason: "Page verified" };
  if (check.status === "unreachable" || check.httpStatus === 429 || (check.httpStatus !== null && check.httpStatus >= 500))
    return { action: "retry_verification", reason: "Temporary hosting or network failure; retry without changing content" };
  if (check.httpStatus === 404) return { action: "manual_review", reason: "Missing route requires source/deployment investigation" };
  if (!check.canonicalMatches) return { action: "manual_review", reason: "Canonical correction requires verified page metadata" };
  return { action: "manual_review", reason: "Content or redirect mismatch requires source review" };
}

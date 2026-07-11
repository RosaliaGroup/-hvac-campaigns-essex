/**
 * Pure safety helpers for the QBO composite-customer repair. No I/O. These
 * decide merge and property proposals conservatively so the (future) write mode
 * can never create duplicates or unsafe merges. Everything here is advisory: it
 * returns proposals + reasons; it never mutates.
 */

export interface CustomerIdentity {
  id: number;
  quickbooksCustomerId: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  displayName: string | null;
  companyName: string | null;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return e || null;
}

/** Last 10 digits of a phone, or null if fewer than 10 digits present. */
export function normalizePhone(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/[^0-9]/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

/** Normalize a street address for dedupe: lowercase, collapse spaces, strip punctuation. */
export function normalizeAddressKey(parts: {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string | null {
  const line1 = (parts.line1 ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!line1) return null;
  const city = (parts.city ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const zip = (parts.zip ?? "").replace(/[^0-9]/g, "").slice(0, 5);
  return [line1, city, zip].filter(Boolean).join("|");
}

export type MergeDecision =
  | { merge: false; reason: string; conflicts?: string[] }
  | { merge: true; reason: string; targetId: number; matchedBy: "qbo_id" | "email" | "phone" };

/**
 * Decide whether `a` may be safely merged into `other`. Safe ONLY when a single
 * strong identifier matches AND no OTHER identifier conflicts. Name-only matches
 * never merge. Returns the first safe match; otherwise a no-merge with reasons.
 */
export function proposeMerge(a: CustomerIdentity, other: CustomerIdentity): MergeDecision {
  if (a.id === other.id) return { merge: false, reason: "SAME_RECORD" };

  const aQbo = a.quickbooksCustomerId?.trim() || null;
  const oQbo = other.quickbooksCustomerId?.trim() || null;
  const aEmail = normalizeEmail(a.email);
  const oEmail = normalizeEmail(other.email);
  const aPhone = normalizePhone(a.phone);
  const oPhone = normalizePhone(other.phone);

  const conflicts: string[] = [];
  if (aQbo && oQbo && aQbo !== oQbo) conflicts.push(`qbo_id ${aQbo}≠${oQbo}`);
  if (aEmail && oEmail && aEmail !== oEmail) conflicts.push("email differs");
  if (aPhone && oPhone && aPhone !== oPhone) conflicts.push("phone differs");

  // Strongest: same non-null QBO customer id.
  if (aQbo && oQbo && aQbo === oQbo) {
    return { merge: true, reason: "SAME_QBO_ID", targetId: other.id, matchedBy: "qbo_id" };
  }
  // Any identifier conflict blocks weaker matches.
  if (conflicts.length) return { merge: false, reason: "IDENTIFIER_CONFLICT", conflicts };

  // Exact email match, no conflicting qbo/phone.
  if (aEmail && oEmail && aEmail === oEmail) {
    return { merge: true, reason: "EXACT_EMAIL", targetId: other.id, matchedBy: "email" };
  }
  // Exact phone match, no conflicting qbo/email.
  if (aPhone && oPhone && aPhone === oPhone) {
    return { merge: true, reason: "EXACT_PHONE", targetId: other.id, matchedBy: "phone" };
  }
  return { merge: false, reason: "NO_STRONG_MATCH" };
}

export interface PropertyRow {
  id: number;
  customerId: number;
  addressLine1: string | null;
  city: string | null;
  zip: string | null;
}

export type PropertyDecision =
  | { action: "none"; reason: string }
  | { action: "existing"; reason: string; propertyId: number }
  | { action: "create"; reason: string }
  | { action: "conflict"; reason: string; propertyId: number };

/**
 * Decide the service-property action for a parsed address, given the target
 * customer's existing properties. Never proposes a duplicate; flags a
 * same-customer property whose address differs as a conflict for review;
 * never reuses another customer's property.
 */
export function proposePropertyAction(
  customerId: number,
  parsed: { line1: string | null; city: string | null; state: string | null; zip: string | null },
  existingProperties: PropertyRow[],
): PropertyDecision {
  const key = normalizeAddressKey(parsed);
  if (!key) return { action: "none", reason: "NO_PARSED_ADDRESS" };

  const ownProps = existingProperties.filter(p => p.customerId === customerId);
  for (const p of ownProps) {
    const pKey = normalizeAddressKey({ line1: p.addressLine1, city: p.city, zip: p.zip });
    if (pKey && pKey === key) return { action: "existing", reason: "PROPERTY_ALREADY_EXISTS", propertyId: p.id };
  }
  // Same customer already has a DIFFERENT property → not a duplicate; surface as
  // a review item rather than silently adding a second service location.
  if (ownProps.length > 0) {
    return { action: "conflict", reason: "CUSTOMER_HAS_DIFFERENT_PROPERTY", propertyId: ownProps[0].id };
  }
  return { action: "create", reason: "NEW_PROPERTY" };
}

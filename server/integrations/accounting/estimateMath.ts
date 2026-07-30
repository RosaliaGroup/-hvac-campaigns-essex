/**
 * Pure estimate math + snapshot helpers (Task 8A). No DB, no network — unit-tested
 * directly. Decimal columns arrive from drizzle as strings, so every numeric input
 * is coerced with Number().
 */
import type { AccountingEstimateLineInput } from "./types";

export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** amount = quantity × unitPrice, rounded to cents. */
export function computeLineAmount(quantity: number | string, unitPrice: number | string): number {
  return round2(Number(quantity) * Number(unitPrice));
}

export interface LineForTotals {
  amount: number | string;
}

/**
 * Option totals from its line items. v1: total === subtotal (no tax/discount
 * lines; the rebate is display-only and excluded). Kept as its own function so a
 * later task can add tax/discount without touching call sites.
 */
export function computeOptionTotals(lines: LineForTotals[]): { subtotal: number; total: number } {
  const subtotal = round2(lines.reduce((sum, l) => sum + Number(l.amount || 0), 0));
  return { subtotal, total: subtotal };
}

export interface SnapshotLineItem {
  name: string;
  description: string | null;
  itemType: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface ApprovedSnapshot {
  optionId: number;
  tier: string;
  label: string;
  description: string | null;
  subtotal: number;
  total: number;
  rebateAmount: number;
  warrantyTerms: string | null;
  maintenancePlan: string | null;
  approvedAt: string;
  lineItems: SnapshotLineItem[];
}

export interface OptionForSnapshot {
  id: number;
  tier: string;
  label: string;
  description: string | null;
  subtotal: number | string;
  total: number | string;
  rebateAmount: number | string;
  warrantyTerms: string | null;
  maintenancePlan: string | null;
}

export interface LineForSnapshot {
  name: string;
  description: string | null;
  itemType: string;
  quantity: number | string;
  unitPrice: number | string;
  amount: number | string;
}

/**
 * Build the immutable approved-option snapshot. Returns a fresh, deeply-owned
 * object (brand-new line-item objects with primitive copies) so later edits to
 * the source option / line rows can never change what was approved.
 */
export function buildApprovedSnapshot(
  option: OptionForSnapshot,
  lines: LineForSnapshot[],
  approvedAt: Date = new Date(),
): ApprovedSnapshot {
  return {
    optionId: option.id,
    tier: option.tier,
    label: option.label,
    description: option.description ?? null,
    subtotal: Number(option.subtotal),
    total: Number(option.total),
    rebateAmount: Number(option.rebateAmount),
    warrantyTerms: option.warrantyTerms ?? null,
    maintenancePlan: option.maintenancePlan ?? null,
    approvedAt: approvedAt.toISOString(),
    lineItems: lines.map(l => ({
      name: l.name,
      description: l.description ?? null,
      itemType: l.itemType,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
    })),
  };
}

/** Map a stored snapshot to the provider push-input lines (approved option only). */
export function snapshotToPushLines(snapshot: ApprovedSnapshot): AccountingEstimateLineInput[] {
  return snapshot.lineItems.map(l => ({
    name: l.name,
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    amount: l.amount,
  }));
}

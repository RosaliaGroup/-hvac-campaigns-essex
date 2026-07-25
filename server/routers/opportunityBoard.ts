/**
 * opportunityBoard.ts — pure decision logic for the Opportunity Center board
 * (create / edit / drag-reorder / drag-between-stages), extracted so every
 * branch is unit-testable without a database, auth, or QuickBooks.
 *
 * Design rules (mirrors opportunityToJob.ts):
 *  - NO QuickBooks interaction. Manual opportunities are `source:"manual"` and
 *    carry no backing QBO document; the QBO sync only ever touches opportunities
 *    it discovers via a QBO sales document, so it never clobbers these.
 *  - NEVER overwrite manually-entered customer/property/appointment/estimate/job
 *    data. `propertyId` is a *reference* validated to belong to the customer; the
 *    property row itself is never created or edited here.
 *  - Stage moves and reorders are optimistic: the caller passes the last-seen
 *    state and the decision returns `stale` when reality has moved on, so the
 *    router can surface a CONFLICT and the client refetches instead of stomping
 *    a concurrent edit. The actual atomic write + audit event live in the router
 *    transaction; this module only decides WHAT should be written.
 */

import { OPPORTUNITY_STAGES, type OpportunityStage } from "@shared/opportunityDashboard";

/** Sales urgency, independent of stage/probability. Persisted on opportunities.priority. */
export const OPPORTUNITY_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type OpportunityPriority = (typeof OPPORTUNITY_PRIORITIES)[number];

/** The two terminal stages. Kept in one place so closedAt logic never drifts. */
export const CLOSED_STAGES: readonly OpportunityStage[] = ["won", "lost"];
export function isClosedStage(stage: OpportunityStage): boolean {
  return stage === "won" || stage === "lost";
}

// ── sort order ───────────────────────────────────────────────────────────────

/**
 * The rank to give a card appended to the BOTTOM of a stage column.
 * `existingOrders` are the current sortOrder values of same-stage cards.
 * Empty column → 0; otherwise max+1. Pure.
 */
export function appendSortOrder(existingOrders: number[]): number {
  if (existingOrders.length === 0) return 0;
  return Math.max(...existingOrders) + 1;
}

// ── reorder within a stage ─────────────────────────────────────────────────────

export interface BoardCard {
  id: number;
  stage: OpportunityStage;
  sortOrder: number;
}

export type ReorderPlan =
  | { kind: "ok"; updates: Array<{ id: number; sortOrder: number }> }
  /** The client's snapshot of the column no longer matches the DB — refetch. */
  | { kind: "stale"; reason: string }
  | { kind: "invalid"; reason: string };

/**
 * Decide the dense 0..N-1 renumbering for a drag-reorder within a single stage.
 * `orderedIds` is the client's desired top-to-bottom order for that column;
 * `cardsInStage` is what the DB currently holds for that same stage.
 *
 * Guards (all must hold, else stale/invalid so no partial write happens):
 *  - orderedIds has no duplicates                              → invalid
 *  - orderedIds is exactly the set of ids currently in stage   → stale (a card
 *    was added/removed/moved between stages since the client loaded the board)
 *
 * Emits an update only for cards whose rank actually changes (bounded writes).
 */
export function planReorder(orderedIds: number[], cardsInStage: BoardCard[]): ReorderPlan {
  const seen = new Set<number>();
  for (const id of orderedIds) {
    if (seen.has(id)) return { kind: "invalid", reason: `Duplicate opportunity id ${id} in ordering.` };
    seen.add(id);
  }

  const current = new Set(cardsInStage.map(c => c.id));
  if (orderedIds.length !== current.size || orderedIds.some(id => !current.has(id))) {
    return {
      kind: "stale",
      reason: "The board changed since it was loaded (a card was moved, added, or removed). Refresh and try again.",
    };
  }

  const bySortOrder = new Map(cardsInStage.map(c => [c.id, c.sortOrder]));
  const updates: Array<{ id: number; sortOrder: number }> = [];
  orderedIds.forEach((id, index) => {
    if (bySortOrder.get(id) !== index) updates.push({ id, sortOrder: index });
  });
  return { kind: "ok", updates };
}

// ── move a card to another stage ───────────────────────────────────────────────

export interface StageState {
  stage: OpportunityStage;
  closedAt: Date | null;
}

export type StageMoveDecision =
  | {
      kind: "ok";
      fromStage: OpportunityStage;
      toStage: OpportunityStage;
      /** Column set applied to the opportunities row (partial update). */
      set: {
        stage: OpportunityStage;
        stageOverridden: true;
        closedAt: Date | null;
        sortOrder: number;
      };
      /** True when this move transitions the deal into won/lost. */
      closing: boolean;
    }
  | { kind: "noop"; stage: OpportunityStage }
  | { kind: "stale"; reason: string }
  | { kind: "not_found" };

/**
 * Decide the write for moving an opportunity to `toStage` at `placementSortOrder`
 * (the bottom-of-target rank the router computed). Pure.
 *
 *  - current null                              → not_found
 *  - expectedStage given and ≠ current.stage   → stale (optimistic-concurrency)
 *  - toStage === current.stage                 → noop (use `reorder` for same-stage moves)
 *  - closing: closedAt = now; re-opening: closedAt = null; a card already closed
 *    that moves to the other terminal keeps a fresh close stamp.
 */
export function decideStageMove(
  current: StageState | null,
  input: {
    toStage: OpportunityStage;
    expectedStage?: OpportunityStage | null;
    placementSortOrder: number;
    now: Date;
  },
): StageMoveDecision {
  if (!current) return { kind: "not_found" };
  if (input.expectedStage != null && current.stage !== input.expectedStage) {
    return {
      kind: "stale",
      reason: `Expected stage "${input.expectedStage}" but it is now "${current.stage}". Refresh and try again.`,
    };
  }
  if (input.toStage === current.stage) return { kind: "noop", stage: current.stage };

  const closing = isClosedStage(input.toStage);
  return {
    kind: "ok",
    fromStage: current.stage,
    toStage: input.toStage,
    closing,
    set: {
      stage: input.toStage,
      stageOverridden: true,
      closedAt: closing ? input.now : null,
      sortOrder: input.placementSortOrder,
    },
  };
}

// ── create ─────────────────────────────────────────────────────────────────────

export type PropertyLinkCheck =
  | { kind: "ok"; propertyId: number | null }
  | { kind: "invalid"; propertyId: number };

/**
 * Validate an optional property reference against the customer's own properties.
 * null/undefined → ok(null). A given id must be in `customerPropertyIds`, else
 * invalid (never silently drop or reassign it). Pure.
 */
export function resolvePropertyLink(
  propertyId: number | null | undefined,
  customerPropertyIds: number[],
): PropertyLinkCheck {
  if (propertyId == null) return { kind: "ok", propertyId: null };
  return customerPropertyIds.includes(propertyId)
    ? { kind: "ok", propertyId }
    : { kind: "invalid", propertyId };
}

export interface CreateInput {
  customerId: number;
  title: string;
  stage?: OpportunityStage;
  amount?: number;
  probability?: number | null;
  priority?: OpportunityPriority | null;
  assignedToId?: number | null;
  expectedCloseAt?: Date | null;
  nextAction?: string | null;
  nextActionDueAt?: Date | null;
  propertyId?: number | null;
}

export interface CreateValues {
  customerId: number;
  title: string;
  source: "manual";
  stage: OpportunityStage;
  amount: string;
  amountOverridden: boolean;
  probability: number | null;
  stageOverridden: boolean;
  priority: OpportunityPriority | null;
  assignedToId: number | null;
  expectedCloseAt: Date | null;
  nextAction: string | null;
  nextActionDueAt: Date | null;
  propertyId: number | null;
  sortOrder: number;
  closedAt: Date | null;
}

/**
 * Assemble the INSERT values for a MANUAL opportunity. Pure.
 *  - source is always "manual"; QBO fields (quickbooksSalesDocumentId, etc.) stay null.
 *  - amountOverridden/stageOverridden reflect "a human set this" — harmless for
 *    manual deals (the sync ignores them) but honest and future-proof.
 *  - sortOrder/propertyId are pre-resolved by the caller (append rank; validated link).
 */
export function buildCreateValues(
  input: CreateInput,
  resolved: { sortOrder: number; propertyId: number | null },
  now: Date,
): CreateValues {
  const stage = input.stage ?? "new";
  if (!OPPORTUNITY_STAGES.includes(stage)) {
    throw new Error(`Invalid stage "${stage}"`);
  }
  const amountProvided = input.amount != null;
  return {
    customerId: input.customerId,
    title: input.title.trim(),
    source: "manual",
    stage,
    amount: (amountProvided ? input.amount! : 0).toFixed(2),
    amountOverridden: amountProvided,
    probability: input.probability ?? null,
    stageOverridden: stage !== "new",
    priority: input.priority ?? null,
    assignedToId: input.assignedToId ?? null,
    expectedCloseAt: input.expectedCloseAt ?? null,
    nextAction: input.nextAction ?? null,
    nextActionDueAt: input.nextActionDueAt ?? null,
    propertyId: resolved.propertyId,
    sortOrder: resolved.sortOrder,
    closedAt: isClosedStage(stage) ? now : null,
  };
}

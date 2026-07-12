/**
 * Commercial Opportunities — pure server logic (no DB, no tRPC, no auth).
 *
 * Everything here is deterministic and unit-testable in isolation, mirroring the
 * jobsLogic.ts / opportunityToJob.ts convention. The tRPC router
 * (commercialOpportunities.ts) wires these to Drizzle.
 */
import {
  grossMargin,
  grossMarginPercent,
  statusForClassification,
  type StageClassification,
  type OpportunityStatus,
} from "@shared/commercialPipeline";

// ─────────────────────────────────────────────────────────────────────────────
// Financials — calculated vs overridden margin (never conflate the two)
// ─────────────────────────────────────────────────────────────────────────────

export interface MarginView {
  /** Sell value (opportunities.amount). */
  estimatedValue: string | null;
  /** Internal cost (opportunities.estimatedCost). */
  estimatedCost: string | null;
  /** value − cost, always derived; never written to the override column. */
  calculatedMargin: string | null;
  /** (value − cost) / value × 100. */
  calculatedMarginPercent: number | null;
  /** The stored manual override, if an authorized user entered one. */
  marginOverride: string | null;
  /** True when an override exists (UI shows it instead of the calculated value). */
  marginIsOverridden: boolean;
  /** The value the business should use: override when present, else calculated. */
  effectiveMargin: string | null;
}

/**
 * Build the margin view. The override is surfaced separately and is used as the
 * effective value only when explicitly present — the calculated value is NEVER
 * silently written into the override column.
 */
export function marginView(
  estimatedValue: string | null | undefined,
  estimatedCost: string | null | undefined,
  marginOverride: string | null | undefined,
): MarginView {
  const value = estimatedValue ?? null;
  const cost = estimatedCost ?? null;
  const calculatedMargin = grossMargin(value, cost);
  const override = marginOverride ?? null;
  return {
    estimatedValue: value,
    estimatedCost: cost,
    calculatedMargin,
    calculatedMarginPercent: grossMarginPercent(value, cost),
    marginOverride: override,
    marginIsOverridden: override !== null,
    effectiveMargin: override !== null ? override : calculatedMargin,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage transitions — one server-authoritative planner
// ─────────────────────────────────────────────────────────────────────────────

export interface StageLike {
  id: number;
  stageKey: string;
  name: string;
  classification: StageClassification;
  isActive: boolean;
}

export type TransitionCode =
  | "SAME_STAGE"
  | "STAGE_INACTIVE"
  | "LOST_REASON_REQUIRED"
  | "WON_CONFIRMATION_REQUIRED";

export class TransitionError extends Error {
  constructor(
    public code: TransitionCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "TransitionError";
  }
}

export interface TransitionPlan {
  /** Column patch to apply to the opportunities row. */
  set: {
    stageId: number;
    status: OpportunityStatus;
    awardedAt: Date | null;
    lostAt: Date | null;
    closedAt: Date | null;
    lossReason?: string | null;
  };
  /** The activity event to append (before→after stage keys preserved). */
  event: { type: string; message: string; metadata: Record<string, unknown> };
  reopened: boolean;
}

/**
 * Plan a commercial stage transition. Pure and server-authoritative:
 *  - target must exist & be active (caller looks it up in the same pipeline)
 *  - lost classification requires a non-empty lost reason
 *  - won classification requires explicit confirmation
 *  - awardedAt / lostAt are populated; reopening to an open stage clears the
 *    incompatible lifecycle timestamps (awardedAt, lostAt, closedAt, lossReason)
 *  - the before→after stage keys are captured in the event metadata (history)
 *
 * This never touches the legacy `opportunities.stage` enum or QBO mapping — it
 * operates purely on `stageId` / `status` / lifecycle timestamps.
 */
export function planStageTransition(input: {
  from: StageLike | null;
  to: StageLike;
  lostReason?: string | null;
  confirmWon?: boolean;
  now: Date;
  /** awardedAt already stored on the opp (so we don't overwrite the first award time). */
  existingAwardedAt?: Date | null;
}): TransitionPlan {
  const { from, to, now } = input;

  if (from && from.id === to.id) {
    throw new TransitionError("SAME_STAGE", "Opportunity is already in that stage.");
  }
  if (!to.isActive) {
    throw new TransitionError("STAGE_INACTIVE", "Target stage is not active.");
  }
  if (to.classification === "lost" && !input.lostReason?.trim()) {
    throw new TransitionError("LOST_REASON_REQUIRED", "A lost reason is required to move to a lost stage.");
  }
  if (to.classification === "won" && !input.confirmWon) {
    throw new TransitionError("WON_CONFIRMATION_REQUIRED", "Explicit confirmation is required to mark this opportunity won.");
  }

  const status = statusForClassification(to.classification);
  const reopened = to.classification === "open" && (from?.classification === "won" || from?.classification === "lost");

  let awardedAt: Date | null;
  let lostAt: Date | null;
  let closedAt: Date | null;
  let lossReason: string | null | undefined;

  if (to.classification === "won") {
    awardedAt = input.existingAwardedAt ?? now; // preserve the original award time on later won stages
    lostAt = null;
    closedAt = now;
    lossReason = null;
  } else if (to.classification === "lost") {
    awardedAt = null;
    lostAt = now;
    closedAt = now;
    lossReason = input.lostReason ?? null;
  } else {
    // open (including reopen): clear all terminal lifecycle timestamps
    awardedAt = null;
    lostAt = null;
    closedAt = null;
    lossReason = null;
  }

  return {
    set: { stageId: to.id, status, awardedAt, lostAt, closedAt, lossReason },
    event: {
      type: reopened ? "reopened" : "stage_changed",
      message: reopened
        ? `Reopened: ${from?.stageKey ?? "—"} → ${to.stageKey}`
        : `Stage: ${from?.stageKey ?? "—"} → ${to.stageKey}`,
      metadata: {
        fromStageId: from?.id ?? null,
        toStageId: to.id,
        fromStageKey: from?.stageKey ?? null,
        toStageKey: to.stageKey,
        classification: to.classification,
        reopened,
      },
    },
    reopened,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Partial update diff — set only changed fields; emit one event per real change
// ─────────────────────────────────────────────────────────────────────────────

type FieldKind = "string" | "int" | "money" | "date" | "enum";

interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
}

/** The updatable scalar fields (stage/status/categories/members are handled elsewhere). */
export const UPDATABLE_FIELDS: FieldSpec[] = [
  { key: "title", label: "Title", kind: "string" },
  { key: "description", label: "Description", kind: "string" },
  { key: "priority", label: "Priority", kind: "enum" },
  { key: "opportunityType", label: "Opportunity type", kind: "enum" },
  { key: "source", label: "Source", kind: "string" },
  { key: "customerId", label: "Customer", kind: "int" },
  { key: "primaryContactId", label: "Primary contact", kind: "int" },
  { key: "propertyId", label: "Property", kind: "int" },
  { key: "assignedToId", label: "Owner", kind: "int" },
  { key: "estimatorId", label: "Estimator", kind: "int" },
  { key: "projectManagerId", label: "Project manager", kind: "int" },
  { key: "amount", label: "Estimated value", kind: "money" },
  { key: "estimatedCost", label: "Estimated cost", kind: "money" },
  { key: "estimatedGrossMargin", label: "Margin override", kind: "money" },
  { key: "probability", label: "Probability", kind: "int" },
  { key: "bidDueAt", label: "Bid due", kind: "date" },
  { key: "siteVisitAt", label: "Site visit", kind: "date" },
  { key: "proposalDueAt", label: "Proposal due", kind: "date" },
  { key: "proposalSentAt", label: "Proposal sent", kind: "date" },
  { key: "followUpAt", label: "Follow-up", kind: "date" },
  { key: "expectedCloseAt", label: "Expected close", kind: "date" },
  { key: "communicationPlatform", label: "Communication platform", kind: "string" },
  { key: "externalReference", label: "External reference", kind: "string" },
];

const FIELD_BY_KEY = new Map(UPDATABLE_FIELDS.map(f => [f.key, f]));

/** Normalize a value for equality comparison + storage per its field kind. */
function normalize(kind: FieldKind, v: unknown): string | number | Date | null {
  if (v === undefined || v === null || v === "") return null;
  switch (kind) {
    case "money":
      return Number(v).toFixed(2); // exact 2dp string
    case "int":
      return Number(v);
    case "date":
      return v instanceof Date ? v : new Date(v as string);
    default:
      return typeof v === "string" ? v.trim() : String(v);
  }
}

function equal(kind: FieldKind, a: unknown, b: unknown): boolean {
  const na = normalize(kind, a);
  const nb = normalize(kind, b);
  if (na === null || nb === null) return na === nb;
  if (kind === "date") return (na as Date).getTime() === (nb as Date).getTime();
  return na === nb;
}

export interface UpdatePlan {
  /** Column patch containing only genuinely-changed fields. */
  set: Record<string, unknown>;
  /** One activity event per meaningful change (no-op fields never appear). */
  events: Array<{ type: string; message: string; metadata: Record<string, unknown> }>;
}

/**
 * Compute a safe partial update: only fields present in `patch` AND whose value
 * actually differs from `existing` are written, and each such change produces a
 * single activity event. A patch value identical to the stored value is a no-op
 * (no set, no event) — satisfying "do not log when the value is unchanged".
 */
export function computeOpportunityUpdate(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): UpdatePlan {
  const set: Record<string, unknown> = {};
  const events: UpdatePlan["events"] = [];

  for (const [key, rawValue] of Object.entries(patch)) {
    if (rawValue === undefined) continue; // key absent from this partial update
    const spec = FIELD_BY_KEY.get(key);
    if (!spec) continue; // unknown/for-elsewhere field — ignore defensively
    if (equal(spec.kind, existing[key], rawValue)) continue; // no-op

    const stored = normalize(spec.kind, rawValue);
    set[key] = stored;
    events.push({
      type: "field_changed",
      message: `${spec.label} updated.`,
      metadata: {
        field: key,
        from: serialize(existing[key]),
        to: serialize(rawValue),
      },
    });
  }
  return { set, events };
}

function serialize(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  return v ?? null;
}

/** Map an opportunity priority to the job priority enum (normal|urgent|emergency). */
export function opportunityPriorityToJobPriority(p?: string | null): "normal" | "urgent" | "emergency" {
  if (p === "urgent") return "emergency";
  if (p === "high") return "urgent";
  return "normal"; // low / normal / null
}

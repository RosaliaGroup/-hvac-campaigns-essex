/**
 * Opportunity stage metadata — the SINGLE SOURCE OF TRUTH for what every
 * `opportunities.stage` enum member MEANS. Importable by both server and client.
 *
 * Every classification set (open / won / lost / parked / closed), the board column
 * layout, and the ordering are DERIVED from STAGE_META below — there are no other
 * hardcoded stage lists anywhere. When a new stage is added to the DB enum, add it
 * here too; the tripwire test (shared/stageMeta.test.ts) iterates the ACTUAL enum
 * from drizzle/schema.ts and fails loudly if any member lacks a STAGE_META entry, so
 * a deal can never silently vanish from open-pipeline queries again.
 *
 * Classification semantics (Opportunity Center A2):
 *  - open   : an active deal that belongs in open-pipeline value, counts, and aging.
 *  - won    : closed-won.
 *  - lost   : closed-lost.
 *  - parked : `follow_up_later` — deliberately NOT open pipeline and NOT a loss;
 *             surfaced as its own bucket (excluded from open-pipeline value AND from
 *             loss/close-rate metrics).
 */

export type OpportunityStage =
  | "new" | "proposal_sent" | "pending" | "won" | "lost"
  | "qualified" | "assessment_scheduled" | "assessment_completed"
  | "sales_document_created" | "negotiating" | "follow_up_later";

export type StageClassification = "open" | "won" | "lost" | "parked";

export interface StageMeta {
  classification: StageClassification;
  /** Human label for UI (board header, stage select). */
  label: string;
  /** Board column this stage renders in (each stage is its own column here). */
  boardColumn: string;
  /** Ascending funnel order for the board and stage select (gaps for future inserts). */
  sortOrder: number;
}

export const STAGE_META: Record<OpportunityStage, StageMeta> = {
  new:                    { classification: "open",   label: "New",                   boardColumn: "New",                   sortOrder: 10 },
  qualified:              { classification: "open",   label: "Qualified",             boardColumn: "Qualified",             sortOrder: 20 },
  assessment_scheduled:   { classification: "open",   label: "Assessment Scheduled",  boardColumn: "Assessment Scheduled",  sortOrder: 30 },
  assessment_completed:   { classification: "open",   label: "Assessment Completed",  boardColumn: "Assessment Completed",  sortOrder: 40 },
  sales_document_created: { classification: "open",   label: "Sales Doc Created",     boardColumn: "Sales Doc Created",     sortOrder: 50 },
  proposal_sent:          { classification: "open",   label: "Proposal Sent",         boardColumn: "Proposal Sent",         sortOrder: 60 },
  pending:                { classification: "open",   label: "Pending",               boardColumn: "Pending",               sortOrder: 70 },
  negotiating:            { classification: "open",   label: "Negotiating",           boardColumn: "Negotiating",           sortOrder: 80 },
  won:                    { classification: "won",    label: "Won",                   boardColumn: "Won",                   sortOrder: 90 },
  lost:                   { classification: "lost",   label: "Lost",                  boardColumn: "Lost",                  sortOrder: 100 },
  follow_up_later:        { classification: "parked", label: "Follow Up Later",       boardColumn: "Follow Up Later",       sortOrder: 110 },
};

/** All enum members in board/funnel order (sortOrder). */
export const STAGE_ORDER: OpportunityStage[] = (Object.keys(STAGE_META) as OpportunityStage[])
  .sort((a, b) => STAGE_META[a].sortOrder - STAGE_META[b].sortOrder);

const byClass = (c: StageClassification): OpportunityStage[] =>
  STAGE_ORDER.filter(s => STAGE_META[s].classification === c);

/** Derived classification sets — never hardcode these elsewhere. */
export const OPEN_STAGES: OpportunityStage[] = byClass("open");
export const WON_STAGES: OpportunityStage[] = byClass("won");
export const LOST_STAGES: OpportunityStage[] = byClass("lost");
export const PARKED_STAGES: OpportunityStage[] = byClass("parked");
/** won + lost — the terminally-closed stages (parked is NOT closed). */
export const CLOSED_STAGES: OpportunityStage[] = [...WON_STAGES, ...LOST_STAGES];

export const classificationOf = (stage: OpportunityStage): StageClassification => STAGE_META[stage].classification;
export const isOpenStage = (stage: OpportunityStage): boolean => classificationOf(stage) === "open";
export const isWonStage = (stage: OpportunityStage): boolean => classificationOf(stage) === "won";
export const isLostStage = (stage: OpportunityStage): boolean => classificationOf(stage) === "lost";
export const isParkedStage = (stage: OpportunityStage): boolean => classificationOf(stage) === "parked";
/** Terminally closed (won or lost). Parked is NOT closed. */
export const isClosedStage = (stage: OpportunityStage): boolean => isWonStage(stage) || isLostStage(stage);

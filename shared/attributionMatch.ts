/**
 * Opportunity → lead-capture MATCH SUGGESTIONS (admin workflow).
 *
 * Pure and DB-agnostic. Proposes candidate leadCaptures for an opportunity's
 * `sourceLeadCaptureId`, but NEVER links anything — linking is an explicit admin
 * action (see server/routers/attribution.ts). Suggestions rest only on
 * ESTABLISHED IDENTIFIERS and CONSERVATIVE TIMING:
 *
 *   high   — the customer's `convertedFromCaptureId` provenance points at this
 *            capture (the CRM already recorded that this customer came from it).
 *   medium — the capture is linked to the deal's customer via conversion
 *            (leadCapture.customerId === opportunity.customerId).
 *   low    — the capture's email/phone matches the customer, but there is no
 *            conversion link. Weakest; surfaced for review, never auto-applied.
 *
 * Timing gate (all tiers): the capture must PRE-DATE the win and fall within the
 * window (default 180d). This is what stops an old lead from being suggested for
 * a much later QuickBooks deal. Opportunities that already have an explicit
 * `sourceLeadCaptureId` are skipped entirely — a direct link overrides inference.
 */

import type { Channel } from "./attribution";
import { normalizePath } from "./attribution";

export type MatchConfidence = "high" | "medium" | "low";

export interface MatchCapture {
  id: number;
  customerId: number | null;
  email: string | null;
  phone: string | null;
  createdAt: number; // epoch ms
  channel: Channel;
  landingPath: string | null;
  captureType: string | null;
}

export interface MatchOpportunity {
  id: number;
  customerId: number | null;
  sourceLeadCaptureId: number | null;
  amount: number;
  wonAt: number; // epoch ms (closedAt ?? createdAt)
  title: string;
}

export interface MatchCustomer {
  id: number;
  convertedFromCaptureId: number | null;
  email: string | null;
  phone: string | null;
}

export interface SuggestedMatch {
  opportunityId: number;
  opportunityTitle: string;
  amount: number;
  leadCaptureId: number;
  confidence: MatchConfidence;
  rationale: string[];
  channel: Channel;
  landingPath: string | null;
  capturedAt: number;
  wonAt: number;
  daysBeforeWon: number;
  /** How many other in-window candidates exist for this opportunity. */
  otherCandidateCount: number;
}

export interface SuggestMatchesResult {
  suggestions: SuggestedMatch[];
  alreadyLinkedCount: number;
  /** Unlinked opportunities for which no conservative candidate was found. */
  unmatchedCount: number;
}

export interface MatchOptions {
  /** Timing window in days for a capture to be considered. Default 180. */
  windowDays?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 180;
const CONFIDENCE_RANK: Record<MatchConfidence, number> = { high: 3, medium: 2, low: 1 };

function normEmail(e: string | null | undefined): string | null {
  const v = (e ?? "").trim().toLowerCase();
  return v || null;
}
/** Last 10 digits, matching the CRM's phone-identity convention. */
function normPhone(p: string | null | undefined): string | null {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length >= 7 ? d.slice(-10) : null;
}

interface Candidate {
  capture: MatchCapture;
  confidence: MatchConfidence;
  rationale: string[];
}

export function suggestMatches(
  opportunities: MatchOpportunity[],
  captures: MatchCapture[],
  customers: MatchCustomer[],
  options: MatchOptions = {},
): SuggestMatchesResult {
  const windowMs = Math.max(0, options.windowDays ?? DEFAULT_WINDOW_DAYS) * DAY_MS;

  const captureById = new Map<number, MatchCapture>();
  const capturesByCustomer = new Map<number, MatchCapture[]>();
  for (const c of captures) {
    captureById.set(c.id, c);
    if (c.customerId != null) {
      const arr = capturesByCustomer.get(c.customerId) ?? [];
      arr.push(c);
      capturesByCustomer.set(c.customerId, arr);
    }
  }
  const customerById = new Map<number, MatchCustomer>();
  for (const cust of customers) customerById.set(cust.id, cust);

  const withinWindow = (cap: MatchCapture, opp: MatchOpportunity) =>
    cap.createdAt <= opp.wonAt && opp.wonAt - cap.createdAt <= windowMs;

  const daysBefore = (cap: MatchCapture, opp: MatchOpportunity) =>
    Math.max(0, Math.round((opp.wonAt - cap.createdAt) / DAY_MS));

  const suggestions: SuggestedMatch[] = [];
  let alreadyLinkedCount = 0;
  let unmatchedCount = 0;

  for (const opp of opportunities) {
    // A direct explicit link overrides any inference — do not suggest.
    if (opp.sourceLeadCaptureId != null) {
      alreadyLinkedCount++;
      continue;
    }
    if (opp.customerId == null) {
      unmatchedCount++;
      continue;
    }
    const customer = customerById.get(opp.customerId);

    // Collect candidates, keeping the strongest confidence per capture.
    const byCapture = new Map<number, Candidate>();
    const consider = (cap: MatchCapture, confidence: MatchConfidence, reason: string) => {
      if (!withinWindow(cap, opp)) return;
      const existing = byCapture.get(cap.id);
      if (!existing || CONFIDENCE_RANK[confidence] > CONFIDENCE_RANK[existing.confidence]) {
        byCapture.set(cap.id, {
          capture: cap,
          confidence,
          rationale: [reason, `Captured ${daysBefore(cap, opp)} days before the deal (within ${Math.round(windowMs / DAY_MS)}d window).`],
        });
      }
    };

    // high — provenance: customer converted directly from this capture.
    if (customer?.convertedFromCaptureId != null) {
      const cap = captureById.get(customer.convertedFromCaptureId);
      if (cap) consider(cap, "high", `Customer #${customer.id} was converted directly from this lead capture (provenance link).`);
    }
    // medium — capture linked to this customer via conversion.
    for (const cap of capturesByCustomer.get(opp.customerId) ?? []) {
      consider(cap, "medium", "Lead capture is linked to the deal's customer (converted).");
    }
    // low — email/phone identity match to the customer, no conversion link.
    if (customer) {
      const custEmail = normEmail(customer.email);
      const custPhone = normPhone(customer.phone);
      if (custEmail || custPhone) {
        for (const cap of captures) {
          if (cap.customerId === opp.customerId) continue; // already covered as medium
          const emailHit = custEmail && normEmail(cap.email) === custEmail;
          const phoneHit = custPhone && normPhone(cap.phone) === custPhone;
          if (emailHit || phoneHit) {
            consider(cap, "low", `Lead capture ${emailHit ? "email" : "phone"} matches the customer, but there is no conversion link.`);
          }
        }
      }
    }

    const candidates = Array.from(byCapture.values());
    if (!candidates.length) {
      unmatchedCount++;
      continue;
    }
    // Best = highest confidence, then most recent capture before the win (last touch).
    candidates.sort(
      (a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence] || b.capture.createdAt - a.capture.createdAt,
    );
    const best = candidates[0];
    suggestions.push({
      opportunityId: opp.id,
      opportunityTitle: opp.title,
      amount: opp.amount,
      leadCaptureId: best.capture.id,
      confidence: best.confidence,
      rationale: best.rationale,
      channel: best.capture.channel,
      landingPath: normalizePath(best.capture.landingPath),
      capturedAt: best.capture.createdAt,
      wonAt: opp.wonAt,
      daysBeforeWon: daysBefore(best.capture, opp),
      otherCandidateCount: candidates.length - 1,
    });
  }

  // Strongest suggestions first for the review queue.
  suggestions.sort((a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence] || b.amount - a.amount);
  return { suggestions, alreadyLinkedCount, unmatchedCount };
}

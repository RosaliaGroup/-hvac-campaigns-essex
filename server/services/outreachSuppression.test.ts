import { describe, expect, it } from "vitest";
import {
  GMAIL_SUPPRESSION_LABEL_NAMES,
  KNOWN_OUTREACH_SUPPRESSIONS,
  isKnownOutreachSuppression,
  isExplicitOutreachOptOut,
} from "./outreachSuppression";

describe("Mechanical Enterprise outreach suppression", () => {
  it("suppresses the verified Dennis McConnell opt-out and 12 failed exact addresses", () => {
    expect(KNOWN_OUTREACH_SUPPRESSIONS).toHaveLength(13);
    expect(isKnownOutreachSuppression(" DMCCONNELL@CRESA.COM ")).toBe(true);
    expect(isKnownOutreachSuppression("jfuller@onyxequities.com")).toBe(true);
    expect(isKnownOutreachSuppression("nat.gambuzza@cbre.com")).toBe(true);
    expect(isKnownOutreachSuppression("another.person@cresa.com")).toBe(false);
  });
  it("recognizes the exact Gmail opt-out and bounce labels", () => {
    expect(GMAIL_SUPPRESSION_LABEL_NAMES.has("Outreach/Do Not Contact - Opt Out")).toBe(true);
    expect(GMAIL_SUPPRESSION_LABEL_NAMES.has("Outreach/Failed - Do Not Resend")).toBe(true);
  });
  it("detects an explicit opt-out but not an ordinary reply", () => {
    expect(isExplicitOutreachOptOut("Please remove me from your list.\nDennis W. McConnell")).toBe(true);
    expect(isExplicitOutreachOptOut("Please do not email me again.")).toBe(true);
    expect(isExplicitOutreachOptOut("Thanks, please call me next week.")).toBe(false);
  });
  it("ignores opt-out text only in quoted earlier correspondence", () => {
    expect(isExplicitOutreachOptOut("Thanks for the note.\nOn Oct 9, 2026, Ana wrote:\n> Please remove me from your list.")).toBe(false);
  });
});

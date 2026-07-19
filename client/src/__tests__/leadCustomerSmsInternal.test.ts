/**
 * Regression guard for the internal-SMS hotfix.
 *
 * The Lead card, Customer card, and Opportunity/Customer drawer must open the
 * INTERNAL Communications thread when "Text" is clicked — never the operating
 * system's messaging app. This test fails if any of those surfaces reintroduces
 * an `sms:` protocol link or drops the internal navigation helper.
 *
 * Scope note: the technician FIELD app (JobCard/FieldToday/FieldWorkOrder) and
 * the public Referral page intentionally keep native sms:/tel: and are NOT
 * covered here.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd(); // vitest runs from the repo root
const CARD_SURFACES = [
  "client/src/pages/LeadDashboard.tsx",
  "client/src/pages/CustomerDetail.tsx",
  "client/src/components/opportunity/OpportunityDetailDrawer.tsx",
];

describe("Lead/Customer card SMS is internal-only", () => {
  for (const rel of CARD_SURFACES) {
    const src = readFileSync(resolve(ROOT, rel), "utf8");

    it(`${rel} contains no sms: protocol link`, () => {
      expect(src).not.toMatch(/["'`]sms:/);
      expect(src).not.toMatch(/navigator\.share/);
      expect(src).not.toMatch(/window\.open\(\s*["'`]sms:/);
    });

    it(`${rel} routes Text through the internal Communications helper`, () => {
      expect(src).toContain("internalSmsConversationPath");
    });
  }
});

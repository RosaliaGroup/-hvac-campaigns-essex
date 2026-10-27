import { describe, it, expect } from "vitest";
import { planPublicationRepair } from "./publicationRepairPlan";
import type { LivePageCheck } from "./livePublicationCheck";
const check = (patch: Partial<LivePageCheck>): LivePageCheck => ({
  path: "/blog/test", status: "not_live", httpStatus: 200, canonical: null,
  canonicalMatches: false, contentPresent: false, reason: "", ...patch,
});
describe("safe SEO repair triage", () => {
  it("does nothing for verified pages", () => expect(planPublicationRepair(check({status:"verified_live"})).action).toBe("none"));
  it("retries transient network failures", () => expect(planPublicationRepair(check({status:"unreachable"})).action).toBe("retry_verification"));
  it("retries server errors", () => expect(planPublicationRepair(check({httpStatus:503})).action).toBe("retry_verification"));
  it("does not automatically edit missing pages", () => expect(planPublicationRepair(check({httpStatus:404})).action).toBe("manual_review"));
  it("does not automatically change canonical URLs", () => expect(planPublicationRepair(check({canonicalMatches:false})).action).toBe("manual_review"));
});

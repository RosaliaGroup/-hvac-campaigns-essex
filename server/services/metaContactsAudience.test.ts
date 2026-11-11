import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { eligibleEmails, hashEmail, normalizeEmail, findOrCreateAudience, AUDIENCE_NAME, type GraphCall } from "./metaContactsAudience";
import { followSocialTasksEnabled } from "./prospectWorkflow";

describe("Meta contacts audience", () => {
  it("normalizes and hashes emails the way Meta requires", () => {
    expect(normalizeEmail("  Jane.Doe@Acme.COM ")).toBe("jane.doe@acme.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(hashEmail("jane.doe@acme.com")).toBe(createHash("sha256").update("jane.doe@acme.com").digest("hex"));
  });
  it("leaves out opt-outs, public bodies and duplicates", () => {
    const out = eligibleEmails([
      { email: "pm@realco.com", name: "Pat", company: "RealCo" },
      { email: "PM@realco.com ", name: "Pat", company: "RealCo" },
      { email: "optout@other.com", name: "Opt", company: "Other" },
      { email: "facilities@townofexample.org", name: "F", company: "Township of Example" },
    ], new Set(["optout@other.com"]));
    expect(out).toEqual(["pm@realco.com"]);
  });
  it("reuses the existing audience by name, creates it only once", async () => {
    const calls: string[] = [];
    const existing: GraphCall = async (m, p) => { calls.push(`${m} ${p}`); return { data: [{ id: "123", name: AUDIENCE_NAME }] }; };
    expect(await findOrCreateAudience(existing, "1045370987135100")).toEqual({ id: "123", created: false });
    expect(calls).toEqual(["GET /act_1045370987135100/customaudiences"]);
    const fresh: GraphCall = async (m) => (m === "GET" ? { data: [] } : { id: "456" });
    expect(await findOrCreateAudience(fresh, "act_1045370987135100")).toEqual({ id: "456", created: true });
  });
  it("Follow-on-social tasks are off unless explicitly re-enabled", () => {
    expect(followSocialTasksEnabled({})).toBe(false);
    expect(followSocialTasksEnabled({ FOLLOW_SOCIAL_TASKS_ENABLED: "true" })).toBe(true);
  });
});

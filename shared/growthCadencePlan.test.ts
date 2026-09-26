import { describe, it, expect } from "vitest";
import { buildCadenceSteps, normalizeLeadNeed, isB2bNeed, CADENCE_STEP_DAYS, NURTURE_DAY } from "./growthCadencePlan";
import { VERIFIED_FACTS } from "./verifiedFacts";

describe("normalizeLeadNeed", () => {
  it("buckets common phrases", () => {
    expect(normalizeLeadNeed("commercial HVAC portfolio")).toBe("commercial");
    expect(normalizeLeadNeed("bid invitation")).toBe("bid");
    expect(normalizeLeadNeed("membership plan question")).toBe("membership");
    expect(normalizeLeadNeed("warranty coverage")).toBe("coverage");
    expect(normalizeLeadNeed("new install / replacement")).toBe("install");
    expect(normalizeLeadNeed("assessment / quote")).toBe("assessment");
    expect(normalizeLeadNeed("AC repair")).toBe("repair");
    expect(normalizeLeadNeed(null)).toBe("general");
    expect(normalizeLeadNeed("")).toBe("general");
  });
});

describe("isB2bNeed", () => {
  it("commercial and bid route to owner (§1.3/§1.5)", () => {
    expect(isB2bNeed("commercial")).toBe(true);
    expect(isB2bNeed("bid")).toBe(true);
    expect(isB2bNeed("repair")).toBe(false);
    expect(isB2bNeed("general")).toBe(false);
  });
});

describe("buildCadenceSteps — fact firewall", () => {
  const now = new Date("2026-03-02T14:00:00Z"); // a Monday, inside calling hours

  it("produces exactly the 6 documented steps (day 0 sms + day 0 call, 1, 3, 7, 14)", () => {
    const steps = buildCadenceSteps({ firstName: "Pat", need: "repair", now });
    expect(steps.map((s) => `${s.day}:${s.channel}`)).toEqual([
      "0:sms", "0:call", "1:sms", "3:call", "7:email", "14:sms",
    ]);
    // day 0 SMS is due immediately; day 0 call is due ~2 minutes later.
    expect(steps[0].dueAt.getTime()).toBe(now.getTime());
    expect(steps[1].dueAt.getTime()).toBe(now.getTime() + 2 * 60_000);
    expect(steps[2].dueAt.getTime()).toBe(now.getTime() + 1 * 86_400_000);
    expect(steps[3].dueAt.getTime()).toBe(now.getTime() + 3 * 86_400_000);
    expect(steps[4].dueAt.getTime()).toBe(now.getTime() + 7 * 86_400_000);
    expect(steps[5].dueAt.getTime()).toBe(now.getTime() + 14 * 86_400_000);
  });

  it("CADENCE_STEP_DAYS and NURTURE_DAY match the spec's day markers", () => {
    expect(CADENCE_STEP_DAYS).toEqual([0, 1, 3, 7, 14, 30]);
    expect(NURTURE_DAY).toBe(30);
  });

  it("day-1 value line for an 'install' need uses ONLY the verified warranty headline — no invented figures", () => {
    const steps = buildCadenceSteps({ firstName: "Pat", need: "install", now });
    const day1 = steps.find((s) => s.day === 1)!;
    expect(day1.body).toContain(VERIFIED_FACTS.warranty.headline);
    // No dollar-figure or bare digit sequence beyond what verifiedFacts supplies —
    // the fact firewall's whole point is that no number is invented here.
    expect(day1.body).not.toMatch(/\$\d/);
  });

  it("day-1 value line for a 'membership' need uses ONLY the verified membership name/first include", () => {
    const steps = buildCadenceSteps({ firstName: "Pat", need: "membership", now });
    const day1 = steps.find((s) => s.day === 1)!;
    expect(day1.body).toContain(VERIFIED_FACTS.membership.name);
    expect(day1.body).toContain(VERIFIED_FACTS.membership.includes[0]);
  });

  it("every message includes the first name and an opt-out line where required (sms)", () => {
    const steps = buildCadenceSteps({ firstName: "Alex", need: "repair", now });
    const day0Sms = steps.find((s) => s.day === 0 && s.channel === "sms")!;
    expect(day0Sms.body).toContain("Alex");
    expect(day0Sms.body).toMatch(/STOP/);
    const day14Sms = steps.find((s) => s.day === 14)!;
    expect(day14Sms.body).toMatch(/STOP/);
  });

  it("falls back to 'there' when no first name is available", () => {
    const steps = buildCadenceSteps({ firstName: "", need: "repair", now });
    const day0Sms = steps.find((s) => s.day === 0 && s.channel === "sms")!;
    expect(day0Sms.body).toContain("there");
  });

  it("day-3 call carries a voicemail script and no SMS body", () => {
    const steps = buildCadenceSteps({ firstName: "Pat", need: "repair", now });
    const day3Call = steps.find((s) => s.day === 3)!;
    expect(day3Call.body).toBeNull();
    expect(day3Call.voicemail).toBeTruthy();
  });
});

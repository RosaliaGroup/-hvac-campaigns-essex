import { describe, it, expect } from "vitest";
import { buildFollowupPlan, type FollowupDocContext } from "./followups";

const NOW = new Date("2026-07-07T12:00:00.000Z");
const ctx: FollowupDocContext = {
  docNumber: "1001",
  amount: "2500.50",
  documentLink: "https://qbo.example/estimate/42",
  customerName: "Acme HVAC",
};

describe("buildFollowupPlan", () => {
  it("opens a same-day call + email/text touches on a 0/1/3-day loop + a day-3 decision task", () => {
    const plan = buildFollowupPlan(10, 5, ctx, NOW, true);
    // same-day call + (email+text) × 3 steps + day-3 decision call = 8 tasks
    expect(plan).toHaveLength(8);

    // Two call tasks: the same-day human call (loopStep 0) and the day-3 decision (loopStep 3).
    const calls = plan.filter(t => t.type === "call");
    expect(calls).toHaveLength(2);
    const sameDay = calls.find(t => t.loopStep === 0)!;
    // Same-day call due end of day.
    expect(sameDay.dueAt.toISOString()).toBe("2026-07-07T23:59:00.000Z");

    const steps = plan.filter(t => t.type === "email").map(t => t.loopStep).sort();
    expect(steps).toEqual([0, 1, 3]);

    // Day-3 email due exactly 3 days out.
    const day3 = plan.find(t => t.type === "email" && t.loopStep === 3)!;
    expect(day3.dueAt.toISOString()).toBe("2026-07-10T12:00:00.000Z");
  });

  it("queues a day-3 forced-decision CALL task (open, never gated), due when the loop expires", () => {
    // Present regardless of the SMS gate — the decision prompt is not an SMS.
    for (const sms of [true, false]) {
      const decision = buildFollowupPlan(10, 5, ctx, NOW, sms).find(t => t.type === "call" && t.loopStep === 3)!;
      expect(decision).toBeDefined();
      expect(decision.status).toBe("open");
      expect(decision.dueAt.toISOString()).toBe("2026-07-10T12:00:00.000Z");
      expect(decision.title).toMatch(/Won, Lost, or Follow-up later/);
    }
  });

  it("appends the STOP opt-out footer to the SMS body (10DLC hygiene)", () => {
    const text = buildFollowupPlan(10, 5, ctx, NOW, true).find(t => t.type === "text")!;
    expect(text.body).toContain("Reply STOP to opt out.");
  });

  it("GATES every text task when SMS_FOLLOWUPS_ENABLED is off, emails stay open", () => {
    const plan = buildFollowupPlan(10, 5, ctx, NOW, false);
    const texts = plan.filter(t => t.type === "text");
    expect(texts).toHaveLength(3);
    expect(texts.every(t => t.status === "gated")).toBe(true);
    // Email + call remain dispatchable.
    expect(plan.filter(t => t.type === "email").every(t => t.status === "open")).toBe(true);
    expect(plan.find(t => t.type === "call")!.status).toBe("open");
  });

  it("opens text tasks once SMS is enabled", () => {
    const plan = buildFollowupPlan(10, 5, ctx, NOW, true);
    expect(plan.filter(t => t.type === "text").every(t => t.status === "open")).toBe(true);
  });

  it("includes the document link in message bodies when present", () => {
    const withLink = buildFollowupPlan(10, 5, ctx, NOW, true).find(t => t.type === "email")!;
    expect(withLink.body).toContain("https://qbo.example/estimate/42");
    const noLink = buildFollowupPlan(10, 5, { ...ctx, documentLink: null }, NOW, true).find(t => t.type === "email")!;
    expect(noLink.body).not.toContain("View it here");
  });
});

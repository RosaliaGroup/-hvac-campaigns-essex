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
  it("opens a call task + email/text touches on a 0/1/3-day loop", () => {
    const plan = buildFollowupPlan(10, 5, ctx, NOW, true);
    // 1 call + (email+text) × 3 steps = 7 tasks
    expect(plan).toHaveLength(7);

    const call = plan.filter(t => t.type === "call");
    expect(call).toHaveLength(1);
    // Same-day call due end of day.
    expect(call[0].dueAt.toISOString()).toBe("2026-07-07T23:59:00.000Z");

    const steps = plan.filter(t => t.type === "email").map(t => t.loopStep).sort();
    expect(steps).toEqual([0, 1, 3]);

    // Day-3 email due exactly 3 days out.
    const day3 = plan.find(t => t.type === "email" && t.loopStep === 3)!;
    expect(day3.dueAt.toISOString()).toBe("2026-07-10T12:00:00.000Z");
  });

  it("GATES every text task when SMS is not enabled (10DLC), emails stay open", () => {
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

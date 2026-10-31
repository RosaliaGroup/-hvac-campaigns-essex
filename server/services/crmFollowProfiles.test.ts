import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ executed: [] as string[] }));
vi.mock("../db", () => ({
  getDb: async () => {
    const chain: any = { select: () => chain, from: () => chain,
      where: async () => [{ contactId: 5, url: "https://www.linkedin.com/in/jane" }] };
    return { ...chain, execute: async (q: any) => {
      const t = JSON.stringify(q); state.executed.push(t);
      if (t.includes("FROM crmContactProfiles")) return [[{ contactId: 5, profile: JSON.stringify({
        social: [{ platform: "LinkedIn", url: "https://www.linkedin.com/in/jane/" }, { platform: "Bad", url: "http://x.com/a" }],
        companySocial: [{ platform: "Facebook", url: "https://www.facebook.com/acme" }] }) }]];
      return [{ affectedRows: 1 }];
    } };
  },
}));
vi.mock("./contactProfile/store", () => ({ contactProfile: vi.fn() }));
import { followProfilesFor, closeFollowTask } from "./crmContactEnrichment";

describe("one-click follow profiles", () => {
  it("lists verified https profiles per contact with follow status", async () => {
    const m = await followProfilesFor([5, 5, -1]);
    expect(m.get(5)).toEqual([
      { platform: "LinkedIn", url: "https://www.linkedin.com/in/jane", kind: "person", followed: true },
      { platform: "Facebook", url: "https://www.facebook.com/acme", kind: "company", followed: false },
    ]);
  });
  it("only closes open follow tasks", async () => {
    expect(await closeFollowTask(9)).toEqual({ closed: true });
    expect(state.executed.at(-1)).toContain("touchNumber = 1 AND status = 'open'");
  });
});

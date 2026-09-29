import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("fs", () => ({ default: { readFileSync: vi.fn(() => "export const blogPosts = [];") } }));
vi.mock("./contentQueue", () => ({ nextTopicToProcess: vi.fn(), updateQueueStatus: vi.fn() }));
vi.mock("./contentDrafting", () => ({ draftContentPost: vi.fn() }));
vi.mock("./criticPass", () => ({ runCriticPass: vi.fn() }));
vi.mock("./circuitBreaker", () => ({ checkCircuitBreakerConditions: vi.fn() }));
vi.mock("./auditLog", () => ({ logAudit: vi.fn(), listAuditLog: vi.fn() }));
vi.mock("./github", () => ({
  isGithubConfigured: vi.fn(),
  GithubNotConfiguredError: class extends Error {},
  ensureBranch: vi.fn(),
  getFileContent: vi.fn(),
  putFileContent: vi.fn(),
  openOrGetPR: vi.fn(),
}));
vi.mock("./bulkApprove", () => ({ yyyymmdd: () => "20260926" }));
vi.mock("./warmupGate", () => ({ isWarmedUp: vi.fn() }));
vi.mock("./autoMerge", () => ({ armHold: vi.fn() }));

import { getDb } from "../../db";
import { nextTopicToProcess, updateQueueStatus } from "./contentQueue";
import { draftContentPost } from "./contentDrafting";
import { runCriticPass } from "./criticPass";
import { checkCircuitBreakerConditions } from "./circuitBreaker";
import { logAudit, listAuditLog } from "./auditLog";
import { isGithubConfigured, ensureBranch, getFileContent, putFileContent, openOrGetPR } from "./github";
import { isWarmedUp } from "./warmupGate";
import { armHold } from "./autoMerge";
import { runWeeklyContentJob, findLatestContentDraft, approveContentToPR, approveContentToPRWithAutopublish, ContentNotReadyError } from "./contentPipeline";
import { VERIFIED_FACTS } from "../../../shared/verifiedFacts";
import type { SeoContentQueueRow } from "../../../drizzle/schema";

const cleanBreaker = { shouldPause: false, reason: null };

const topic: SeoContentQueueRow = {
  id: 5, title: "PTAC vs Mini-Split vs VRF for Multifamily Retrofits", targetQuery: null,
  audience: "property managers", brief: "Compare options.", status: "queued", source: "seed",
  contentBatchId: null, refreshesSlug: null, createdAt: new Date(), updatedAt: new Date(),
};

function paragraphOf(words: number): string {
  const tokens = "commercial building maintenance planning for property managers".split(" ");
  return Array.from({ length: words }, (_, i) => tokens[i % tokens.length]).join(" ") + ".";
}

const goodPost = {
  title: "PTAC vs Mini-Split vs VRF for Multifamily Retrofits",
  slug: "ptac-vs-mini-split-vs-vrf",
  date: "Sep 26, 2026", readTime: "8 min read", category: "Commercial",
  metaDescription: "Comparing options for multifamily retrofits.",
  excerpt: "An overview.",
  sections: [
    { type: "intro", content: paragraphOf(100) },
    { type: "h2", content: "PTAC" },
    { type: "paragraph", content: paragraphOf(200) },
    { type: "h2", content: "Mini-Split" },
    { type: "paragraph", content: paragraphOf(200) },
    { type: "h2", content: "VRF" },
    { type: "paragraph", content: paragraphOf(200) },
    { type: "checklist", items: ["Send floor plans", "Send equipment age", "Send occupancy schedule"] },
    { type: "paragraph", content: paragraphOf(200) },
    { type: "cta_box", content: "Talk to us.", buttonText: "Get a Quote", buttonUrl: "https://mechanicalenterprise.com/commercial" },
  ],
};

const factsWithIncentive = { ...VERIFIED_FACTS, incentives: [{ program: "PSE&G rebate", amountText: "$4,000", verifiedOn: "2026-09-26", source: "x" }] };

beforeEach(() => {
  vi.mocked(getDb).mockReset();
  vi.mocked(nextTopicToProcess).mockReset();
  vi.mocked(updateQueueStatus).mockReset();
  vi.mocked(draftContentPost).mockReset();
  vi.mocked(runCriticPass).mockReset();
  vi.mocked(checkCircuitBreakerConditions).mockReset().mockResolvedValue(cleanBreaker);
  vi.mocked(logAudit).mockReset();
  vi.mocked(listAuditLog).mockReset().mockResolvedValue([]);
  vi.mocked(isGithubConfigured).mockReset().mockReturnValue(true);
  vi.mocked(ensureBranch).mockReset().mockResolvedValue(undefined);
  vi.mocked(getFileContent).mockReset().mockResolvedValue({ content: "export const blogPosts: BlogPostData[] = [\n];\n", sha: "sha1" });
  vi.mocked(putFileContent).mockReset().mockResolvedValue("commitsha1");
  vi.mocked(openOrGetPR).mockReset().mockResolvedValue({ url: "https://github.com/x/pull/1", number: 1, created: true });
  vi.mocked(isWarmedUp).mockReset().mockResolvedValue(false);
  vi.mocked(armHold).mockReset().mockResolvedValue(undefined);
  process.env.SEO_AUTOPUBLISH_ENABLED = "true";
});

describe("runWeeklyContentJob", () => {
  it("short-circuits when the circuit breaker is paused, before touching the queue", async () => {
    vi.mocked(checkCircuitBreakerConditions).mockResolvedValue({ shouldPause: true, reason: "veto" });
    const result = await runWeeklyContentJob(factsWithIncentive);
    expect(result).toEqual({ status: "circuit_paused", reason: "veto" });
    expect(nextTopicToProcess).not.toHaveBeenCalled();
  });

  it("returns no_topic when the queue is empty", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue(null);
    const result = await runWeeklyContentJob(factsWithIncentive);
    expect(result).toEqual({ status: "no_topic" });
  });

  it("refuses a residential/rebate-tagged topic without drafting", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue({ ...topic, title: "NJ Heat Pump Rebates 2026" });
    const result = await runWeeklyContentJob(factsWithIncentive);
    expect(result).toEqual({ status: "refused_residential_rebate", topicId: topic.id });
    expect(draftContentPost).not.toHaveBeenCalled();
  });

  it("refuses to draft when facts aren't configured", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue(topic);
    const unconfiguredFacts = { ...VERIFIED_FACTS, incentives: [] };
    const result = await runWeeklyContentJob(unconfiguredFacts);
    expect(result).toEqual({ status: "facts_not_configured" });
    expect(draftContentPost).not.toHaveBeenCalled();
  });

  it("drafts, lints, runs the critic, and stores a clean draft as passing — stages only (not warmed up)", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue(topic);
    vi.mocked(draftContentPost).mockResolvedValue(goodPost as never);
    vi.mocked(runCriticPass).mockResolvedValue({ passes: true, unsupportedClaims: [], model: "claude-opus-4-8" });
    vi.mocked(isWarmedUp).mockResolvedValue(false);

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(result.status).toBe("drafted");
    if (result.status === "drafted") {
      expect(result.passes).toBe(true);
      expect(result.autoApproved).toBe(false);
      expect(result.batchId).toBeUndefined();
    }
    expect(updateQueueStatus).toHaveBeenCalledWith(topic.id, "drafted");
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "draft_generated", after: expect.objectContaining({ lane: "content", passes: true }) }));
    expect(armHold).not.toHaveBeenCalled();
  });

  it("regenerates once with the critic's findings fed back, then marks it blocked (not drafted) if still failing, and never auto-approves it", async () => {
    // Only this one topic is ever queued — after it's marked "blocked" a real
    // DB would stop returning it (nextTopicToProcess filters on queued/refresh_due),
    // so the mock reflects that: present once, then the queue is empty.
    vi.mocked(nextTopicToProcess).mockResolvedValueOnce(topic).mockResolvedValue(null);
    vi.mocked(draftContentPost).mockResolvedValue(goodPost as never);
    vi.mocked(runCriticPass).mockResolvedValue({ passes: false, unsupportedClaims: ["some claim"], model: "claude-opus-4-8" });
    vi.mocked(isWarmedUp).mockResolvedValue(true);

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(result.status).toBe("all_blocked");
    if (result.status === "all_blocked") expect(result.blockedTopicIds).toEqual([topic.id]);
    // Initial attempt + exactly one regenerate-with-feedback retry, not more.
    expect(draftContentPost).toHaveBeenCalledTimes(2);
    expect(draftContentPost).toHaveBeenNthCalledWith(1, topic, factsWithIncentive, undefined);
    expect(draftContentPost).toHaveBeenNthCalledWith(2, topic, factsWithIncentive, expect.stringContaining("some claim"));
    expect(updateQueueStatus).toHaveBeenCalledWith(topic.id, "blocked");
    expect(updateQueueStatus).not.toHaveBeenCalledWith(topic.id, "drafted");
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "draft_blocked",
      after: expect.objectContaining({ lane: "content", topicId: topic.id, regenerated: true }),
    }));
    expect(armHold).not.toHaveBeenCalled();
  });

  it("regenerates once, and if the retry passes, drafts normally with regenerated: true", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue(topic);
    vi.mocked(draftContentPost).mockResolvedValue(goodPost as never);
    vi.mocked(runCriticPass)
      .mockResolvedValueOnce({ passes: false, unsupportedClaims: ["bad claim"], model: "claude-opus-4-8" })
      .mockResolvedValueOnce({ passes: true, unsupportedClaims: [], model: "claude-opus-4-8" });
    vi.mocked(isWarmedUp).mockResolvedValue(false);

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(draftContentPost).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("drafted");
    if (result.status === "drafted") {
      expect(result.passes).toBe(true);
      expect(result.regenerated).toBe(true);
    }
    expect(updateQueueStatus).toHaveBeenCalledWith(topic.id, "drafted");
  });

  it("moves on to the next queued topic in the same run after one is blocked", async () => {
    const topicB: SeoContentQueueRow = { ...topic, id: 6, title: "Other topic" };
    vi.mocked(nextTopicToProcess).mockResolvedValueOnce(topic).mockResolvedValueOnce(topicB);
    vi.mocked(draftContentPost).mockResolvedValue(goodPost as never);
    // topic (id 5) always fails critic; topicB (id 6) passes clean.
    vi.mocked(runCriticPass)
      .mockResolvedValueOnce({ passes: false, unsupportedClaims: ["x"], model: "m" }) // topic, attempt 1
      .mockResolvedValueOnce({ passes: false, unsupportedClaims: ["x"], model: "m" }) // topic, retry
      .mockResolvedValueOnce({ passes: true, unsupportedClaims: [], model: "m" }); // topicB, attempt 1
    vi.mocked(isWarmedUp).mockResolvedValue(false);

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(updateQueueStatus).toHaveBeenCalledWith(topic.id, "blocked");
    expect(updateQueueStatus).toHaveBeenCalledWith(topicB.id, "drafted");
    expect(result.status).toBe("drafted");
    if (result.status === "drafted") expect(result.topicId).toBe(topicB.id);
  });

  it("gives up after MAX_TOPICS_PER_RUN consecutive blocked topics rather than draining the whole queue", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue(topic); // same topic every call — worst case
    vi.mocked(draftContentPost).mockResolvedValue(goodPost as never);
    vi.mocked(runCriticPass).mockResolvedValue({ passes: false, unsupportedClaims: ["x"], model: "m" });

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(result.status).toBe("all_blocked");
    // 5 topics x 2 draft attempts (initial + retry) each = 10, not unbounded.
    expect(vi.mocked(draftContentPost).mock.calls.length).toBe(10);
  });

  it("auto-approves to PR with label 'auto-YYYYMMDD' and arms the hold when the content lane IS warmed up and the circuit is clear", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue(topic);
    vi.mocked(draftContentPost).mockResolvedValue(goodPost as never);
    vi.mocked(runCriticPass).mockResolvedValue({ passes: true, unsupportedClaims: [], model: "claude-opus-4-8" });
    vi.mocked(isWarmedUp).mockResolvedValue(true);
    const values = vi.fn(() => Promise.resolve([{ insertId: 77 }]));
    vi.mocked(getDb).mockResolvedValue({ insert: () => ({ values }) } as never);
    // approveContentToPR reads the draft back via findLatestContentDraft -> listAuditLog.
    vi.mocked(listAuditLog).mockResolvedValue([
      { id: 1, ts: new Date(), actorId: null, action: "draft_generated", batchId: null, pagePath: null, before: null, after: { lane: "content", topicId: topic.id, post: goodPost, metaLint: { passes: true, findings: [] }, contentLint: { passes: true, findings: [] }, criticBlocked: false, criticClaims: [], passes: true }, lintResult: null } as never,
    ]);

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(result.status).toBe("drafted");
    if (result.status === "drafted") {
      expect(result.autoApproved).toBe(true);
      expect(result.batchId).toBe(77);
    }
    expect(ensureBranch).toHaveBeenCalledWith(expect.stringMatching(/^pr-content-\d{8}$/));
    expect(armHold).toHaveBeenCalledWith(77);
    // The label must be "auto-YYYYMMDD" — circuitBreaker.ts's lastTwoAutoLaneNetlifyStates()
    // identifies auto-lane batches by that prefix, for both lanes.
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ label: expect.stringMatching(/^auto-\d{8}$/) }));
  });

  it("stages only when warmed up + circuit clear but SEO_AUTOPUBLISH_ENABLED isn't \"true\" (addendum §A5 master switch)", async () => {
    process.env.SEO_AUTOPUBLISH_ENABLED = "false";
    vi.mocked(nextTopicToProcess).mockResolvedValue(topic);
    vi.mocked(draftContentPost).mockResolvedValue(goodPost as never);
    vi.mocked(runCriticPass).mockResolvedValue({ passes: true, unsupportedClaims: [], model: "claude-opus-4-8" });
    vi.mocked(isWarmedUp).mockResolvedValue(true);

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(result.status).toBe("drafted");
    if (result.status === "drafted") expect(result.autoApproved).toBe(false);
    expect(isWarmedUp).not.toHaveBeenCalled(); // the flag is checked first — never even asks whether the lane is warmed up
  });

  it("degrades to 'staged' (does not throw) when the auto-approve call itself fails", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue(topic);
    vi.mocked(draftContentPost).mockResolvedValue(goodPost as never);
    vi.mocked(runCriticPass).mockResolvedValue({ passes: true, unsupportedClaims: [], model: "claude-opus-4-8" });
    vi.mocked(isWarmedUp).mockResolvedValue(true);
    vi.mocked(ensureBranch).mockRejectedValue(new Error("GitHub is down"));
    vi.mocked(listAuditLog).mockResolvedValue([
      { id: 1, ts: new Date(), actorId: null, action: "draft_generated", batchId: null, pagePath: null, before: null, after: { lane: "content", topicId: topic.id, post: goodPost, metaLint: { passes: true, findings: [] }, contentLint: { passes: true, findings: [] }, criticBlocked: false, criticClaims: [], passes: true }, lintResult: null } as never,
    ]);

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(result.status).toBe("drafted");
    if (result.status === "drafted") {
      expect(result.passes).toBe(true);
      expect(result.autoApproved).toBe(false); // the draft itself is unaffected — still there for manual approval
    }
  });
});

describe("findLatestContentDraft", () => {
  it("returns null when no draft exists for the topic", async () => {
    vi.mocked(listAuditLog).mockResolvedValue([]);
    expect(await findLatestContentDraft(999)).toBeNull();
  });

  it("finds the matching content-lane draft by topicId, ignoring meta-lane rows", async () => {
    vi.mocked(listAuditLog).mockResolvedValue([
      { id: 1, ts: new Date(), actorId: null, action: "draft_generated", batchId: null, pagePath: null, before: null, after: { lane: "meta", topicId: 5 }, lintResult: null } as never,
      { id: 2, ts: new Date(), actorId: null, action: "draft_generated", batchId: null, pagePath: null, before: null, after: { lane: "content", topicId: 5, post: goodPost, metaLint: { passes: true, findings: [] }, contentLint: { passes: true, findings: [] }, criticBlocked: false, criticClaims: [], passes: true }, lintResult: null } as never,
    ]);
    const draft = await findLatestContentDraft(5);
    expect(draft?.post.slug).toBe("ptac-vs-mini-split-vs-vrf");
  });
});

describe("approveContentToPR", () => {
  it("throws ContentNotReadyError when no draft exists", async () => {
    vi.mocked(listAuditLog).mockResolvedValue([]);
    await expect(approveContentToPR(5, 1)).rejects.toThrow(ContentNotReadyError);
  });

  it("throws ContentNotReadyError when the draft has unresolved findings", async () => {
    vi.mocked(listAuditLog).mockResolvedValue([
      { id: 1, ts: new Date(), actorId: null, action: "draft_generated", batchId: null, pagePath: null, before: null, after: { lane: "content", topicId: 5, post: goodPost, metaLint: { passes: true, findings: [] }, contentLint: { passes: false, findings: [] }, criticBlocked: false, criticClaims: [], passes: false }, lintResult: null } as never,
    ]);
    await expect(approveContentToPR(5, 1)).rejects.toThrow(ContentNotReadyError);
    expect(ensureBranch).not.toHaveBeenCalled();
  });

  it("commits to blogPosts.ts, opens a PR, and records a batch for a clean draft", async () => {
    vi.mocked(getDb).mockResolvedValue({
      insert: () => ({ values: () => Promise.resolve([{ insertId: 42 }]) }),
    } as never);
    vi.mocked(listAuditLog).mockResolvedValue([
      { id: 1, ts: new Date(), actorId: null, action: "draft_generated", batchId: null, pagePath: null, before: null, after: { lane: "content", topicId: 5, post: goodPost, metaLint: { passes: true, findings: [] }, contentLint: { passes: true, findings: [] }, criticBlocked: false, criticClaims: [], passes: true }, lintResult: null } as never,
    ]);

    const result = await approveContentToPR(5, 3);

    expect(result).toEqual({ batchId: 42, prUrl: "https://github.com/x/pull/1", prNumber: 1 });
    expect(ensureBranch).toHaveBeenCalledWith("pr-content-20260926");
    expect(putFileContent).toHaveBeenCalledWith("client/src/data/blogPosts.ts", expect.any(String), expect.stringContaining(goodPost.slug), expect.any(String), "sha1");
    expect(updateQueueStatus).toHaveBeenCalledWith(5, "pr_open", 42);
  });
});

describe("approveContentToPRWithAutopublish (the router's human-triggered 'Approve to PR' button)", () => {
  it("arms the hold when the content lane is warmed up", async () => {
    vi.mocked(getDb).mockResolvedValue({ insert: () => ({ values: () => Promise.resolve([{ insertId: 20 }]) }) } as never);
    vi.mocked(listAuditLog).mockResolvedValue([
      { id: 1, ts: new Date(), actorId: null, action: "draft_generated", batchId: null, pagePath: null, before: null, after: { lane: "content", topicId: 5, post: goodPost, metaLint: { passes: true, findings: [] }, contentLint: { passes: true, findings: [] }, criticBlocked: false, criticClaims: [], passes: true }, lintResult: null } as never,
    ]);
    vi.mocked(isWarmedUp).mockResolvedValue(true);

    const result = await approveContentToPRWithAutopublish(5, 1);

    expect(result.batchId).toBe(20);
    expect(isWarmedUp).toHaveBeenCalledWith("content");
    expect(armHold).toHaveBeenCalledWith(20);
  });

  it("does NOT arm a hold when the content lane is not warmed up — behaves like a normal PR", async () => {
    vi.mocked(getDb).mockResolvedValue({ insert: () => ({ values: () => Promise.resolve([{ insertId: 21 }]) }) } as never);
    vi.mocked(listAuditLog).mockResolvedValue([
      { id: 1, ts: new Date(), actorId: null, action: "draft_generated", batchId: null, pagePath: null, before: null, after: { lane: "content", topicId: 5, post: goodPost, metaLint: { passes: true, findings: [] }, contentLint: { passes: true, findings: [] }, criticBlocked: false, criticClaims: [], passes: true }, lintResult: null } as never,
    ]);
    vi.mocked(isWarmedUp).mockResolvedValue(false);

    await approveContentToPRWithAutopublish(5, 1);

    expect(armHold).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("fs", () => ({ default: { readFileSync: vi.fn(() => "export const blogPosts = [];") } }));
vi.mock("./contentQueue", () => ({ nextTopicToProcess: vi.fn(), updateQueueStatus: vi.fn() }));
vi.mock("./contentDrafting", () => ({ draftContentPost: vi.fn(), ContentDraftParseError: class ContentDraftParseError extends Error {} }));
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
vi.mock("./batchBranches", () => ({
  uniqueBranchFor: vi.fn(async (base: string) => base),
  findOpenBatchWithPrefix: vi.fn(async () => null),
  CONTENT_BRANCH_PREFIX: "pr-content-",
}));
vi.mock("./warmupGate", () => ({ isWarmedUp: vi.fn() }));
vi.mock("./autoMerge", () => ({ armHold: vi.fn() }));

import { getDb } from "../../db";
import { nextTopicToProcess, updateQueueStatus } from "./contentQueue";
import { draftContentPost, ContentDraftParseError } from "./contentDrafting";
import { runCriticPass } from "./criticPass";
import { checkCircuitBreakerConditions } from "./circuitBreaker";
import { logAudit, listAuditLog } from "./auditLog";
import { isGithubConfigured, ensureBranch, getFileContent, putFileContent, openOrGetPR } from "./github";
import { isWarmedUp } from "./warmupGate";
import { uniqueBranchFor, findOpenBatchWithPrefix } from "./batchBranches";
import { armHold } from "./autoMerge";
import { runWeeklyContentJob, findLatestContentDraft, approveContentToPR, approveContentToPRWithAutopublish, ContentNotReadyError, describeFinding, collectBlockingFindings } from "./contentPipeline";
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
  vi.mocked(uniqueBranchFor).mockReset().mockImplementation(async (base: string) => base);
  vi.mocked(findOpenBatchWithPrefix).mockReset().mockResolvedValue(null);
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

  it("marks the draft as not passing when the critic blocks it, and never auto-approves a failing draft even if warmed up", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue(topic);
    vi.mocked(draftContentPost).mockResolvedValue(goodPost as never);
    vi.mocked(runCriticPass).mockResolvedValue({ passes: false, unsupportedClaims: ["some claim"], model: "claude-opus-4-8" });
    vi.mocked(isWarmedUp).mockResolvedValue(true);

    const result = await runWeeklyContentJob(factsWithIncentive);
    expect(result.status).toBe("drafted");
    if (result.status === "drafted") {
      expect(result.passes).toBe(false);
      expect(result.autoApproved).toBe(false);
    }
    expect(armHold).not.toHaveBeenCalled();
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
    expect(ensureBranch).toHaveBeenCalledWith(expect.stringMatching(/^pr-content-\d{8}-t5$/));
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
    expect(ensureBranch).toHaveBeenCalledWith("pr-content-20260926-t5");
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

describe("runWeeklyContentJob — findings retry (max 2 retries, then set aside and move on)", () => {
  const shortPost = { ...goodPost, sections: [{ type: "intro", content: paragraphOf(50) }, { type: "cta_box", content: "Talk to us.", buttonText: "Get a Quote", buttonUrl: "https://mechanicalenterprise.com/commercial" }] };
  const topicB: SeoContentQueueRow = { ...topic, id: 6, title: "Preventive Maintenance Checklist for Building Owners" };
  const criticOk = { passes: true, unsupportedClaims: [], model: "claude-opus-4-8" };

  it("retries a failing draft with its findings fed back, and stops at the first passing attempt", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue(topic);
    vi.mocked(draftContentPost).mockResolvedValueOnce(shortPost as never).mockResolvedValueOnce(goodPost as never);
    vi.mocked(runCriticPass).mockResolvedValue(criticOk);

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(draftContentPost).toHaveBeenCalledTimes(2);
    expect(vi.mocked(draftContentPost).mock.calls[0][2]).toEqual([]);
    expect((vi.mocked(draftContentPost).mock.calls[1][2] as string[]).some((f) => f.startsWith("word_count:"))).toBe(true);
    expect(result.status).toBe("drafted");
    if (result.status === "drafted") {
      expect(result.passes).toBe(true);
      expect(result.attempts).toBe(2);
      expect(result.blockedTopicIds).toEqual([]);
    }
    expect(logAudit).toHaveBeenCalledTimes(1); // only the final attempt is stored
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ after: expect.objectContaining({ passes: true, attempts: 2 }) }));
  });

  it("feeds critic claims back too", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue(topic);
    vi.mocked(draftContentPost).mockResolvedValue(goodPost as never);
    vi.mocked(runCriticPass).mockResolvedValueOnce({ passes: false, unsupportedClaims: ["we serve all of NJ"], model: "m" }).mockResolvedValueOnce(criticOk);

    await runWeeklyContentJob(factsWithIncentive);

    expect((vi.mocked(draftContentPost).mock.calls[1][2] as string[]).some((f) => f.includes("we serve all of NJ"))).toBe(true);
  });

  it("makes at most 1 + 2 draft attempts per topic, then sets it aside (blocked: true) and moves on to the next topic", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValueOnce(topic).mockResolvedValueOnce(topicB);
    vi.mocked(draftContentPost)
      .mockResolvedValueOnce(shortPost as never).mockResolvedValueOnce(shortPost as never).mockResolvedValueOnce(shortPost as never) // topic A: all 3 fail
      .mockResolvedValueOnce(goodPost as never); // topic B passes first try
    vi.mocked(runCriticPass).mockResolvedValue(criticOk);

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(draftContentPost).toHaveBeenCalledTimes(4);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ after: expect.objectContaining({ topicId: 5, passes: false, blocked: true, attempts: 3 }) }));
    expect(updateQueueStatus).toHaveBeenCalledWith(5, "drafted"); // stays out of the queued/refresh_due pool
    expect(result.status).toBe("drafted");
    if (result.status === "drafted") {
      expect(result.topicId).toBe(6);
      expect(result.passes).toBe(true);
      expect(result.blockedTopicIds).toEqual([5]);
    }
  });

  it("never auto-approves or opens a PR for a blocked topic, even when warmed up", async () => {
    process.env.SEO_AUTOPUBLISH_ENABLED = "true";
    vi.mocked(nextTopicToProcess).mockResolvedValueOnce(topic).mockResolvedValueOnce(null);
    vi.mocked(draftContentPost).mockResolvedValue(shortPost as never);
    vi.mocked(runCriticPass).mockResolvedValue(criticOk);
    vi.mocked(isWarmedUp).mockResolvedValue(true);

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(result.status).toBe("drafted");
    if (result.status === "drafted") {
      expect(result.passes).toBe(false);
      expect(result.autoApproved).toBe(false);
      expect(result.blockedTopicIds).toEqual([5]);
    }
    expect(armHold).not.toHaveBeenCalled();
    expect(ensureBranch).not.toHaveBeenCalled();
    delete process.env.SEO_AUTOPUBLISH_ENABLED;
  });

  it("stops after MAX_BLOCKED_TOPICS_PER_RUN blocked topics", async () => {
    vi.mocked(nextTopicToProcess)
      .mockResolvedValueOnce({ ...topic, id: 11 }).mockResolvedValueOnce({ ...topic, id: 12 }).mockResolvedValueOnce({ ...topic, id: 13 }).mockResolvedValueOnce({ ...topic, id: 14 });
    vi.mocked(draftContentPost).mockResolvedValue(shortPost as never);
    vi.mocked(runCriticPass).mockResolvedValue(criticOk);

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(draftContentPost).toHaveBeenCalledTimes(9); // 3 topics x 3 attempts, never a 4th topic
    expect(result.status).toBe("drafted");
    if (result.status === "drafted") expect(result.blockedTopicIds).toEqual([11, 12, 13]);
  });

  it("treats an unparseable draft as a failed attempt and retries", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue(topic);
    vi.mocked(draftContentPost).mockRejectedValueOnce(new ContentDraftParseError("garbage")).mockResolvedValueOnce(goodPost as never);
    vi.mocked(runCriticPass).mockResolvedValue(criticOk);

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(result.status === "drafted" && result.passes && result.attempts).toBe(2);
    expect((vi.mocked(draftContentPost).mock.calls[1][2] as string[]).some((f) => f.startsWith("invalid_json"))).toBe(true);
  });

  it("does NOT swallow non-parse errors (e.g. API out of credits) — the job fails loudly and the topic stays queued", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue(topic);
    vi.mocked(draftContentPost).mockRejectedValue(new Error("Content drafting call failed: out of credits"));

    await expect(runWeeklyContentJob(factsWithIncentive)).rejects.toThrow(/out of credits/);
    expect(updateQueueStatus).not.toHaveBeenCalled();
  });
});

describe("one PR per topic, one open content PR at a time", () => {
  it("each topic gets its own branch name (pr-content-YYYYMMDD-t<topicId>), asked through uniqueBranchFor so a reused name gets a suffix", async () => {
    vi.mocked(uniqueBranchFor).mockResolvedValue("pr-content-20260926-t5-2");
    vi.mocked(listAuditLog).mockResolvedValue([
      { id: 1, ts: new Date(), actorId: null, action: "draft_generated", batchId: null, pagePath: null, before: null, after: { lane: "content", topicId: 5, post: goodPost, metaLint: { passes: true, findings: [] }, contentLint: { passes: true, findings: [] }, criticBlocked: false, criticClaims: [], passes: true }, lintResult: null } as never,
    ]);
    vi.mocked(getDb).mockResolvedValue({ insert: () => ({ values: () => Promise.resolve([{ insertId: 3 }]) }) } as never);

    await approveContentToPR(5, 1);

    expect(uniqueBranchFor).toHaveBeenCalledWith("pr-content-20260926-t5");
    expect(ensureBranch).toHaveBeenCalledWith("pr-content-20260926-t5-2");
  });

  it("does not draft (returns open_pr) while a content PR is open and the lane would auto-publish", async () => {
    process.env.SEO_AUTOPUBLISH_ENABLED = "true";
    vi.mocked(isWarmedUp).mockResolvedValue(true);
    vi.mocked(findOpenBatchWithPrefix).mockResolvedValue({ id: 9, prNumber: 150, branch: "pr-content-20260926-t4" } as never);

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(result).toEqual({ status: "open_pr", batchId: 9, prNumber: 150 });
    expect(nextTopicToProcess).not.toHaveBeenCalled();
    expect(draftContentPost).not.toHaveBeenCalled();
    delete process.env.SEO_AUTOPUBLISH_ENABLED;
  });

  it("the open-PR guard does not apply when the lane would not auto-publish (manual 'Draft next topic now' still works)", async () => {
    process.env.SEO_AUTOPUBLISH_ENABLED = "true";
    vi.mocked(isWarmedUp).mockResolvedValue(false);
    vi.mocked(findOpenBatchWithPrefix).mockResolvedValue({ id: 9, prNumber: 150, branch: "pr-content-20260926-t4" } as never);
    vi.mocked(nextTopicToProcess).mockResolvedValue(null);

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(result.status).toBe("no_topic");
    expect(findOpenBatchWithPrefix).not.toHaveBeenCalled();
    delete process.env.SEO_AUTOPUBLISH_ENABLED;
  });

  it("drafts normally when no content PR is open", async () => {
    process.env.SEO_AUTOPUBLISH_ENABLED = "true";
    vi.mocked(isWarmedUp).mockResolvedValue(true);
    vi.mocked(nextTopicToProcess).mockResolvedValue(null);
    expect((await runWeeklyContentJob(factsWithIncentive)).status).toBe("no_topic");
    expect(findOpenBatchWithPrefix).toHaveBeenCalledWith("pr-content-");
    delete process.env.SEO_AUTOPUBLISH_ENABLED;
  });
});

describe("runWeeklyContentJob — a malformed-section draft is a failed attempt that is retried with the reason, not a crash", () => {
  it("retries after a shape error and feeds the reason back to the model", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue(topic);
    vi.mocked(draftContentPost)
      .mockRejectedValueOnce(new ContentDraftParseError('section 4 (paragraph) is missing its "content" string'))
      .mockResolvedValueOnce(goodPost as never);
    vi.mocked(runCriticPass).mockResolvedValue({ passes: true, unsupportedClaims: [], model: "claude-opus-4-8" });

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(result.status === "drafted" && result.passes && result.attempts).toBe(2);
    const feedback = (vi.mocked(draftContentPost).mock.calls[1][2] as string[]).find((f) => f.startsWith("invalid_json"));
    expect(feedback).toContain('section 4 (paragraph) is missing its "content" string');
    expect(feedback).toContain("every section complete");
  });
});

describe("describeFinding / collectBlockingFindings — a word-count finding says what to DO (811 words did not move the model in 3 retries)", () => {
  it("under the minimum: how many words to add and where they come from", () => {
    const msg = describeFinding("word_count", "Body is 811 words (must be 900-1400).");
    expect(msg).toContain("word_count: Body is 811 words");
    expect(msg).toContain("289 MORE words");
    expect(msg).toContain("~1100 total");
    expect(msg).toContain("expand your shortest sections");
    expect(msg).toContain("Do not pad");
  });

  it("over the maximum: how many to cut", () => {
    const msg = describeFinding("word_count", "Body is 1500 words (must be 900-1400).");
    expect(msg).toContain("Cut about 400 words");
  });

  it("other findings keep the plain code: message form, and an unparseable word_count falls back to it", () => {
    expect(describeFinding("title_too_long", "Title is 76 characters (max 60).")).toBe("title_too_long: Title is 76 characters (max 60).");
    expect(describeFinding("word_count", "weird message")).toBe("word_count: weird message");
  });

  it("collectBlockingFindings uses it for content-lint word_count blocks, and still skips warnings", () => {
    const out = collectBlockingFindings({
      metaLint: { passes: true, findings: [] },
      contentLint: { passes: false, findings: [{ severity: "block", code: "word_count", message: "Body is 811 words (must be 900-1400)." }, { severity: "warn", code: "reading_level", message: "hard" }] },
      critic: { passes: true, unsupportedClaims: [], model: "m" },
    } as never);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("289 MORE words");
  });
});

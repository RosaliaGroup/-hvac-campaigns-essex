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

import { getDb } from "../../db";
import { nextTopicToProcess, updateQueueStatus } from "./contentQueue";
import { draftContentPost } from "./contentDrafting";
import { runCriticPass } from "./criticPass";
import { checkCircuitBreakerConditions } from "./circuitBreaker";
import { logAudit, listAuditLog } from "./auditLog";
import { isGithubConfigured, ensureBranch, getFileContent, putFileContent, openOrGetPR } from "./github";
import { runWeeklyContentJob, findLatestContentDraft, approveContentToPR, ContentNotReadyError } from "./contentPipeline";
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
    const result = await runWeeklyContentJob(VERIFIED_FACTS); // empty incentives
    expect(result).toEqual({ status: "facts_not_configured" });
    expect(draftContentPost).not.toHaveBeenCalled();
  });

  it("drafts, lints, runs the critic, and stores a clean draft as passing", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue(topic);
    vi.mocked(draftContentPost).mockResolvedValue(goodPost as never);
    vi.mocked(runCriticPass).mockResolvedValue({ passes: true, unsupportedClaims: [], model: "claude-opus-4-8" });

    const result = await runWeeklyContentJob(factsWithIncentive);

    expect(result.status).toBe("drafted");
    if (result.status === "drafted") {
      expect(result.passes).toBe(true);
    }
    expect(updateQueueStatus).toHaveBeenCalledWith(topic.id, "drafted");
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "draft_generated", after: expect.objectContaining({ lane: "content", passes: true }) }));
  });

  it("marks the draft as not passing when the critic blocks it", async () => {
    vi.mocked(nextTopicToProcess).mockResolvedValue(topic);
    vi.mocked(draftContentPost).mockResolvedValue(goodPost as never);
    vi.mocked(runCriticPass).mockResolvedValue({ passes: false, unsupportedClaims: ["some claim"], model: "claude-opus-4-8" });

    const result = await runWeeklyContentJob(factsWithIncentive);
    expect(result.status).toBe("drafted");
    if (result.status === "drafted") expect(result.passes).toBe(false);
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

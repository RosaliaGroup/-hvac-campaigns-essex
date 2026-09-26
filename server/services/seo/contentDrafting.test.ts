import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../_core/anthropic", () => ({ callAnthropicModelChain: vi.fn() }));

import { callAnthropicModelChain } from "../../_core/anthropic";
import { draftContentPost, ContentDraftUnavailableError, ContentDraftParseError } from "./contentDrafting";
import { VERIFIED_FACTS } from "../../../shared/verifiedFacts";
import type { SeoContentQueueRow } from "../../../drizzle/schema";

const ok = (text: string) => ({ ok: true as const, text, model: "claude-sonnet-5", usage: undefined });
const fail = (error: string) => ({ ok: false as const, error, status: 500, code: "test" });

const topic: SeoContentQueueRow = {
  id: 1,
  title: "PTAC vs Mini-Split vs VRF for Multifamily Retrofits",
  targetQuery: null,
  audience: "property managers",
  brief: "Comparing options.",
  status: "queued",
  source: "seed",
  contentBatchId: null,
  refreshesSlug: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const validPost = {
  title: "PTAC vs Mini-Split vs VRF for Multifamily Retrofits",
  slug: "ptac-vs-mini-split-vs-vrf",
  date: "September 26, 2026",
  readTime: "8 min read",
  category: "Commercial",
  metaDescription: "Comparing PTAC, mini-split, and VRF for multifamily retrofits.",
  excerpt: "An overview for property managers.",
  sections: [{ type: "intro", content: "..." }],
};

const originalKey = process.env.ANTHROPIC_API_KEY;
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  vi.mocked(callAnthropicModelChain).mockReset();
});
afterEach(() => {
  process.env.ANTHROPIC_API_KEY = originalKey;
});

describe("draftContentPost", () => {
  it("throws ContentDraftUnavailableError without an API key, never calling the model", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(draftContentPost(topic, VERIFIED_FACTS)).rejects.toThrow(ContentDraftUnavailableError);
    expect(callAnthropicModelChain).not.toHaveBeenCalled();
  });

  it("parses a valid JSON response into a BlogPostData", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok(JSON.stringify(validPost)));
    const post = await draftContentPost(topic, VERIFIED_FACTS);
    expect(post.title).toBe(validPost.title);
    expect(post.slug).toBe(validPost.slug);
  });

  it("tolerates the model wrapping the JSON in prose/code fences", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok("```json\n" + JSON.stringify(validPost) + "\n```"));
    const post = await draftContentPost(topic, VERIFIED_FACTS);
    expect(post.slug).toBe(validPost.slug);
  });

  it("throws ContentDraftParseError on unparseable output", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok("I cannot help with that."));
    await expect(draftContentPost(topic, VERIFIED_FACTS)).rejects.toThrow(ContentDraftParseError);
  });

  it("throws ContentDraftParseError when required fields are missing", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok(JSON.stringify({ title: "x" })));
    await expect(draftContentPost(topic, VERIFIED_FACTS)).rejects.toThrow(ContentDraftParseError);
  });

  it("propagates a plain error when the API call itself fails", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(fail("rate limited"));
    await expect(draftContentPost(topic, VERIFIED_FACTS)).rejects.toThrow(/rate limited/);
  });

  it("embeds VERIFIED_FACTS and the topic's brief in the system prompt", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok(JSON.stringify(validPost)));
    await draftContentPost(topic, VERIFIED_FACTS);
    const call = vi.mocked(callAnthropicModelChain).mock.calls[0][0];
    expect(call.system).toContain(topic.brief);
    expect(call.system).toContain(JSON.stringify(VERIFIED_FACTS.business.legalName));
  });
});

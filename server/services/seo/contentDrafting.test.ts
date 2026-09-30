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

  it("passes the warranty positioning sentence and claim rules in the system prompt (docs/positioning-warranty-spec.md §6)", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok(JSON.stringify(validPost)));
    await draftContentPost(topic, VERIFIED_FACTS);
    const call = vi.mocked(callAnthropicModelChain).mock.calls[0][0];
    expect(call.system).toContain("Lead with installation quality, system fit and the optional 10-year parts & labor coverage.");
    expect(call.system).toContain("Never describe coverage as included or free.");
    expect(call.system.toLowerCase()).toContain("lifetime");
  });
});

describe("draftContentPost — findings feedback + budget", () => {
  it("requests the 16k token ceiling and a 180s per-attempt timeout (thinking tokens count against maxTokens)", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok(JSON.stringify(validPost)));
    await draftContentPost(topic, VERIFIED_FACTS);
    const opts = vi.mocked(callAnthropicModelChain).mock.calls[0][0] as { maxTokens: number; retry?: { timeoutMs?: number } };
    expect(opts.maxTokens).toBe(16000);
    expect(opts.retry?.timeoutMs).toBe(180_000);
  });

  it("puts prior findings in the system prompt as must-fix items", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok(JSON.stringify(validPost)));
    await draftContentPost(topic, VERIFIED_FACTS, ['warranty_wrong_year_count: "20 year" appears near coverage', "word_count: Body is 789 words"]);
    const system = (vi.mocked(callAnthropicModelChain).mock.calls[0][0] as { system: string }).system;
    expect(system).toContain("PREVIOUS DRAFT OF THIS TOPIC WAS BLOCKED");
    expect(system).toContain("- warranty_wrong_year_count");
    expect(system).toContain("- word_count: Body is 789 words");
  });

  it("omits the findings block when there are no prior findings", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok(JSON.stringify(validPost)));
    await draftContentPost(topic, VERIFIED_FACTS);
    expect((vi.mocked(callAnthropicModelChain).mock.calls[0][0] as { system: string }).system).not.toContain("PREVIOUS DRAFT");
  });
});

describe("draftContentPost — length limits the linter enforces are in the prompt (they were missing, so 9 of 16 topics blocked on title_too_long)", () => {
  const systemFor = async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok(JSON.stringify(validPost)));
    await draftContentPost(topic, VERIFIED_FACTS);
    return (vi.mocked(callAnthropicModelChain).mock.calls[0][0] as { system: string }).system;
  };

  it("tells the model the title is AT MOST 60 characters and that the topic text is a subject, not the title", async () => {
    const s = await systemFor();
    expect(s).toContain("AT MOST 60 characters");
    expect(s).toContain("a SUBJECT, not the title");
  });

  it("tells the model the meta description is AT MOST 155 characters (aim 140-150)", async () => {
    const s = await systemFor();
    expect(s).toContain("AT MOST 155 characters");
    expect(s).toContain("140-150");
  });

  it("asks for 1,000-1,250 words, inside the linter's 900-1400 window rather than at its edge", async () => {
    const s = await systemFor();
    expect(s).toContain("1,000-1,250 words");
    expect(s).toContain("under 900 or over 1,400");
    expect(s).not.toContain("- 900-1400 words total");
  });
});

describe("parseContentDraftResponse — structurally broken sections are a retryable parse error, not a crash (a missing 'content' took a drain down with a TypeError)", () => {
  const withSections = (sections: unknown[], extra: Record<string, unknown> = {}) => ok(JSON.stringify({ ...validPost, sections, ...extra }));

  it.each([
    ["an intro with no content", [{ type: "intro" }]],
    ["an h2 with an empty content", [{ type: "h2", content: "   " }]],
    ["a checklist with no items", [{ type: "checklist" }]],
    ["a checklist with a non-string item", [{ type: "checklist", items: ["ok", 3] }]],
    ["a numbered_list with an empty items array", [{ type: "numbered_list", items: [] }]],
    ["a cta_box with no buttonUrl", [{ type: "cta_box", content: "Talk to us", buttonText: "Go" }]],
    ["an unknown section type", [{ type: "image", content: "x" }]],
    ["a section that is not an object", ["just a string"]],
    ["an empty sections array", []],
  ])("rejects %s with ContentDraftParseError naming the section", async (_label, sections) => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(withSections(sections as unknown[]));
    await expect(draftContentPost(topic, VERIFIED_FACTS)).rejects.toBeInstanceOf(ContentDraftParseError);
  });

  it("the error says WHICH section and what is missing, so the retry can be told", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(withSections([{ type: "intro", content: "fine" }, { type: "paragraph" }]));
    await expect(draftContentPost(topic, VERIFIED_FACTS)).rejects.toThrow(/section 1 \(paragraph\) is missing its "content"/);
  });

  it("rejects a missing/empty metaDescription or excerpt, and a malformed faqSchema", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok(JSON.stringify({ ...validPost, metaDescription: "" })));
    await expect(draftContentPost(topic, VERIFIED_FACTS)).rejects.toThrow(/metaDescription/);
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok(JSON.stringify({ ...validPost, faqSchema: [{ question: "Q only" }] })));
    await expect(draftContentPost(topic, VERIFIED_FACTS)).rejects.toThrow(/faqSchema\[0\]/);
  });

  it("still accepts a well-formed post with every section type and an FAQ", async () => {
    const sections = [
      { type: "intro", content: "Hello." }, { type: "h2", content: "Heading" }, { type: "paragraph", content: "Body." },
      { type: "stat_box", content: "A fact." }, { type: "checklist", items: ["a", "b"] }, { type: "numbered_list", items: ["1", "2"] },
      { type: "cta_box", content: "Call.", buttonText: "Quote", buttonUrl: "https://mechanicalenterprise.com/commercial" },
    ];
    vi.mocked(callAnthropicModelChain).mockResolvedValue(withSections(sections, { faqSchema: [{ question: "Q?", answer: "A." }] }));
    const post = await draftContentPost(topic, VERIFIED_FACTS);
    expect(post.sections).toHaveLength(7);
  });
});

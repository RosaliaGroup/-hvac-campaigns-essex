/**
 * Tests for the real (Anthropic) AI drafting provider. Mocks
 * callAnthropicModelChain() (already covered end-to-end, including retry/
 * fallback/error-classification, by server/_core/anthropic.test.ts) so these
 * tests isolate this file's own logic: prompt-driven title/meta generation,
 * the lint-then-retry-then-throw safety gate, and delegation to the mock for
 * everything outside title/meta's scope.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../_core/anthropic", () => ({
  callAnthropicModelChain: vi.fn(),
}));

import { callAnthropicModelChain } from "../../../_core/anthropic";
import { AnthropicOptimizationProvider, AiDraftLintFailedError, INSTALL_TITLE_WARRANTY_PHRASE, INSTALL_TITLE_EXAMPLE } from "./anthropicProvider";
import { lintPageMeta } from "@shared/seoLinter";
import { MockAiOptimizationProvider } from "./optimizationProvider";
import type { PageContext } from "./optimizationProvider";
import { PHONE_DISPLAY } from "@shared/business";

function ok(text: string) {
  return { ok: true as const, text, model: "claude-sonnet-5" };
}
function fail(error: string) {
  return { ok: false as const, error };
}

function ctx(overrides: Partial<PageContext> = {}): PageContext {
  return {
    page: "/hvac-elizabeth-nj",
    url: "https://mechanicalenterprise.com/hvac-elizabeth-nj",
    title: "Old title",
    metaDescription: "Old meta description.",
    h1: "Old H1",
    category: "residential",
    clicks: 10,
    impressions: 5000,
    ctr: 0.002,
    position: 12,
    problems: [],
    topQueries: ["hvac elizabeth nj", "heat pump installation elizabeth"],
    bodyExcerpt: "Licensed HVAC contractor serving Elizabeth, NJ with heat pump and AC installation.",
    cityUtilityTerritory: "pseg",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(callAnthropicModelChain).mockReset();
  delete process.env.SEO_AI_MODEL;
});

describe("AnthropicOptimizationProvider — model identity", () => {
  it("defaults to claude-sonnet-5", () => {
    const p = new AnthropicOptimizationProvider("key");
    expect(p.model).toBe("anthropic-claude-sonnet-5");
  });

  it("honors SEO_AI_MODEL override", () => {
    process.env.SEO_AI_MODEL = "claude-opus-4-8";
    const p = new AnthropicOptimizationProvider("key");
    expect(p.model).toBe("anthropic-claude-opus-4-8");
  });
});

describe("AnthropicOptimizationProvider — generateTitle / generateMetaDescription", () => {
  it("returns a clean title from a passing generation, calling the API once", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValueOnce(ok("Elizabeth NJ HVAC Installation | Mechanical Enterprise"));
    const p = new AnthropicOptimizationProvider("key");

    const title = await p.generateTitle(ctx());

    expect(title).toBe("Elizabeth NJ HVAC Installation | Mechanical Enterprise");
    expect(callAnthropicModelChain).toHaveBeenCalledTimes(1);
  });

  it("strips a wrapping quote pair the model adds despite being told not to", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValueOnce(ok('"Elizabeth NJ HVAC Installation | Mechanical Enterprise"'));
    const p = new AnthropicOptimizationProvider("key");

    expect(await p.generateTitle(ctx())).toBe("Elizabeth NJ HVAC Installation | Mechanical Enterprise");
  });

  it("passes the canonical phone number and the linter rules in the system prompt", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValueOnce(ok("Clean Title"));
    const p = new AnthropicOptimizationProvider("key");
    await p.generateTitle(ctx());

    const call = vi.mocked(callAnthropicModelChain).mock.calls[0][0];
    expect(call.system).toContain(PHONE_DISPLAY);
    expect(call.system).toContain("#1");
    expect(call.system).toContain("25C");
  });

  it("passes the warranty positioning sentence and claim rules in the system prompt (docs/positioning-warranty-spec.md §6)", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValueOnce(ok("Clean Title"));
    const p = new AnthropicOptimizationProvider("key");
    await p.generateTitle(ctx());

    const call = vi.mocked(callAnthropicModelChain).mock.calls[0][0];
    expect(call.system).toContain("Lead with installation quality, system fit and the optional 10-year parts & labor coverage.");
    expect(call.system).toContain("Never describe coverage as included or free.");
    expect(call.system.toLowerCase()).toContain("lifetime");
  });

  it("passes topQueries, bodyExcerpt, and cityUtilityTerritory into the user prompt", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValueOnce(ok("Clean Meta Description Under The Limit."));
    const p = new AnthropicOptimizationProvider("key");
    await p.generateMetaDescription(ctx());

    const call = vi.mocked(callAnthropicModelChain).mock.calls[0][0];
    const userMessage = (call.messages[0] as { content: string }).content;
    expect(userMessage).toContain("heat pump installation elizabeth");
    expect(userMessage).toContain("Licensed HVAC contractor serving Elizabeth");
    expect(userMessage).toContain("pseg");
  });

  it("retries once with the lint failure fed back, then succeeds", async () => {
    vi.mocked(callAnthropicModelChain)
      .mockResolvedValueOnce(ok("#1 HVAC Contractor in Elizabeth, NJ"))
      .mockResolvedValueOnce(ok("Elizabeth NJ HVAC Contractor | Mechanical Enterprise"));
    const p = new AnthropicOptimizationProvider("key");

    const title = await p.generateTitle(ctx());

    expect(title).toBe("Elizabeth NJ HVAC Contractor | Mechanical Enterprise");
    expect(callAnthropicModelChain).toHaveBeenCalledTimes(2);
    const retryMessage = (vi.mocked(callAnthropicModelChain).mock.calls[1][0].messages[0] as { content: string }).content;
    expect(retryMessage).toMatch(/REJECTED by the compliance linter/);
    expect(retryMessage).toMatch(/superlative/i);
  });

  it("throws AiDraftLintFailedError when the retry still fails, and makes no third call", async () => {
    vi.mocked(callAnthropicModelChain)
      .mockResolvedValueOnce(ok("#1 HVAC Contractor"))
      .mockResolvedValueOnce(ok("Still #1 HVAC Contractor"));
    const p = new AnthropicOptimizationProvider("key");

    await expect(p.generateTitle(ctx())).rejects.toBeInstanceOf(AiDraftLintFailedError);
    expect(callAnthropicModelChain).toHaveBeenCalledTimes(2);
  });

  it("propagates a plain error when the API call itself fails", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValueOnce(fail("The AI service is out of credits."));
    const p = new AnthropicOptimizationProvider("key");

    await expect(p.generateTitle(ctx())).rejects.toThrow(/out of credits/);
  });

  it("meta description generation lints against the CURRENT title, and vice versa", async () => {
    // A clean meta paired with the page's existing (compliant) title should pass on the first try.
    vi.mocked(callAnthropicModelChain).mockResolvedValueOnce(ok("Book a free assessment for HVAC installation in Elizabeth, NJ."));
    const p = new AnthropicOptimizationProvider("key");

    const meta = await p.generateMetaDescription(ctx({ title: "Elizabeth NJ HVAC Contractor" }));
    expect(meta).toBe("Book a free assessment for HVAC installation in Elizabeth, NJ.");
    expect(callAnthropicModelChain).toHaveBeenCalledTimes(1);
  });
});

describe("AnthropicOptimizationProvider — everything outside title/meta delegates to the mock", () => {
  it("generateH1/Faq/InternalLinks/Schema/expandContent match a raw MockAiOptimizationProvider for the same context", async () => {
    const p = new AnthropicOptimizationProvider("key");
    const mock = new MockAiOptimizationProvider();
    const c = ctx();

    expect(await p.generateH1(c)).toBe(await mock.generateH1(c));
    expect(await p.generateFaq(c)).toEqual(await mock.generateFaq(c));
    expect(await p.generateInternalLinks(c)).toEqual(await mock.generateInternalLinks(c));
    expect(await p.generateSchema(c)).toEqual(await mock.generateSchema(c));
    expect(await p.expandContent(c)).toBe(await mock.expandContent(c));
    expect(callAnthropicModelChain).not.toHaveBeenCalled();
  });
});

describe("AnthropicOptimizationProvider — output budget and owner rules in the prompt", () => {
  it("requests a token budget large enough that thinking tokens can't truncate or empty the title/meta (300 did)", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok("Clean Title"));
    const p = new AnthropicOptimizationProvider("key");
    await p.generateTitle(ctx());
    await p.generateMetaDescription(ctx());
    for (const [opts] of vi.mocked(callAnthropicModelChain).mock.calls) expect((opts as { maxTokens: number }).maxTokens).toBeGreaterThanOrEqual(1000);
  });

  it("tells the model the range / 24-7 / same-day rules and that rebates are never the first clause of a title", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValueOnce(ok("Clean Title"));
    await new AnthropicOptimizationProvider("key").generateTitle(ctx());
    const system = (vi.mocked(callAnthropicModelChain).mock.calls[0][0] as { system: string }).system;
    expect(system).toContain("Never write a dollar range");
    expect(system).toContain("24/7");
    expect(system).toContain("same-day");
    expect(system).toContain("never the first clause of a title");
  });
});

describe("install-page titles carry '10-Year Parts & Labor' when it fits within 60 characters", () => {
  const userPrompt = () => (vi.mocked(callAnthropicModelChain).mock.calls[0][0].messages[0] as { content: string }).content;
  const titleFor = async (page: string) => {
    vi.mocked(callAnthropicModelChain).mockReset().mockResolvedValueOnce(ok("Clean Title"));
    await new AnthropicOptimizationProvider("key").generateTitle(ctx({ page, url: `https://mechanicalenterprise.com${page}` }));
    return userPrompt();
  };

  it("tells the model to include the exact phrase, optionally, within 60 characters — and never as included/free", async () => {
    const p = await titleFor("/heat-pump-installation-nj");
    expect(p).toContain(INSTALL_TITLE_WARRANTY_PHRASE);
    expect(p).toContain("If it fits within 60 characters");
    expect(p).toContain("never exceed 60 characters");
    expect(p).toContain("never as included, free or standard");
    expect(p).toContain(INSTALL_TITLE_EXAMPLE);
  });

  it.each([
    "/heat-pump-installation-nj", "/central-ac-installation-nj", "/ductless-mini-split-installation-nj", "/vrv-vrf-installation-nj",
    "/commercial-hvac-installation-nj", "/hvac-union-nj", "/hvac-elizabeth-nj",
  ])("applies on installation and city page %s", async (page) => {
    expect(await titleFor(page)).toContain(INSTALL_TITLE_WARRANTY_PHRASE);
  });

  it.each([
    "/blog/heat-pump-vs-furnace-total-cost-of-ownership-10-years", "/direct-install/bakeries-nj", "/about", "/contact", "/warranty",
    "/residential", "/commercial", "/commercial/property-managers", "/ac-repair-nj", "/promos",
  ])("does NOT apply on %s", async (page) => {
    expect(await titleFor(page)).not.toContain(INSTALL_TITLE_WARRANTY_PHRASE);
  });

  it("is title-only: the meta-description prompt for an install page does not carry it", async () => {
    vi.mocked(callAnthropicModelChain).mockReset().mockResolvedValueOnce(ok("Clean Meta Description Under The Limit."));
    await new AnthropicOptimizationProvider("key").generateMetaDescription(ctx({ page: "/heat-pump-installation-nj" }));
    expect(userPrompt()).not.toContain(INSTALL_TITLE_WARRANTY_PHRASE);
  });

  it("is page-specific, so it lives in the USER prompt and not the shared system prompt", async () => {
    vi.mocked(callAnthropicModelChain).mockReset().mockResolvedValueOnce(ok("Clean Title"));
    await new AnthropicOptimizationProvider("key").generateTitle(ctx({ page: "/heat-pump-installation-nj" }));
    expect(vi.mocked(callAnthropicModelChain).mock.calls[0][0].system).not.toContain("This is an installation page");
  });

  it("is still present on the retry attempt, alongside the linter feedback", async () => {
    vi.mocked(callAnthropicModelChain).mockReset().mockResolvedValueOnce(ok("#1 Heat Pump Installation NJ")).mockResolvedValueOnce(ok("Heat Pump Installation NJ | 10-Year Parts & Labor"));
    const title = await new AnthropicOptimizationProvider("key").generateTitle(ctx({ page: "/heat-pump-installation-nj" }));
    const retry = (vi.mocked(callAnthropicModelChain).mock.calls[1][0].messages[0] as { content: string }).content;
    expect(title).toBe("Heat Pump Installation NJ | 10-Year Parts & Labor");
    expect(retry).toContain(INSTALL_TITLE_WARRANTY_PHRASE);
    expect(retry).toContain("REJECTED by the compliance linter");
  });

  it("the example the model is shown is itself within 60 characters and passes the linter with no findings — the prompt can't teach a title the linter would reject", () => {
    expect(INSTALL_TITLE_EXAMPLE.length).toBeLessThanOrEqual(60);
    expect(INSTALL_TITLE_EXAMPLE).toContain(INSTALL_TITLE_WARRANTY_PHRASE);
    const r = lintPageMeta({ pagePath: "/heat-pump-installation-nj", title: INSTALL_TITLE_EXAMPLE, metaDescription: "Heat pump installation with proper system sizing and optional 10-year parts & labor coverage." });
    expect(r.findings.filter((f) => f.severity === "block")).toEqual([]);
    expect(r.findings.map((f) => f.code)).not.toContain("title_leads_with_rebate");
  });

  it("the 'Optional …' variant it suggests also passes the linter and fits", () => {
    const t = `Heat Pump Installation NJ | Optional ${INSTALL_TITLE_WARRANTY_PHRASE}`;
    expect(t.length).toBeLessThanOrEqual(60);
    const r = lintPageMeta({ pagePath: "/heat-pump-installation-nj", title: t, metaDescription: "Heat pump installation with proper system sizing and optional 10-year parts & labor coverage." });
    expect(r.findings.filter((f) => f.severity === "block")).toEqual([]);
  });
});

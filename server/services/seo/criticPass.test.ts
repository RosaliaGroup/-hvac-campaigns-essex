import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../_core/anthropic", () => ({ callAnthropicModelChain: vi.fn() }));

import { callAnthropicModelChain } from "../../_core/anthropic";
import { runCriticPass } from "./criticPass";
import { VERIFIED_FACTS } from "../../../shared/verifiedFacts";

const ok = (text: string, model = "claude-opus-4-8") => ({ ok: true as const, text, model, usage: undefined });
const fail = (error: string) => ({ ok: false as const, error, status: 500, code: "test" });

const originalKey = process.env.ANTHROPIC_API_KEY;
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  vi.mocked(callAnthropicModelChain).mockReset();
});
afterEach(() => {
  process.env.ANTHROPIC_API_KEY = originalKey;
});

describe("runCriticPass", () => {
  it("fails closed when ANTHROPIC_API_KEY is not set — never even calls the API", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const verdict = await runCriticPass("Some post text.");
    expect(verdict.passes).toBe(false);
    expect(verdict.unsupportedClaims[0]).toMatch(/ANTHROPIC_API_KEY/);
    expect(callAnthropicModelChain).not.toHaveBeenCalled();
  });

  it("passes when the model returns an empty array", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok("[]"));
    const verdict = await runCriticPass("A generic, factless marketing post.");
    expect(verdict.passes).toBe(true);
    expect(verdict.unsupportedClaims).toEqual([]);
    expect(verdict.model).toBe("claude-opus-4-8");
  });

  it("fails with the listed claims when the model finds unsupported facts", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok('["$25,000 rebate", "since 1998"]'));
    const verdict = await runCriticPass("We've been saving customers money since 1998 with our $25,000 rebate program.");
    expect(verdict.passes).toBe(false);
    expect(verdict.unsupportedClaims).toEqual(["$25,000 rebate", "since 1998"]);
  });

  it("tolerates the model wrapping the JSON array in prose or a code fence", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok('Here you go:\n```json\n["a claim"]\n```'));
    const verdict = await runCriticPass("post");
    expect(verdict.unsupportedClaims).toEqual(["a claim"]);
  });

  it("fails closed on an unparseable response", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok("I cannot comply with this request."));
    const verdict = await runCriticPass("post");
    expect(verdict.passes).toBe(false);
    expect(verdict.unsupportedClaims[0]).toMatch(/not parseable/i);
  });

  it("fails closed when the API call itself fails", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(fail("rate limited"));
    const verdict = await runCriticPass("post");
    expect(verdict.passes).toBe(false);
    expect(verdict.unsupportedClaims[0]).toMatch(/rate limited/);
  });

  it("respects SEO_CRITIC_MODEL as the primary model in the chain", async () => {
    process.env.SEO_CRITIC_MODEL = "claude-sonnet-5";
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok("[]"));
    await runCriticPass("post");
    const call = vi.mocked(callAnthropicModelChain).mock.calls[0][0];
    expect(call.models[0]).toBe("claude-sonnet-5");
    delete process.env.SEO_CRITIC_MODEL;
  });

  it("the system prompt embeds VERIFIED_FACTS and the user message is ONLY the post text — no drafting prompt leaks in", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok("[]"));
    await runCriticPass("THE_POST_TEXT_MARKER");
    const call = vi.mocked(callAnthropicModelChain).mock.calls[0][0];
    expect(call.system).toContain(JSON.stringify(VERIFIED_FACTS.business.legalName));
    expect(call.messages).toEqual([{ role: "user", content: "THE_POST_TEXT_MARKER" }]);
  });
});

describe("critic prompt — facts-file values are SUPPORTED, real unsupported claims still are not", () => {
  const systemFor = async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok("[]"));
    await runCriticPass("body text", VERIFIED_FACTS);
    return (vi.mocked(callAnthropicModelChain).mock.calls[0][0] as { system: string }).system;
  };

  it("says a paraphrase of any verified-facts field is supported, naming the fields the critic wrongly flagged (#6 paid add-on, #16 /warranty)", async () => {
    const s = await systemFor();
    expect(s).toContain("restates or paraphrases ANY field of the verified facts");
    expect(s).toContain("warranty.included=false");
    expect(s).toContain("OPTIONAL PAID add-on");
    expect(s).toContain("warranty.termsUrl");
    expect(s).toContain("/warranty page");
    expect(s).toContain("with or without the mechanicalenterprise.com domain");
  });

  it("still defines a claim NOT in the facts as unsupported, with the #18 example (a general statistic with a number)", async () => {
    const s = await systemFor();
    expect(s).toContain("Claims that are NOT in the facts are still unsupported");
    expect(s).toContain("two service visits a year");
  });

  it("the verified facts it is told to rely on really do contain the values it is told to accept", () => {
    expect(VERIFIED_FACTS.warranty.included).toBe(false);
    expect(VERIFIED_FACTS.warranty.termsUrl).toBe("/warranty");
    expect(VERIFIED_FACTS.warranty.availableFor.join(" ")).toMatch(/new HVAC installations/);
  });

  it("the unsupported-claim verdict from the model is still reported (nothing was loosened in the parsing)", async () => {
    vi.mocked(callAnthropicModelChain).mockResolvedValue(ok('["most portfolios benefit from at least two scheduled maintenance visits per year"]'));
    const r = await runCriticPass("body text", VERIFIED_FACTS);
    expect(r.passes).toBe(false);
    expect(r.unsupportedClaims).toEqual(["most portfolios benefit from at least two scheduled maintenance visits per year"]);
  });
});

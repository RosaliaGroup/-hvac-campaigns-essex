import { describe, it, expect } from "vitest";
import {
  parseGeneratedContent,
  buildSystemPrompt,
  FACTUAL_RULES,
  generateSocialPost,
} from "./ai-content-generator";

describe("parseGeneratedContent", () => {
  it("parses a well-formed JSON payload", () => {
    const g = parseGeneratedContent(
      JSON.stringify({
        content: "Stay warm this winter.",
        hashtags: ["#HVAC", "#NJ"],
        callToAction: "Call now",
        imagePrompt: "a cozy home",
      }),
    );
    expect(g.content).toBe("Stay warm this winter.");
    expect(g.hashtags).toEqual(["#HVAC", "#NJ"]);
    expect(g.callToAction).toBe("Call now");
    expect(g.unverified).toBeUndefined();
    expect(g.parseError).toBeUndefined();
  });

  it("falls back safely on malformed JSON without throwing, preserving the raw payload", () => {
    const raw = "{ this is not valid json";
    const g = parseGeneratedContent(raw);
    expect(g.content).toBe(raw); // payload preserved for debugging
    expect(g.hashtags).toEqual([]);
    expect(g.unverified).toBe(true);
    expect(g.parseError).toBe(true);
  });
});

describe("factual guardrails", () => {
  it("system prompt forbids invention and does not ask for fictional content", () => {
    const prompt = buildSystemPrompt("facebook");
    expect(prompt).toContain(FACTUAL_RULES);
    expect(prompt).toMatch(/NEVER invent/i);
    // The old behaviour explicitly requested "fictional but realistic" stories.
    expect(prompt.toLowerCase()).not.toContain("fictional");
  });
});

/** Fake invoke that captures the messages and returns a fixed payload. */
function fakeInvoke(returnContent: string) {
  const calls: any[] = [];
  const invoke = (async (args: any) => {
    calls.push(args);
    return { choices: [{ message: { content: returnContent } }] } as any;
  }) as any;
  return { invoke, calls };
}

describe("generateSocialPost — no fabrication", () => {
  it("does not instruct the model to fabricate a customer testimonial", async () => {
    const { invoke, calls } = fakeInvoke(
      JSON.stringify({ content: "c", hashtags: [], callToAction: "cta", imagePrompt: "i" }),
    );
    await generateSocialPost("customer_testimonial", "facebook", { invoke });

    const userMsg = calls[0].messages.find((m: any) => m.role === "user").content as string;
    const sysMsg = calls[0].messages.find((m: any) => m.role === "system").content as string;
    expect(userMsg.toLowerCase()).not.toContain("fictional");
    expect(userMsg).toMatch(/do NOT fabricate/i);
    expect(sysMsg).toMatch(/NEVER invent/i);
  });

  it("tells the model NOT to include specifics when no verified facts are supplied", async () => {
    const { invoke, calls } = fakeInvoke(
      JSON.stringify({ content: "c", hashtags: [], callToAction: "cta", imagePrompt: "i" }),
    );
    await generateSocialPost("before_after", "instagram", { invoke });
    const userMsg = calls[0].messages.find((m: any) => m.role === "user").content as string;
    expect(userMsg).toMatch(/No verified job facts were provided/i);
  });

  it("passes caller-supplied verified facts to the model", async () => {
    const { invoke, calls } = fakeInvoke(
      JSON.stringify({ content: "c", hashtags: [], callToAction: "cta", imagePrompt: "i" }),
    );
    await generateSocialPost("before_after", "facebook", {
      invoke,
      facts: "Replaced a 20-year-old furnace with a Mitsubishi heat pump in Newark.",
    });
    const userMsg = calls[0].messages.find((m: any) => m.role === "user").content as string;
    expect(userMsg).toContain("Verified job facts");
    expect(userMsg).toContain("Mitsubishi heat pump");
  });

  it("returns an unverified fallback (not a crash) when the model returns malformed JSON", async () => {
    const { invoke } = fakeInvoke("<<not json>>");
    const g = await generateSocialPost("hvac_tip", "facebook", { invoke });
    expect(g.unverified).toBe(true);
    expect(g.parseError).toBe(true);
    expect(g.content).toBe("<<not json>>");
  });
});

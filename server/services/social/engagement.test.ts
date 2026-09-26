import { describe, it, expect } from "vitest";
import { classifySentiment, decideAutoReply, handleIncomingInteraction, type EngagementRepoDeps, type IncomingInteraction } from "./engagement";

function makeRepo() {
  const logged: any[] = [];
  const leads: any[] = [];
  const complaints: IncomingInteraction[] = [];
  const repo: EngagementRepoDeps = {
    logInteraction: async (row) => { logged.push(row); return logged.length; },
    createLead: async (row) => { leads.push(row); return leads.length; },
    notifyOwnerOfComplaint: async (interaction) => { complaints.push(interaction); },
  };
  return { repo, logged, leads, complaints };
}

describe("classifySentiment", () => {
  it("classifies positive/negative/neutral", () => {
    expect(classifySentiment("Thanks so much, you guys are awesome!")).toBe("positive");
    expect(classifySentiment("This was the worst experience, total scam.")).toBe("negative");
    expect(classifySentiment("What are your hours on Saturday?")).toBe("neutral");
  });
});

describe("decideAutoReply", () => {
  const base: IncomingInteraction = { platform: "facebook", postId: 1, externalId: "c1", authorName: "Alex", content: "", kind: "comment" };

  it("never auto-replies to negative sentiment, and always alerts the owner", () => {
    const decision = decideAutoReply({ ...base, content: "This is a scam, terrible service" }, "negative");
    expect(decision.shouldReply).toBe(false);
    if (!decision.shouldReply) expect(decision.alertOwner).toBe(true);
  });

  it("thank-you replies to a positive comment, no lead created", () => {
    const decision = decideAutoReply({ ...base, content: "Thanks so much!" }, "positive");
    expect(decision.shouldReply).toBe(true);
    if (decision.shouldReply) expect(decision.createLead).toBe(false);
  });

  it("'I'll DM you' + lead creation for a service-question DM", () => {
    const decision = decideAutoReply({ ...base, kind: "message", content: "How much for a new heat pump install?" }, "neutral");
    expect(decision.shouldReply).toBe(true);
    if (decision.shouldReply) expect(decision.createLead).toBe(true);
  });

  it("does not auto-reply to an ordinary neutral comment", () => {
    const decision = decideAutoReply({ ...base, content: "Nice truck!" }, "neutral");
    expect(decision.shouldReply).toBe(false);
  });

  it("respects SOCIAL_AUTOREPLY_ENABLED=false for the positive/service-question cases", () => {
    process.env.SOCIAL_AUTOREPLY_ENABLED = "false";
    try {
      const decision = decideAutoReply({ ...base, content: "Thanks so much!" }, "positive");
      expect(decision.shouldReply).toBe(false);
    } finally {
      delete process.env.SOCIAL_AUTOREPLY_ENABLED;
    }
  });
});

describe("handleIncomingInteraction", () => {
  it("logs every interaction and alerts the owner (never auto-replies) on a negative comment", async () => {
    const { repo, logged, complaints } = makeRepo();
    const result = await handleIncomingInteraction(
      { platform: "facebook", postId: 1, externalId: "c1", authorName: "Alex", content: "Total scam, never again", kind: "comment" },
      repo,
    );
    expect(result.sentiment).toBe("negative");
    expect(result.replied).toBe(false);
    expect(result.ownerAlerted).toBe(true);
    expect(logged).toHaveLength(1);
    expect(complaints).toHaveLength(1);
  });

  it("creates a lead for a service-question DM and logs the auto-reply", async () => {
    const { repo, logged, leads } = makeRepo();
    const result = await handleIncomingInteraction(
      { platform: "instagram", postId: null, externalId: "dm1", authorName: "Jordan", content: "What's the price for a mini-split?", kind: "message" },
      repo,
    );
    expect(result.replied).toBe(true);
    expect(result.leadId).toBe(1);
    expect(leads).toHaveLength(1);
    expect(logged[0].aiResponse).toBeTruthy();
  });
});

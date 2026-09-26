/**
 * Engagement — comments/DMs (docs/social-lane-spec.md §4).
 *
 * Real comments/DMs are pulled via the Meta API and, per the spec, resolved
 * through `conversationCrm.ts`. That module resolves CRM context strictly by
 * PHONE NUMBER (SMS-thread oriented) — a social comment/DM has no phone
 * number at intake, so there is nothing to hand it for a first pass. This
 * module instead: (1) always logs the interaction to the existing
 * `socialInteractions` table, (2) auto-replies ONLY for the two allowed
 * cases, and (3) for the "I'll DM you" service-question case, creates a
 * `leads` row (source="social") — the actual speed-to-lead SMS hand-off to
 * Jessica depends on the growth-system branch's speed-to-lead flow, which
 * hasn't landed on main; that hand-off is a documented follow-up once it
 * does, not built here (per the owner's explicit allowance for this case).
 * Negative comments are never auto-replied and always alert the owner via
 * the existing `notify()`.
 */
export type Sentiment = "positive" | "neutral" | "negative";
export type InteractionKind = "comment" | "message";

export interface IncomingInteraction {
  platform: string;
  postId: number | null;
  externalId: string;
  authorName: string;
  content: string;
  kind: InteractionKind;
}

const POSITIVE_WORDS = ["thank", "thanks", "great", "awesome", "love", "amazing", "excellent", "happy", "appreciate"];
const NEGATIVE_WORDS = ["terrible", "awful", "worst", "scam", "rip off", "ripoff", "never again", "angry", "disgusted", "complaint", "unacceptable"];
const SERVICE_QUESTION_WORDS = ["price", "cost", "quote", "available", "schedule", "how much", "interested", "estimate"];

/** Small keyword-based classifier — deliberately simple; a human reviews everything in the CRM inbox regardless. */
export function classifySentiment(text: string): Sentiment {
  const lower = text.toLowerCase();
  if (NEGATIVE_WORDS.some((w) => lower.includes(w))) return "negative";
  if (POSITIVE_WORDS.some((w) => lower.includes(w))) return "positive";
  return "neutral";
}

export function looksLikeServiceQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  return SERVICE_QUESTION_WORDS.some((w) => lower.includes(w));
}

export function isSocialAutoReplyEnabled(): boolean {
  return String(process.env.SOCIAL_AUTOREPLY_ENABLED ?? "true").toLowerCase() === "true";
}

const THANK_YOU_TEMPLATE = "Thank you so much for the kind words — we really appreciate it! 🙏";
const DM_YOU_TEMPLATE = "Thanks for reaching out — we'll DM you shortly to help with that!";

export type AutoReplyDecision =
  | { shouldReply: true; template: string; createLead: boolean }
  | { shouldReply: false; alertOwner: boolean };

/**
 * Decide the auto-reply action for an interaction. Pure — no I/O, no side
 * effects. Negative sentiment NEVER auto-replies and always alerts the
 * owner, regardless of SOCIAL_AUTOREPLY_ENABLED.
 */
export function decideAutoReply(interaction: IncomingInteraction, sentiment: Sentiment): AutoReplyDecision {
  if (sentiment === "negative") {
    return { shouldReply: false, alertOwner: true };
  }
  if (!isSocialAutoReplyEnabled()) {
    return { shouldReply: false, alertOwner: false };
  }
  if (sentiment === "positive") {
    return { shouldReply: true, template: THANK_YOU_TEMPLATE, createLead: false };
  }
  if (interaction.kind === "message" && looksLikeServiceQuestion(interaction.content)) {
    return { shouldReply: true, template: DM_YOU_TEMPLATE, createLead: true };
  }
  return { shouldReply: false, alertOwner: false };
}

export interface EngagementRepoDeps {
  logInteraction(row: {
    platform: string; interactionType: "comment" | "message"; postId: number | null;
    externalId: string; authorName: string; content: string; aiResponse: string | null;
    respondedAt: Date | null; leadId: number | null; sentiment: Sentiment;
  }): Promise<number>;
  createLead(row: { name: string; contact: string; contactType: "phone" | "email"; source: string; service: string }): Promise<number>;
  notifyOwnerOfComplaint(interaction: IncomingInteraction): Promise<void>;
}

export interface EngagementResult {
  interactionId: number;
  sentiment: Sentiment;
  replied: boolean;
  leadId: number | null;
  ownerAlerted: boolean;
}

/** Process one incoming comment/DM end-to-end: log, classify, decide, act. */
export async function handleIncomingInteraction(interaction: IncomingInteraction, repo: EngagementRepoDeps): Promise<EngagementResult> {
  const sentiment = classifySentiment(interaction.content);
  const decision = decideAutoReply(interaction, sentiment);

  let leadId: number | null = null;
  let aiResponse: string | null = null;
  let respondedAt: Date | null = null;

  if (decision.shouldReply) {
    aiResponse = decision.template;
    respondedAt = new Date();
    if (decision.createLead) {
      leadId = await repo.createLead({
        name: interaction.authorName || "Social lead",
        contact: interaction.authorName || interaction.externalId,
        contactType: "email", // no phone available from a social DM at intake
        source: `social_${interaction.platform}`,
        service: "unknown",
      });
    }
  }

  const interactionId = await repo.logInteraction({
    platform: interaction.platform,
    interactionType: interaction.kind,
    postId: interaction.postId,
    externalId: interaction.externalId,
    authorName: interaction.authorName,
    content: interaction.content,
    aiResponse,
    respondedAt,
    leadId,
    sentiment,
  });

  let ownerAlerted = false;
  if (!decision.shouldReply && decision.alertOwner) {
    await repo.notifyOwnerOfComplaint(interaction);
    ownerAlerted = true;
  }

  return { interactionId, sentiment, replied: decision.shouldReply, leadId, ownerAlerted };
}

/**
 * Unit tests for the customer referral link SMS (Vapi `sendReferralLink`).
 *
 * Exercises every branch through the injectable dependency surface, so no
 * network or database is touched. Covers: valid send, opted-out number,
 * invalid number, duplicate retry, Telnyx failure, the exact link, the exact
 * message copy, and the absence of any Rosalia/TextBelt/Twilio dependency.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { describe, it, expect, vi } from "vitest";
import {
  sendCustomerReferralLink,
  buildReferralMessage,
  CUSTOMER_REFERRAL_LINK,
  REFERRAL_DEDUP_WINDOW_MS,
  type ReferralSmsDeps,
} from "./services/referralSms";

const NOW = 1_700_000_000_000;

function makeDeps(over: Partial<ReferralSmsDeps> = {}) {
  const deps: ReferralSmsDeps = {
    hasRecentReferralSend: vi.fn(async () => false),
    findContactByPhone: vi.fn(async () => null),
    createContact: vi.fn(async () => 42),
    sendSms: vi.fn(async () => ({ success: true, messageId: "tlx_abc123" })),
    recordSend: vi.fn(async () => {}),
    configured: vi.fn(() => true),
    now: vi.fn(() => NOW),
    ...over,
  };
  return deps;
}

describe("sendCustomerReferralLink — valid send", () => {
  it("sends the link to a first-time caller and records it", async () => {
    const deps = makeDeps();
    const res = await sendCustomerReferralLink({ phone: "(973) 555-0142", firstName: "Dana" }, deps);

    expect(res).toEqual({ status: "sent", phone: "+19735550142" });
    // Sent exactly once, via the (Telnyx) sendSms surface, to the E.164 number.
    expect(deps.sendSms).toHaveBeenCalledTimes(1);
    const [toArg, msgArg] = (deps.sendSms as any).mock.calls[0];
    expect(toArg).toBe("+19735550142");
    expect(msgArg).toContain(CUSTOMER_REFERRAL_LINK);
    // First-time caller → a contact is created and the send is persisted.
    expect(deps.createContact).toHaveBeenCalledWith({ firstName: "Dana", phoneE164: "+19735550142" });
    expect(deps.recordSend).toHaveBeenCalledTimes(1);
    expect((deps.recordSend as any).mock.calls[0][0]).toMatchObject({
      contactId: 42,
      phoneE164: "+19735550142",
      success: true,
      messageId: "tlx_abc123",
    });
  });

  it("reuses an existing (non-opted-out) contact instead of creating one", async () => {
    const deps = makeDeps({ findContactByPhone: vi.fn(async () => ({ id: 7, optedOut: false })) });
    const res = await sendCustomerReferralLink({ phone: "9735550142" }, deps);

    expect(res.status).toBe("sent");
    expect(deps.createContact).not.toHaveBeenCalled();
    expect((deps.recordSend as any).mock.calls[0][0]).toMatchObject({ contactId: 7 });
  });
});

describe("sendCustomerReferralLink — opted-out number", () => {
  it("does not send or record when the contact has opted out (STOP/consent)", async () => {
    const deps = makeDeps({ findContactByPhone: vi.fn(async () => ({ id: 9, optedOut: true })) });
    const res = await sendCustomerReferralLink({ phone: "9735550142" }, deps);

    expect(res).toEqual({ status: "opted_out", phone: "+19735550142" });
    expect(deps.sendSms).not.toHaveBeenCalled();
    expect(deps.recordSend).not.toHaveBeenCalled();
    expect(deps.createContact).not.toHaveBeenCalled();
  });
});

describe("sendCustomerReferralLink — invalid number", () => {
  it("rejects an unparseable number without any side effects", async () => {
    const deps = makeDeps();
    const res = await sendCustomerReferralLink({ phone: "123" }, deps);

    expect(res).toEqual({ status: "invalid_number", phone: null });
    expect(deps.hasRecentReferralSend).not.toHaveBeenCalled();
    expect(deps.sendSms).not.toHaveBeenCalled();
    expect(deps.recordSend).not.toHaveBeenCalled();
  });
});

describe("sendCustomerReferralLink — duplicate retry", () => {
  it("does not re-send when a link was already sent in the dedup window", async () => {
    const deps = makeDeps({ hasRecentReferralSend: vi.fn(async () => true) });
    const res = await sendCustomerReferralLink({ phone: "9735550142" }, deps);

    expect(res).toEqual({ status: "duplicate", phone: "+19735550142" });
    expect(deps.sendSms).not.toHaveBeenCalled();
    expect(deps.recordSend).not.toHaveBeenCalled();
    // Dedup is queried with the window start = now - REFERRAL_DEDUP_WINDOW_MS.
    expect(deps.hasRecentReferralSend).toHaveBeenCalledWith(
      "+19735550142",
      NOW - REFERRAL_DEDUP_WINDOW_MS,
    );
  });

  it("simulated webhook retry: second identical call is suppressed", async () => {
    // First call succeeds and would be recorded; model the recorded state by
    // flipping the dedup probe to true for the retry.
    let sent = false;
    const deps = makeDeps({
      hasRecentReferralSend: vi.fn(async () => sent),
      sendSms: vi.fn(async () => {
        sent = true;
        return { success: true, messageId: "tlx_1" };
      }),
    });

    const first = await sendCustomerReferralLink({ phone: "9735550142" }, deps);
    const retry = await sendCustomerReferralLink({ phone: "9735550142" }, deps);

    expect(first.status).toBe("sent");
    expect(retry.status).toBe("duplicate");
    expect(deps.sendSms).toHaveBeenCalledTimes(1); // only the first call actually sent
  });
});

describe("sendCustomerReferralLink — Telnyx failure", () => {
  it("returns a generic failure and records the failed attempt", async () => {
    const deps = makeDeps({
      sendSms: vi.fn(async () => ({ success: false, error: "Telnyx 500: rate limited" })),
    });
    const res = await sendCustomerReferralLink({ phone: "9735550142" }, deps);

    expect(res.status).toBe("send_failed");
    // The provider error is recorded internally but never surfaced by status.
    expect((deps.recordSend as any).mock.calls[0][0]).toMatchObject({
      success: false,
      error: "Telnyx 500: rate limited",
    });
  });

  it("treats an unconfigured provider as a generic failure (no send, no leak)", async () => {
    const deps = makeDeps({ configured: vi.fn(() => false) });
    const res = await sendCustomerReferralLink({ phone: "9735550142" }, deps);

    expect(res.status).toBe("send_failed");
    expect(deps.sendSms).not.toHaveBeenCalled();
  });
});

describe("referral link + message copy", () => {
  it("uses the exact approved customer referral link", () => {
    expect(CUSTOMER_REFERRAL_LINK).toBe("https://mechanicalenterprise.com/referral");
  });

  it("builds the referral copy from the existing /referral page wording", () => {
    const msg = buildReferralMessage("Dana");
    expect(msg).toBe(
      "Hi Dana! Earn $500 per referral with Mechanical Enterprise. " +
        "Know someone who needs HVAC work? Send them our way — we pay you when they book: " +
        "https://mechanicalenterprise.com/referral\n\n" +
        "Questions? Call (862) 423-9396\n" +
        "Reply STOP to opt out.",
    );
  });

  it("omits the greeting when no name is provided", () => {
    const msg = buildReferralMessage();
    expect(msg.startsWith("Earn $500 per referral with Mechanical Enterprise.")).toBe(true);
    expect(msg).toContain(CUSTOMER_REFERRAL_LINK);
    expect(msg).toContain("Reply STOP to opt out.");
  });

  it("carries no realtor/partner or review-request wording (single program)", () => {
    const msg = buildReferralMessage("Sam").toLowerCase();
    expect(msg).not.toContain("partner");
    expect(msg).not.toContain("commission");
    expect(msg).not.toContain("review");
    expect(msg).not.toContain("realtor");
  });
});

describe("no Rosalia / TextBelt / Twilio dependency", () => {
  it("imports only the Telnyx provider, never a legacy sender", () => {
    const src = readFileSync(
      fileURLToPath(new URL("./services/referralSms.ts", import.meta.url)),
      "utf8",
    );
    const importLines = src.split("\n").filter((l) => /^\s*import\b/.test(l));

    expect(importLines.some((l) => /telnyxSms/.test(l))).toBe(true);
    for (const legacy of [/twilio/i, /textbelt/i, /rosalia/i]) {
      expect(importLines.some((l) => legacy.test(l))).toBe(false);
    }
  });
});

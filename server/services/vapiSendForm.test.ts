/**
 * Tests for the Mechanical-owned Vapi `sendForm` tool (fix/vapi-mechanical-send-form).
 *
 * The DB + Telnyx are injected as deps so we assert routing, consent gating,
 * idempotency, history writes, message/URL content, endpoint auth, and the
 * absence of any Rosalia / TextBelt / Twilio dependency — with no network or DB.
 * `toE164` is kept real (via buildMessage/sendMechanicalFormLink) so E.164
 * normalization is exercised.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  sendMechanicalFormLink,
  handleSendForm,
  buildFormUrl,
  buildMessage,
  buildIdemKey,
  extractSendFormCall,
  vapiResult,
  registerVapiToolRoutes,
  type SendFormDeps,
} from "./vapiSendForm";
import { IdempotencyStore } from "../_core/idempotency";

function makeDeps(over: Partial<SendFormDeps> = {}): SendFormDeps {
  return {
    lookupContact: vi.fn(async () => ({ contactId: 42, optedOut: false })),
    alreadySent: vi.fn(async () => false),
    recordOutbound: vi.fn(async () => {}),
    send: vi.fn(async () => ({ success: true, messageId: "telnyx_1" })),
    ...over,
  };
}
const send = (d: SendFormDeps) => d.send as ReturnType<typeof vi.fn>;
const CONSENTED = { phone: "862-419-1763", type: "booking" };

describe("buildFormUrl / buildMessage — Mechanical /qualify only", () => {
  it("points at the in-repo Mechanical /qualify form (no Rosalia, no LP)", () => {
    const url = buildFormUrl();
    expect(url).toBe("https://mechanicalenterprise.com/qualify");
    expect(url).not.toMatch(/rosalia|iron65|book\./i);
    expect(url).not.toMatch(/\/lp\//);
  });

  it("honors PUBLIC_SITE_URL for non-prod origins", () => {
    const prev = process.env.PUBLIC_SITE_URL;
    process.env.PUBLIC_SITE_URL = "https://preview.example.com/";
    expect(buildFormUrl()).toBe("https://preview.example.com/qualify");
    if (prev === undefined) delete process.env.PUBLIC_SITE_URL;
    else process.env.PUBLIC_SITE_URL = prev;
  });

  it("booking vs reschedule copy differ but reuse the same form + carry STOP", () => {
    const url = "https://mechanicalenterprise.com/qualify";
    const booking = buildMessage("booking", url);
    const reschedule = buildMessage("reschedule", url, "Maria Gomez");
    expect(booking).toContain(url);
    expect(reschedule).toContain(url);
    expect(booking).toContain("Reply STOP to opt out.");
    expect(reschedule).toContain("Reply STOP to opt out.");
    expect(booking).toContain("Mechanical Enterprise");
    expect(reschedule).toMatch(/new time/i);
    expect(reschedule).toContain("Maria"); // first name only
    for (const m of [booking, reschedule]) {
      expect(m.toLowerCase()).not.toMatch(/rosalia|iron65|textbelt|twilio/);
    }
  });
});

describe("sendMechanicalFormLink — send + gating + history", () => {
  it("sends a consented booking link via the (Telnyx) sender and records history", async () => {
    const deps = makeDeps();
    const res = await sendMechanicalFormLink(CONSENTED, deps);
    expect(res).toMatchObject({ success: true, smsSent: true, formUrl: "https://mechanicalenterprise.com/qualify" });
    expect(send(deps)).toHaveBeenCalledOnce();
    const [phone, message] = send(deps).mock.calls[0];
    expect(phone).toBe("+18624191763"); // normalized E.164
    expect(message).toContain("https://mechanicalenterprise.com/qualify");
    expect(deps.recordOutbound).toHaveBeenCalledOnce();
    const rec = (deps.recordOutbound as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(rec).toMatchObject({ contactId: 42, phone: "+18624191763", providerMessageId: "telnyx_1" });
  });

  it("uses reschedule wording for type=reschedule", async () => {
    const deps = makeDeps();
    await sendMechanicalFormLink({ phone: "8624191763", type: "reschedule" }, deps);
    expect(send(deps).mock.calls[0][1]).toMatch(/new time/i);
  });

  it("does NOT send to an opted-out recipient", async () => {
    const deps = makeDeps({ lookupContact: vi.fn(async () => ({ contactId: 7, optedOut: true })) });
    const res = await sendMechanicalFormLink(CONSENTED, deps);
    expect(res).toMatchObject({ success: false, smsSent: false });
    expect(res.error).toMatch(/opted out/i);
    expect(send(deps)).not.toHaveBeenCalled();
    expect(deps.recordOutbound).not.toHaveBeenCalled();
  });

  it("rejects an invalid phone without sending", async () => {
    const deps = makeDeps();
    const res = await sendMechanicalFormLink({ phone: "12345", type: "booking" }, deps);
    expect(res).toMatchObject({ success: false, smsSent: false });
    expect(res.error).toMatch(/invalid/i);
    expect(send(deps)).not.toHaveBeenCalled();
  });

  it("rejects a missing phone without sending", async () => {
    const deps = makeDeps();
    const res = await sendMechanicalFormLink({ phone: "", type: "booking" }, deps);
    expect(res.error).toMatch(/required/i);
    expect(send(deps)).not.toHaveBeenCalled();
    const res2 = await sendMechanicalFormLink({ phone: undefined, type: "booking" }, deps);
    expect(res2.error).toMatch(/required/i);
  });

  it("treats a DB-recorded duplicate as already sent (no re-send)", async () => {
    const deps = makeDeps({ alreadySent: vi.fn(async () => true) });
    const res = await sendMechanicalFormLink(CONSENTED, deps);
    expect(res).toMatchObject({ success: true, smsSent: true, deduplicated: true });
    expect(send(deps)).not.toHaveBeenCalled();
    expect(deps.recordOutbound).not.toHaveBeenCalled();
  });

  it("returns a SAFE error on Telnyx failure (no raw provider detail) and does not record", async () => {
    const deps = makeDeps({ send: vi.fn(async () => ({ success: false, error: "Telnyx 401: invalid API key KEYSECRET" })) });
    const res = await sendMechanicalFormLink(CONSENTED, deps);
    expect(res).toMatchObject({ success: false, smsSent: false });
    expect(res.error).toBe("Message could not be sent right now");
    expect(JSON.stringify(res)).not.toMatch(/KEYSECRET|401|Telnyx/);
    expect(deps.recordOutbound).not.toHaveBeenCalled();
  });

  it("still reports the send when the history write fails (non-fatal)", async () => {
    const deps = makeDeps({ recordOutbound: vi.fn(async () => { throw new Error("history down"); }) });
    const res = await sendMechanicalFormLink(CONSENTED, deps);
    expect(res).toMatchObject({ success: true, smsSent: true });
  });

  it("never throws even if a dependency throws", async () => {
    const deps = makeDeps({ send: vi.fn(async () => { throw new Error("boom"); }) });
    const res = await sendMechanicalFormLink(CONSENTED, deps);
    expect(res).toMatchObject({ success: false, smsSent: false });
    expect(res.error).not.toMatch(/boom/);
  });
});

describe("handleSendForm — idempotency across Vapi retries", () => {
  it("coalesces concurrent retries with the same key into ONE send", async () => {
    const deps = makeDeps();
    const store = new IdempotencyStore();
    const key = buildIdemKey({ toolCallId: "call_abc", callId: "vapi_1", input: CONSENTED });
    const [a, b] = await Promise.all([
      handleSendForm(CONSENTED, key, { deps, store }),
      handleSendForm(CONSENTED, key, { deps, store }),
    ]);
    expect(a.smsSent).toBe(true);
    expect(b.smsSent).toBe(true);
    expect(send(deps)).toHaveBeenCalledOnce();
  });

  it("prefers the stable toolCallId for the idempotency key", () => {
    expect(buildIdemKey({ toolCallId: "call_xyz", callId: "vapi_9", input: CONSENTED }))
      .toBe("vapi-sendform:call_xyz");
    expect(buildIdemKey({ toolCallId: "", callId: "vapi_9", input: { phone: "862-419-1763", type: "reschedule" } }))
      .toBe("vapi-sendform:vapi_9:8624191763:reschedule");
  });
});

describe("extractSendFormCall — Vapi envelope parsing", () => {
  const envelope = (args: unknown) => ({
    message: { type: "tool-calls", call: { id: "vapi_1" }, toolCallList: [{ id: "tc_1", function: { name: "sendForm", arguments: args } }] },
  });

  it("parses string-encoded arguments (Vapi default)", () => {
    const call = extractSendFormCall(envelope(JSON.stringify({ phone: "8624191763", type: "booking" })));
    expect(call).toMatchObject({ toolCallId: "tc_1", callId: "vapi_1", input: { phone: "8624191763", type: "booking" } });
  });

  it("parses object arguments", () => {
    expect(extractSendFormCall(envelope({ phone: "8624191763", type: "reschedule" }))?.input.type).toBe("reschedule");
  });

  it("returns null when no sendForm call is present (cannot invoke other tools)", () => {
    const body = { message: { toolCallList: [{ id: "tc_2", function: { name: "bookAppointment", arguments: "{}" } }] } };
    expect(extractSendFormCall(body)).toBeNull();
  });
});

describe("vapiResult — explicit status, PII-free surface", () => {
  it("surfaces status + machine reason but never error text, message, phone, or email", () => {
    const out = vapiResult({ success: false, smsSent: false, status: "skipped", reason: "opted_out", formUrl: "https://mechanicalenterprise.com/qualify", error: "Recipient has opted out of SMS", message: "x" });
    expect(out).toEqual({ status: "skipped", success: false, smsSent: false, reason: "opted_out", formUrl: "https://mechanicalenterprise.com/qualify" });
    expect(JSON.stringify(out)).not.toMatch(/opted out/i);
  });

  it("includes providerMessageId only on a real send", () => {
    const sent = vapiResult({ success: true, smsSent: true, status: "sent", providerMessageId: "telnyx_9", formUrl: "u" });
    expect(sent).toMatchObject({ status: "sent", providerMessageId: "telnyx_9" });
    const failed = vapiResult({ success: false, smsSent: false, status: "failed", reason: "invalid_phone" });
    expect(failed).not.toHaveProperty("providerMessageId");
  });
});

describe("sendForm — explicit sent/skipped/failed status (incident regression)", () => {
  // 11 digits, does NOT start with 1 → not a usable US/E.164 number.
  const INVALID_11 = { phone: "364-622-69189", type: "booking" };

  it("FAILS (invalid_phone) on an 11-digit non-E.164 number and never sends or guesses", async () => {
    const deps = makeDeps();
    const r = await sendMechanicalFormLink(INVALID_11, deps);
    expect(r).toMatchObject({ status: "failed", reason: "invalid_phone", success: false, smsSent: false });
    expect(send(deps)).not.toHaveBeenCalled(); // never attempted — no guessed destination
  });

  it("does NOT report a false success when the SMS did not send", async () => {
    const r = await sendMechanicalFormLink(INVALID_11, makeDeps());
    expect(r.success).toBe(false);
    expect(r.smsSent).toBe(false);
    expect(vapiResult(r).status).toBe("failed");
  });

  it("SKIPS (opted_out) when consent is missing, without sending", async () => {
    const deps = makeDeps({ lookupContact: vi.fn(async () => ({ contactId: 1, optedOut: true })) });
    const r = await sendMechanicalFormLink(CONSENTED, deps);
    expect(r).toMatchObject({ status: "skipped", reason: "opted_out", success: false, smsSent: false });
    expect(send(deps)).not.toHaveBeenCalled();
  });

  it("FAILS (send_failed) on a Telnyx rejection, leaking no provider detail", async () => {
    const deps = makeDeps({ send: vi.fn(async () => ({ success: false, error: "Telnyx 400: bad number" })) });
    const r = await sendMechanicalFormLink(CONSENTED, deps);
    expect(r).toMatchObject({ status: "failed", reason: "send_failed", success: false, smsSent: false });
    expect(JSON.stringify(vapiResult(r))).not.toMatch(/telnyx|400/i);
  });

  it("SENDS with providerMessageId on a Telnyx-accepted response", async () => {
    const deps = makeDeps({ send: vi.fn(async () => ({ success: true, messageId: "telnyx_abc" })) });
    const r = await sendMechanicalFormLink(CONSENTED, deps);
    expect(r).toMatchObject({ status: "sent", success: true, smsSent: true, providerMessageId: "telnyx_abc" });
    expect(vapiResult(r)).toMatchObject({ status: "sent", providerMessageId: "telnyx_abc" });
  });

  it("never reports 'sent' on a 2xx-without-id (unverifiable) Telnyx response", async () => {
    const deps = makeDeps({ send: vi.fn(async () => ({ success: true, messageId: undefined })) });
    const r = await sendMechanicalFormLink(CONSENTED, deps);
    expect(r).toMatchObject({ status: "failed", reason: "send_failed", success: false, smsSent: false });
    expect(r.status).not.toBe("sent");
    expect(vapiResult(r)).not.toHaveProperty("providerMessageId");
  });

  it("SKIPS (already_sent) on a duplicate retry without a second send", async () => {
    const deps = makeDeps({ alreadySent: vi.fn(async () => true) });
    const r = await sendMechanicalFormLink(CONSENTED, deps);
    expect(r).toMatchObject({ status: "skipped", reason: "already_sent" });
    expect(send(deps)).not.toHaveBeenCalled(); // no duplicate SMS
  });
});

describe("registerVapiToolRoutes — endpoint auth guards", () => {
  function captureHandler() {
    let handler: ((req: unknown, res: unknown) => unknown) | undefined;
    const app = { post: (path: string, h: (req: unknown, res: unknown) => unknown) => { if (path.includes("send-form")) handler = h; } };
    registerVapiToolRoutes(app as never);
    if (!handler) throw new Error("route not registered");
    return handler;
  }
  function mockRes() {
    return {
      statusCode: 0,
      body: undefined as unknown,
      status(c: number) { this.statusCode = c; return this; },
      json(b: unknown) { this.body = b; return this; },
    };
  }
  const mockReq = (headerVal: string | undefined, body: unknown) => ({ header: (_h: string) => headerVal, body });

  const prev = process.env.VAPI_TOOL_SECRET;
  afterEach(() => {
    if (prev === undefined) delete process.env.VAPI_TOOL_SECRET;
    else process.env.VAPI_TOOL_SECRET = prev;
  });

  it("503s when the secret is unset (never runs unauthenticated)", async () => {
    delete process.env.VAPI_TOOL_SECRET;
    const res = mockRes();
    await captureHandler()(mockReq("anything", {}), res);
    expect(res.statusCode).toBe(503);
  });

  it("401s when the secret header is missing or wrong", async () => {
    process.env.VAPI_TOOL_SECRET = "s3cret";
    const r1 = mockRes();
    await captureHandler()(mockReq(undefined, {}), r1);
    expect(r1.statusCode).toBe(401);
    const r2 = mockRes();
    await captureHandler()(mockReq("wrong", {}), r2);
    expect(r2.statusCode).toBe(401);
  });

  it("400s on a valid secret but no sendForm call in the body", async () => {
    process.env.VAPI_TOOL_SECRET = "s3cret";
    const res = mockRes();
    await captureHandler()(mockReq("s3cret", { message: { toolCallList: [] } }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe("no Rosalia / TextBelt / Twilio dependency", () => {
  it("imports the Telnyx service only — no legacy messaging modules", () => {
    const src = readFileSync(fileURLToPath(new URL("./vapiSendForm.ts", import.meta.url)), "utf8");
    const imports = src.split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n").toLowerCase();
    expect(imports).toContain("./telnyxsms");
    expect(imports).not.toMatch(/textbelt|twilio|rosalia/);
  });

  it("the send path is the injected Telnyx sender and nothing else", async () => {
    const deps = makeDeps();
    await sendMechanicalFormLink(CONSENTED, deps);
    expect(send(deps)).toHaveBeenCalledOnce();
  });
});

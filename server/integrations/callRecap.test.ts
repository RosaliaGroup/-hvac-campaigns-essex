import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRecapRecord,
  persistCallRecap,
  renderRecapText,
  type CallRecapInput,
  type RecapDeps,
  type RecapMatch,
  type RecapRecord,
} from "./callRecap";

const NOW = new Date("2026-07-17T12:00:00Z");

const NO_MATCH: RecapMatch = { appointmentId: null, customerId: null, leadId: null, propertyId: null };

function makeStore(overrides: Partial<Record<string, unknown>> = {}) {
  const calls = {
    saveCallLog: 0,
    attachToAppointment: [] as number[],
    attachToLead: [] as number[],
  };
  const store = {
    findExistingRecap: vi.fn(async () => null as number | null),
    match: vi.fn(async () => NO_MATCH),
    saveCallLog: vi.fn(async () => {
      calls.saveCallLog++;
      return 100;
    }),
    attachToAppointment: vi.fn(async (id: number) => {
      calls.attachToAppointment.push(id);
    }),
    attachToLead: vi.fn(async (id: number) => {
      calls.attachToLead.push(id);
    }),
    ...overrides,
  };
  return { store, calls };
}

function makeNotifier(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sendEmail: vi.fn(async () => true),
    hasSmsConsent: vi.fn(async () => false),
    sendSms: vi.fn(async () => true),
    ...overrides,
  };
}

function deps(store: unknown, notifier: unknown): RecapDeps {
  return { store: store as never, notifier: notifier as never, now: () => NOW };
}

function baseInput(extra: Partial<CallRecapInput> = {}): CallRecapInput {
  return {
    call_id: "call_abc123",
    name: "Ana Haynes",
    phone: "(862) 419-1763",
    reason_for_call: "No heat upstairs",
    requested_service: "furnace repair",
    urgency: "emergency",
    ai_summary: "Caller reports no heat on the second floor since this morning.",
    follow_up_required: true,
    ...extra,
  };
}

// ── privacy whitelist ──────────────────────────────────────────
describe("sendCallRecap — buildRecapRecord privacy whitelist", () => {
  it("keeps only operational fields and drops prompts/secrets/tokens/extras", () => {
    const record = buildRecapRecord({
      ...baseInput(),
      // forbidden / unrelated keys that must NOT survive:
      system_prompt: "You are Jessica...",
      prompt: "hidden instructions",
      api_key: "sk-secret",
      token: "tok_123",
      internal_notes: "margin 45%",
      other_customer: "Bob Smith",
    } as never);

    const blob = JSON.stringify(record);
    for (const forbidden of ["You are Jessica", "hidden instructions", "sk-secret", "tok_123", "margin", "Bob Smith"]) {
      expect(blob).not.toContain(forbidden);
    }
    // operational fields preserved
    expect(record.callerName).toBe("Ana Haynes");
    expect(record.normalizedPhone).toBe("8624191763");
    expect(record.requestedService).toBe("furnace repair");
    expect(record.urgency).toBe("emergency");
    expect(record.followUpRequired).toBe(true);
  });

  it("accepts legacy caller_* aliases and normalizes the phone", () => {
    const record = buildRecapRecord({
      caller_name: "Chris Doe",
      caller_phone: "+1 973-555-0100",
      caller_email: "chris@example.com",
      call_summary: "wants a quote",
    });
    expect(record.callerName).toBe("Chris Doe");
    expect(record.normalizedPhone).toBe("9735550100");
    expect(record.email).toBe("chris@example.com");
    expect(record.aiSummary).toBe("wants a quote");
  });

  it("renderRecapText contains no secret/prompt content", () => {
    const record = buildRecapRecord(baseInput());
    const text = renderRecapText(record, NOW);
    expect(text).toContain("Ana Haynes");
    expect(text).toContain("furnace repair");
    expect(text).not.toMatch(/prompt|api[_-]?key|token|secret/i);
  });
});

// ── idempotency ────────────────────────────────────────────────
describe("sendCallRecap — idempotency", () => {
  it("derives a STABLE key for retries lacking a call id", () => {
    const a = buildRecapRecord(baseInput({ call_id: null, vapiCallId: null }));
    const b = buildRecapRecord(baseInput({ call_id: null, vapiCallId: null }));
    expect(a.idempotencyKey).toBe(b.idempotencyKey);
    expect(a.idempotencyKey.startsWith("recap:")).toBe(true);
  });

  it("uses the Vapi call id as the key when present", () => {
    expect(buildRecapRecord(baseInput()).idempotencyKey).toBe("call_abc123");
  });

  it("a duplicate retry never persists, emails, or texts again", async () => {
    const { store, calls } = makeStore({ findExistingRecap: vi.fn(async () => 55) });
    const notifier = makeNotifier();
    const record = buildRecapRecord(baseInput({ send_customer_sms: true, sms_consent: true }));

    const result = await persistCallRecap(record, deps(store, notifier));

    expect(result).toMatchObject({ success: true, deduped: true, recapId: 55 });
    expect(calls.saveCallLog).toBe(0);
    expect(notifier.sendEmail).not.toHaveBeenCalled();
    expect(notifier.sendSms).not.toHaveBeenCalled();
  });
});

// ── persistence priority / matching ────────────────────────────
describe("sendCallRecap — persistence priority", () => {
  it("stores to the call-log floor and never discards when nothing matches", async () => {
    const { store, calls } = makeStore();
    const notifier = makeNotifier();
    const result = await persistCallRecap(buildRecapRecord(baseInput()), deps(store, notifier));
    expect(result.persisted).toBe(true);
    expect(result.matchedRecordType).toBe("call_log");
    expect(calls.saveCallLog).toBe(1);
  });

  it("attaches to a matched appointment (highest priority)", async () => {
    const { store, calls } = makeStore({
      match: vi.fn(async () => ({ appointmentId: 7, customerId: 3, leadId: 9, propertyId: 2 })),
    });
    const result = await persistCallRecap(buildRecapRecord(baseInput()), deps(store, makeNotifier()));
    expect(result.matchedRecordType).toBe("appointment");
    expect(calls.attachToAppointment).toEqual([7]);
    expect(calls.attachToLead).toEqual([]); // appointment wins; lead not double-written
  });

  it("reports customer when matched by phone with no appointment", async () => {
    const { store } = makeStore({
      match: vi.fn(async () => ({ appointmentId: null, customerId: 3, leadId: null, propertyId: null })),
    });
    const result = await persistCallRecap(buildRecapRecord(baseInput()), deps(store, makeNotifier()));
    expect(result.matchedRecordType).toBe("customer");
  });

  it("attaches to a lead when only a lead matches", async () => {
    const { store, calls } = makeStore({
      match: vi.fn(async () => ({ appointmentId: null, customerId: null, leadId: 42, propertyId: null })),
    });
    const result = await persistCallRecap(buildRecapRecord(baseInput()), deps(store, makeNotifier()));
    expect(result.matchedRecordType).toBe("lead");
    expect(calls.attachToLead).toEqual([42]);
  });

  it("honours an explicit appointment_id even if match() misses it", async () => {
    const { store, calls } = makeStore();
    await persistCallRecap(buildRecapRecord(baseInput({ appointment_id: "88" })), deps(store, makeNotifier()));
    expect(calls.attachToAppointment).toEqual([88]);
  });
});

// ── failure handling ───────────────────────────────────────────
describe("sendCallRecap — failure isolation", () => {
  it("email failure never rolls back persistence", async () => {
    const { store, calls } = makeStore();
    const notifier = makeNotifier({ sendEmail: vi.fn(async () => false) });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await persistCallRecap(buildRecapRecord(baseInput()), deps(store, notifier));
    expect(result.success).toBe(true);
    expect(result.persisted).toBe(true);
    expect(result.emailed).toBe(false);
    expect(calls.saveCallLog).toBe(1);
    expect(errSpy).toHaveBeenCalled(); // delivery failure logged
  });

  it("email throwing never propagates and recap stays saved", async () => {
    const { store, calls } = makeStore();
    const notifier = makeNotifier({ sendEmail: vi.fn(async () => { throw new Error("resend down"); }) });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await persistCallRecap(buildRecapRecord(baseInput()), deps(store, notifier));
    expect(result.success).toBe(true);
    expect(result.persisted).toBe(true);
    expect(calls.saveCallLog).toBe(1);
  });

  it("a matching failure degrades to the call-log floor", async () => {
    const { store, calls } = makeStore({ match: vi.fn(async () => { throw new Error("match query failed"); }) });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await persistCallRecap(buildRecapRecord(baseInput()), deps(store, makeNotifier()));
    expect(result.persisted).toBe(true);
    expect(result.matchedRecordType).toBe("call_log");
    expect(calls.saveCallLog).toBe(1);
  });

  it("propagates a persistence failure so Vapi can retry", async () => {
    const { store } = makeStore({ saveCallLog: vi.fn(async () => { throw new Error("db down"); }) });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(persistCallRecap(buildRecapRecord(baseInput()), deps(store, makeNotifier()))).rejects.toThrow("db down");
  });
});

// ── SMS consent enforcement ────────────────────────────────────
describe("sendCallRecap — SMS consent + Telnyx gating", () => {
  it("does not text when the workflow did not request it", async () => {
    const notifier = makeNotifier();
    const result = await persistCallRecap(buildRecapRecord(baseInput()), deps(makeStore().store, notifier));
    expect(notifier.sendSms).not.toHaveBeenCalled();
    expect(result.smsSkippedReason).toBe("not_requested");
  });

  it("does not text when requested but no consent exists", async () => {
    const notifier = makeNotifier({ hasSmsConsent: vi.fn(async () => false) });
    const result = await persistCallRecap(
      buildRecapRecord(baseInput({ send_customer_sms: true })),
      deps(makeStore().store, notifier),
    );
    expect(notifier.sendSms).not.toHaveBeenCalled();
    expect(result.smsSkippedReason).toBe("no_consent");
  });

  it("texts once when requested AND consent exists", async () => {
    const notifier = makeNotifier({ hasSmsConsent: vi.fn(async () => true) });
    const result = await persistCallRecap(
      buildRecapRecord(baseInput({ send_customer_sms: true })),
      deps(makeStore().store, notifier),
    );
    expect(notifier.sendSms).toHaveBeenCalledTimes(1);
    expect(result.smsSent).toBe(true);
  });

  it("an explicit caller consent flag satisfies consent without a lookup", async () => {
    const notifier = makeNotifier({ hasSmsConsent: vi.fn(async () => false) });
    const result = await persistCallRecap(
      buildRecapRecord(baseInput({ send_customer_sms: true, sms_consent: true })),
      deps(makeStore().store, notifier),
    );
    expect(notifier.hasSmsConsent).not.toHaveBeenCalled();
    expect(result.smsSent).toBe(true);
  });
});

// ── Mechanical-only source guarantees ──────────────────────────
describe("sendCallRecap — Mechanical-only, no legacy dependencies", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const core = strip(readFileSync(path.join(here, "callRecap.ts"), "utf8"));
  const prod = strip(readFileSync(path.join(here, "vapiRecapRoute.ts"), "utf8"));

  it("core + prod wiring contain no Rosalia / SMTP / Textbelt / Twilio", () => {
    for (const src of [core, prod]) {
      expect(src).not.toMatch(/rosalia|rosaliagroup/i);
      expect(src).not.toMatch(/nodemailer|smtp/i);
      expect(src).not.toMatch(/textbelt|twilio/i);
    }
  });

  it("email goes through the Mechanical Resend service; SMS through Telnyx", () => {
    expect(prod).toMatch(/from\s+["']\.\.\/services\/emailService["']/);
    expect(prod).toMatch(/sendTelnyxSms/);
  });

  it("no hard-coded credentials in the wiring", () => {
    expect(prod).not.toMatch(/sk-[a-z0-9]{16,}/i);
    expect(prod).not.toMatch(/re_[a-z0-9]{16,}/i);
    expect(prod).not.toMatch(/(api[_-]?key|password|secret)\s*[:=]\s*["'][^"']{8,}["']/i);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const documented = new Map<number, unknown>();
const optedOut = new Set<string>();
const suppressed = new Set<string>();

vi.mock("../services/smsConsentEvidence", async (orig) => ({
  ...(await orig<typeof import("../services/smsConsentEvidence")>()),
  activeConsentByCustomer: vi.fn(async () => documented),
}));
vi.mock("../services/smsOutbound", () => ({
  isPhoneOptedOut: vi.fn(async (_db: unknown, p: string) => optedOut.has(p)),
  inboxPhoneMatch: vi.fn(() => undefined),
  sendAndRecordSms: vi.fn(),
}));
vi.mock("../services/outreachSuppression", () => ({
  isSmsRecipientSuppressed: vi.fn(async (_db: unknown, p: string) => suppressed.has(p)),
}));

import { reviewRecipients } from "./contactBulkSms";
import { validateConsentEvidence } from "../services/smsConsentEvidence";

/** Fake drizzle: each select() resolves to the next queued result set. */
function fakeDb(results: unknown[][]) {
  const queue = [...results];
  const chain = (): any => {
    const value = () => Promise.resolve(queue.shift() ?? []);
    const c: any = { from: () => c, where: () => c, limit: () => c, orderBy: () => c,
      then: (res: any, rej: any) => value().then(res, rej) };
    return c;
  };
  return { select: chain } as any;
}

const purchased = (id: number, phone: string | null, status = "inactive") =>
  ({ id, name: "Homeowner " + id, phone, status, source: "hvac-list-07105" });

beforeEach(() => { documented.clear(); optedOut.clear(); suppressed.clear(); });

describe("reviewRecipients — consent is the gate, not CRM status", () => {
  it("blocks purchased inactive contacts for missing consent (not for being inactive)", async () => {
    const db = fakeDb([[purchased(1, "9735550101")], []]);
    const [r] = await reviewRecipients(db, [1], null);
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("no_verified_sms_consent");
    expect(r.purchasedList).toBe(true);
  });

  it("still blocks a purchased contact that was merely switched to active", async () => {
    const db = fakeDb([[purchased(2, "9735550102", "active")], []]);
    const [r] = await reviewRecipients(db, [2], null);
    expect(r.reason).toBe("no_verified_sms_consent");
  });

  it("allows an inactive purchased contact once documented consent exists", async () => {
    documented.set(3, { id: 9 });
    const db = fakeDb([[purchased(3, "9735550103")], []]);
    const [r] = await reviewRecipients(db, [3], null);
    expect(r.eligible).toBe(true);
    expect(r.consentSource).toBe("documented_record");
  });

  it("accepts a first-party web form opt-in only when the phone matches", async () => {
    const db = fakeDb([[purchased(4, "9735550104"), purchased(5, "9735550105")],
      [{ customerId: 4, phone: "(973) 555-0104" }, { customerId: 5, phone: "2015550000" }]]);
    const [a, b] = await reviewRecipients(db, [4, 5], null);
    expect(a.consentSource).toBe("web_form");
    expect(b.reason).toBe("no_verified_sms_consent");
  });

  it("STOP and do-not-contact override documented consent", async () => {
    documented.set(6, {}); documented.set(7, {});
    optedOut.add("+19735550106"); suppressed.add("+19735550107");
    const db = fakeDb([[purchased(6, "9735550106"), purchased(7, "9735550107")], []]);
    const [a, b] = await reviewRecipients(db, [6, 7], null);
    expect(a.reason).toBe("opted_out");
    expect(b.reason).toBe("do_not_contact");
  });

  it("blocks archived contacts, missing phones and duplicate numbers", async () => {
    documented.set(8, {}); documented.set(9, {}); documented.set(10, {});
    const db = fakeDb([[purchased(8, "9735550108", "archived"), purchased(9, null),
      purchased(10, "9735550111"), purchased(11, "973-555-0111")], []]);
    const r = await reviewRecipients(db, [8, 9, 10, 11], null);
    expect(r.map(x => x.reason)).toEqual(["archived", "missing_phone", null, "duplicate_phone"]);
  });

  it("fails closed when the consent lookup errors", async () => {
    const db = fakeDb([[purchased(12, "9735550112")]]);
    const realSelect = db.select;
    let n = 0;
    db.select = () => { n++; if (n === 2) throw new Error("db down"); return realSelect(); };
    const [r] = await reviewRecipients(db, [12], null);
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("verification_error");
  });
});

describe("validateConsentEvidence", () => {
  const good = {
    method: "signed_written_form",
    consentLanguage: "I agree to receive marketing text messages from Mechanical Enterprise LLC at the number provided. Msg & data rates may apply.",
    evidenceReference: "Drive: signed-forms/2026-11-02-smith.pdf",
    obtainedAt: new Date("2026-10-01"),
    attested: true,
  };
  it("accepts complete per-person evidence", () => {
    expect(validateConsentEvidence(good, new Date("2026-10-28"))).toEqual([]);
  });
  it("rejects the purchased list or invoice as evidence", () => {
    expect(validateConsentEvidence({ ...good, evidenceReference: "Dataman invoice 144253" }).length).toBeGreaterThan(0);
    expect(validateConsentEvidence({ ...good, evidenceReference: "hvac-list-07105 row 55" }).length).toBeGreaterThan(0);
  });
  it("requires wording that names Mechanical Enterprise and covers texts", () => {
    expect(validateConsentEvidence({ ...good,
      consentLanguage: "I agree that partners and affiliates may contact me about home services offers." }).join(" "))
      .toMatch(/Mechanical Enterprise/);
  });
  it("rejects unknown methods, future dates and missing attestation", () => {
    const problems = validateConsentEvidence({ ...good, method: "purchased_list",
      obtainedAt: new Date("2030-01-01"), attested: false }, new Date("2026-10-28"));
    expect(problems.length).toBe(3);
  });
});

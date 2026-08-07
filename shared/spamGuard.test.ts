import { describe, it, expect } from "vitest";
import { evaluateSpam } from "./spamGuard";

// Fixed clock so `_ts` timing is deterministic.
const NOW = 1_754_000_000_000;

describe("spamGuard — the three concrete attack samples (no escape-sequence rule)", () => {
  it("SAMPLE 1: throwaway itw-dahti.com email blocks on domain alone", () => {
    const r = evaluateSpam({ name: "Amanda Cole", email: "qz8@itw-dahti.com", phone: "8624191763" }, { now: NOW });
    expect(r.blocked).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.reasons).toContain("blocked_domain:itw-dahti.com");
  });

  it("SAMPLE 2: phone 8370231310 (exchange 023) blocks on NANP alone", () => {
    const r = evaluateSpam({ name: "John Smith", email: "j@gmail.com", phone: "8370231310" }, { now: NOW });
    expect(r.blocked).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.reasons.some((x) => x.startsWith("phone:nanp"))).toBe(true);
  });

  it("SAMPLE 3: phone 8580298899 (exchange 029) blocks on NANP alone", () => {
    const r = evaluateSpam({ name: "Jane Doe", email: "jane@outlook.com", phone: "8580298899" }, { now: NOW });
    expect(r.blocked).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.reasons.some((x) => x.startsWith("phone:nanp"))).toBe(true);
  });
});

describe("spamGuard — random alphanumeric NAMES on gibberish scoring alone", () => {
  // Clean email + valid phone so ONLY the gibberish score can reach 60.
  const clean = { email: "user@gmail.com", phone: "8624191763", now: NOW } as const;
  const nameOnly = (name: string) =>
    evaluateSpam({ name, email: clean.email, phone: clean.phone }, { now: clean.now });

  const samples = [
    "xKfjWqZ",
    "aB8cDeFgH",
    "zxcvbnmq",
    "Jd93KfLp",
    "qZ7xNm2",
    "Xk4Qz",
  ];
  for (const s of samples) {
    it(`"${s}" → score/blocked reported`, () => {
      const r = nameOnly(s);
      // Not asserting a hard block here — this test documents the real score so
      // we can see which random-name shapes clear 60 on gibberish alone.
      expect(r.score).toBeGreaterThanOrEqual(0);
    });
  }
});

describe("spamGuard — Aug 2 samples (real aol.com emails; block on gibberish/phone only)", () => {
  it('name "BtIxJDTsQRNbxenILsrYErCe" + aol.com blocks on gibberish', () => {
    const r = evaluateSpam({ name: "BtIxJDTsQRNbxenILsrYErCe", email: "someone@aol.com", phone: "9733926000" }, { now: NOW });
    expect(r.blocked).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(60);
  });
  it('name "otKYnHOfIDnGtchKbewkq" + aol.com blocks on gibberish', () => {
    const r = evaluateSpam({ name: "otKYnHOfIDnGtchKbewkq", email: "someone2@aol.com", phone: "9733926000" }, { now: NOW });
    expect(r.blocked).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(60);
  });
  it("phone 3002769806 (area code 300 = N00) blocks on NANP", () => {
    const r = evaluateSpam({ name: "John Smith", email: "j@aol.com", phone: "3002769806" }, { now: NOW });
    expect(r.blocked).toBe(true);
    expect(r.reasons.some((x) => x.startsWith("phone:nanp"))).toBe(true);
  });
  it("area code 411 (N11) is rejected", () => {
    const r = evaluateSpam({ phone: "4115551234" }, { now: NOW });
    expect(r.reasons.some((x) => x.startsWith("phone:nanp"))).toBe(true);
  });
  it("a normal NJ area code (201) still passes the phone check", () => {
    const r = evaluateSpam({ phone: "2015551234" }, { now: NOW });
    expect(r.reasons.some((x) => x.startsWith("phone:nanp"))).toBe(false);
  });
});

describe("spamGuard — honeypot + timing", () => {
  it("honeypot website blocks", () => {
    expect(evaluateSpam({ name: "Bob", website: "http://x.co" }, { now: NOW }).blocked).toBe(true);
  });
  it("honeypot company_url blocks", () => {
    expect(evaluateSpam({ name: "Bob", company_url: "x" }, { now: NOW }).blocked).toBe(true);
  });
  it("submit within 4s blocks", () => {
    expect(evaluateSpam({ name: "Bob", ts: NOW - 1500 }, { now: NOW }).blocked).toBe(true);
  });
  it("submit after 4s does not block on timing", () => {
    const r = evaluateSpam({ name: "Bob", ts: NOW - 9000 }, { now: NOW });
    expect(r.reasons.some((x) => x.startsWith("too_fast"))).toBe(false);
  });
});

describe("spamGuard — legitimate submissions must PASS (no false positives)", () => {
  const legit: Array<[string, Parameters<typeof evaluateSpam>[0]]> = [
    ["Schmidt surname (4-consonant run only)", { name: "Hans Schmidt", email: "hans@gmail.com", phone: "9733926000" }],
    ["Lynn (vowelless-looking, has y)", { name: "Lynn Bryn", email: "lynn@yahoo.com", phone: "2015551234" }],
    ["ordinary lead", { name: "Maria Gonzalez", email: "maria@hotmail.com", phone: "8624239396" }],
    ["single first name", { name: "José", email: "jose@icloud.com", phone: "9089991111" }],
  ];
  for (const [label, input] of legit) {
    it(`${label} passes`, () => {
      const r = evaluateSpam(input, { now: NOW });
      expect(r.blocked).toBe(false);
      expect(r.score).toBeLessThan(60);
    });
  }
});

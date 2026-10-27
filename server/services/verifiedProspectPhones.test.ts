import { describe, expect, it } from "vitest";
import { VERIFIED_PROSPECT_PHONES } from "./verifiedProspectPhones";

describe("publicly verified CRM prospect phone backfill", () => {
  it("has unique exact email keys and valid North American business numbers", () => {
    const emails = VERIFIED_PROSPECT_PHONES.map(x => x.email);
    expect(new Set(emails).size).toBe(emails.length);
    expect(VERIFIED_PROSPECT_PHONES.length).toBeGreaterThanOrEqual(20);
    for (const contact of VERIFIED_PROSPECT_PHONES) {
      expect(contact.email).toBe(contact.email.trim().toLowerCase());
      expect(contact.email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
      expect(contact.phone).toMatch(/^\d{10}$/);
      expect(contact.sourceUrl).toMatch(/^https:\/\//);
      expect(contact.type.length).toBeGreaterThan(0);
    }
  });
  it("does not include blocked or explicitly excluded recipients", () => {
    for (const entry of VERIFIED_PROSPECT_PHONES) {
      expect(entry.email).not.toMatch(/onyxequities\.com|vizapropertymanagement\.com|giga/i);
    }
  });
});

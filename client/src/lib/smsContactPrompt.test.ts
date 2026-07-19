import { describe, it, expect } from "vitest";
import { shouldOfferAddToSmsContacts } from "./smsContactPrompt";

describe("shouldOfferAddToSmsContacts", () => {
  it("HIDES when the conversation has a linked Customer", () => {
    expect(shouldOfferAddToSmsContacts({ hasLinkedCustomer: true })).toBe(false);
    // linked customer wins even if it's also a contact / has a lead
    expect(shouldOfferAddToSmsContacts({ hasLinkedCustomer: true, hasLinkedLead: true, isContact: true })).toBe(false);
  });

  it("HIDES when the conversation has a linked Lead (no customer)", () => {
    expect(shouldOfferAddToSmsContacts({ hasLinkedLead: true })).toBe(false);
    expect(shouldOfferAddToSmsContacts({ hasLinkedCustomer: false, hasLinkedLead: true, isContact: false })).toBe(false);
  });

  it("HIDES when the phone is already a saved SMS Contact (no customer/lead)", () => {
    expect(shouldOfferAddToSmsContacts({ isContact: true })).toBe(false);
    expect(shouldOfferAddToSmsContacts({ hasLinkedCustomer: false, hasLinkedLead: false, isContact: true })).toBe(false);
  });

  it("SHOWS when there is no linked Customer/Lead and it is not a saved contact", () => {
    expect(shouldOfferAddToSmsContacts({ hasLinkedCustomer: false, hasLinkedLead: false, isContact: false })).toBe(true);
    expect(shouldOfferAddToSmsContacts({})).toBe(true);
  });

  it("does not flash the prompt before send-state has loaded", () => {
    expect(shouldOfferAddToSmsContacts(undefined)).toBe(false);
    expect(shouldOfferAddToSmsContacts(null)).toBe(false);
  });
});

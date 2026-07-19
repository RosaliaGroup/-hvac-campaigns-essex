/**
 * Guards the internal-SMS contract: the Lead/Customer "Text" action must open
 * the in-app Communications thread and must NEVER emit an OS `sms:`/`tel:`
 * protocol link.
 */
import { describe, it, expect } from "vitest";
import {
  internalSmsConversationPath,
  phoneLast10,
  isDialablePhone,
  resolveConversationTarget,
} from "./internalSms";

describe("internalSmsConversationPath", () => {
  it("routes to the internal /sms-campaigns inbox with the phone", () => {
    expect(internalSmsConversationPath("+1 (862) 555-0142")).toBe(
      "/sms-campaigns?phone=%2B1%20(862)%20555-0142",
    );
  });

  it("NEVER produces an sms: / tel: / external protocol link", () => {
    for (const phone of ["+18625550142", "862-555-0142", "(973) 518-1815", "  ", "", null, undefined]) {
      const href = internalSmsConversationPath(phone as string);
      expect(href.startsWith("/sms-campaigns")).toBe(true);
      expect(href).not.toMatch(/^sms:/);
      expect(href).not.toMatch(/^tel:/);
      expect(href).not.toMatch(/sms:/);
    }
  });

  it("falls back to the bare inbox when no phone is given", () => {
    expect(internalSmsConversationPath(null)).toBe("/sms-campaigns");
    expect(internalSmsConversationPath("")).toBe("/sms-campaigns");
  });
});

describe("phoneLast10 / isDialablePhone", () => {
  it("reduces a formatted phone to its last 10 digits", () => {
    expect(phoneLast10("+1 (862) 555-0142")).toBe("8625550142");
    expect(phoneLast10("862-555-0142")).toBe("8625550142");
  });
  it("flags phones with a full 10-digit local number", () => {
    expect(isDialablePhone("+18625550142")).toBe(true);
    expect(isDialablePhone("555-0142")).toBe(false);
    expect(isDialablePhone(null)).toBe(false);
  });
});

describe("resolveConversationTarget (reuse vs create)", () => {
  const convs = [
    { key: "c:7", phone: "+1 (862) 555-0142" },
    { key: "p:9735181815", phone: "9735181815" },
  ];

  it("REUSES an existing conversation when the number already has a thread", () => {
    // Same number, different formatting → must match on last-10, not string.
    expect(resolveConversationTarget(convs, "862-555-0142")).toEqual({ kind: "existing", key: "c:7" });
    expect(resolveConversationTarget(convs, "+19735181815")).toEqual({ kind: "existing", key: "p:9735181815" });
  });

  it("CREATES a new (draft) thread when the number has no history", () => {
    expect(resolveConversationTarget(convs, "+12015551234")).toEqual({ kind: "new", phoneLast10: "2015551234" });
  });

  it("does nothing for an undialable phone", () => {
    expect(resolveConversationTarget(convs, "abc")).toBeNull();
    expect(resolveConversationTarget(convs, null)).toBeNull();
  });
});

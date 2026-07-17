import { describe, it, expect } from "vitest";
import { evaluateBulkSend, SEND_GATE_MESSAGES } from "./smsSendGate";

const CONTACTS = [
  { id: 1, optedOut: false }, // active
  { id: 2, optedOut: true },  // opted out
  { id: 3, optedOut: false }, // active
];

describe("evaluateBulkSend (SMS Manager send gate)", () => {
  it("existing, active selected contact → proceeds and a request would fire", () => {
    const r = evaluateBulkSend({ target: "selected", message: "hi", selectedContactIds: [1], contacts: CONTACTS });
    expect(r).toEqual({ ok: true, contactIds: [1] });
  });

  it("missing SMS contact (id not in list) → blocked, specific warning, no request", () => {
    const r = evaluateBulkSend({ target: "selected", message: "hi", selectedContactIds: [999], contacts: CONTACTS });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("no_recipients");
      expect(r.message).toBe("This number is not in SMS Contacts. Add or import the contact before sending.");
    }
  });

  it("opted-out contact → blocked with opt-out warning, no request", () => {
    const r = evaluateBulkSend({ target: "selected", message: "hi", selectedContactIds: [2], contacts: CONTACTS });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("all_opted_out");
      expect(r.message).toBe(SEND_GATE_MESSAGES.all_opted_out);
    }
  });

  it("empty / whitespace-only message → blocked by validation, no request", () => {
    for (const message of ["", "   ", "\n\t"]) {
      const r = evaluateBulkSend({ target: "selected", message, selectedContactIds: [1], contacts: CONTACTS });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("empty_message");
    }
  });

  it("one selected contact cannot leak to other (filtered) contacts", () => {
    // Contacts 1 and 3 are both active, but only 3 is selected.
    const r = evaluateBulkSend({ target: "selected", message: "hi", selectedContactIds: [3], contacts: CONTACTS });
    expect(r).toEqual({ ok: true, contactIds: [3] }); // never includes 1
  });

  it("no contacts selected → blocked (no recipients), no request", () => {
    const r = evaluateBulkSend({ target: "selected", message: "hi", selectedContactIds: [], contacts: CONTACTS });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_recipients");
  });

  it("target=all sends only to active contacts, excludes opted-out", () => {
    const r = evaluateBulkSend({ target: "all", message: "hi", selectedContactIds: [], contacts: CONTACTS });
    expect(r).toEqual({ ok: true, contactIds: [1, 3] }); // 2 (opted out) excluded
  });

  it("every blocked case returns ok:false so no Telnyx request can occur", () => {
    const blocked = [
      evaluateBulkSend({ target: "selected", message: "", selectedContactIds: [1], contacts: CONTACTS }),
      evaluateBulkSend({ target: "selected", message: "hi", selectedContactIds: [999], contacts: CONTACTS }),
      evaluateBulkSend({ target: "selected", message: "hi", selectedContactIds: [2], contacts: CONTACTS }),
      evaluateBulkSend({ target: "selected", message: "hi", selectedContactIds: [], contacts: CONTACTS }),
    ];
    expect(blocked.every((r) => r.ok === false)).toBe(true);
  });
});

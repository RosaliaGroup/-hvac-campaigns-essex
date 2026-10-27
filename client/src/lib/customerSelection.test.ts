import { describe, expect, it } from "vitest";
import {
  MAX_SMS_SELECTION, toggleContactSelection,
  selectContactsFromPage, deselectContactsFromPage, isOct27HvacImport,
} from "./customerSelection";

describe("CRM contact selection", () => {
  it("unchecks any individual selected lead even when the 20-contact cap is full", () => {
    const selected = Array.from({ length: MAX_SMS_SELECTION }, (_, i) => i + 1);
    expect(toggleContactSelection(selected, 7)).not.toContain(7);
    expect(toggleContactSelection(selected, 21)).toEqual(selected);
  });
  it("selects a maximum of 20 on a 50-row page and allows page-only deselection", () => {
    const page = Array.from({ length: 50 }, (_, i) => i + 1);
    const selected = selectContactsFromPage([99], page);
    expect(selected).toHaveLength(20);
    expect(selected).toContain(99);
    expect(deselectContactsFromPage(selected, page)).toEqual([99]);
  });
  it("removes a partial selection even when the page checkbox can never be fully selected", () => {
    expect(deselectContactsFromPage([2, 6, 111], [1, 2, 3, 4, 5, 6])).toEqual([111]);
    expect(toggleContactSelection([12, 13], 12)).toEqual([13]);
  });
});

describe("Oct 27 purchased homeowner import labeling", () => {
  it("marks only HVAC records inserted on Oct 27 in New York local time", () => {
    expect(isOct27HvacImport("hvac-list-07105", "2026-10-27T17:50:00Z")).toBe(true);
    expect(isOct27HvacImport("hvac-list-07105", "2026-10-28T03:59:59Z")).toBe(true);
    expect(isOct27HvacImport("hvac-list-07105", "2026-10-28T04:00:00Z")).toBe(false);
    expect(isOct27HvacImport("hvac-list-07105", "2026-10-27T03:59:59Z")).toBe(false);
    expect(isOct27HvacImport("Gmail Sent", "2026-10-27T17:50:00Z")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { formatMoney, formatDate, humanize, docStatusTone, apptStatusTone, genericStatusTone } from "./format";

describe("formatMoney", () => {
  it("formats numeric and string amounts as USD", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50");
    expect(formatMoney("99.9")).toBe("$99.90");
  });
  it("renders an em-dash for missing/invalid values (never fabricates 0)", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney("")).toBe("—");
    expect(formatMoney("not-a-number")).toBe("—");
  });
});

describe("formatDate", () => {
  it("renders an em-dash for null/invalid dates", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("nonsense")).toBe("—");
  });
  it("formats a real date", () => {
    expect(formatDate("2026-07-16T00:00:00Z")).toMatch(/2026/);
  });
});

describe("humanize", () => {
  it("title-cases snake_case tokens", () => {
    expect(humanize("service_call")).toBe("Service Call");
    expect(humanize("maintenance_plan")).toBe("Maintenance Plan");
  });
  it("handles empty input", () => {
    expect(humanize(null)).toBe("—");
  });
});

describe("status tones", () => {
  it("maps document statuses to semantic tones", () => {
    expect(docStatusTone("paid")).toBe("success");
    expect(docStatusTone("pending")).toBe("warning");
    expect(docStatusTone("rejected")).toBe("danger");
    expect(docStatusTone("weird")).toBe("neutral");
  });
  it("maps appointment + generic statuses", () => {
    expect(apptStatusTone("confirmed")).toBe("success");
    expect(apptStatusTone("cancelled")).toBe("danger");
    expect(genericStatusTone("active")).toBe("success");
    expect(genericStatusTone("expired")).toBe("danger");
  });
});

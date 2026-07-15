import { describe, it, expect } from "vitest";
import {
  isValidEmail,
  normalizeUsPhoneDigits,
  isValidUsPhone,
  formatUsPhone,
  telHref,
} from "./validation";

describe("isValidEmail", () => {
  it("accepts normal addresses", () => {
    expect(isValidEmail("tech@mechanicalenterprise.com")).toBe(true);
    expect(isValidEmail("  a.b-c@sub.example.co  ")).toBe(true);
  });
  it("rejects malformed / empty", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });
});

describe("normalizeUsPhoneDigits", () => {
  it("extracts 10 digits from varied formats", () => {
    expect(normalizeUsPhoneDigits("(555) 123-4567")).toBe("5551234567");
    expect(normalizeUsPhoneDigits("555.123.4567")).toBe("5551234567");
    expect(normalizeUsPhoneDigits("+1 555 123 4567")).toBe("5551234567");
    expect(normalizeUsPhoneDigits("15551234567")).toBe("5551234567");
  });
  it("rejects wrong-length input", () => {
    expect(normalizeUsPhoneDigits("123")).toBeNull();
    expect(normalizeUsPhoneDigits("555123456")).toBeNull(); // 9 digits
    expect(normalizeUsPhoneDigits("25551234567")).toBeNull(); // 11 not starting with 1
    expect(normalizeUsPhoneDigits("")).toBeNull();
    expect(normalizeUsPhoneDigits(null)).toBeNull();
  });
});

describe("isValidUsPhone", () => {
  it("mirrors normalize result", () => {
    expect(isValidUsPhone("(555) 123-4567")).toBe(true);
    expect(isValidUsPhone("nope")).toBe(false);
  });
});

describe("formatUsPhone", () => {
  it("formats to (555) 123-4567", () => {
    expect(formatUsPhone("5551234567")).toBe("(555) 123-4567");
    expect(formatUsPhone("+1 (555) 123.4567")).toBe("(555) 123-4567");
  });
  it("returns null for invalid", () => {
    expect(formatUsPhone("123")).toBeNull();
    expect(formatUsPhone(null)).toBeNull();
  });
});

describe("telHref", () => {
  it("builds an E.164 tel value", () => {
    expect(telHref("(555) 123-4567")).toBe("+15551234567");
    expect(telHref("bad")).toBeNull();
  });
});

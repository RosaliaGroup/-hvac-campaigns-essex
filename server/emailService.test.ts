import { describe, it, expect } from "vitest";
import { Resend } from "resend";

describe("Email Service — Resend API Key", () => {
  it("should have RESEND_API_KEY configured", () => {
    const key = process.env.RESEND_API_KEY;
    expect(key, "RESEND_API_KEY must be set").toBeTruthy();
    expect(key!.startsWith("re_"), "RESEND_API_KEY should start with re_").toBe(true);
  });

  it("should be able to initialize Resend client without throwing", () => {
    const key = process.env.RESEND_API_KEY;
    expect(() => new Resend(key!)).not.toThrow();
  });
});

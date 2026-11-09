import { describe, expect, it } from "vitest";
import { reviewAskSms, reviewAskEmailHtml } from "./reviewEngine";

const LINK = "https://search.google.com/local/writereview?placeid=TEST";

describe("review ask copy", () => {
  it("puts the Google link in the first text for every customer (no gating)", () => {
    const msg = reviewAskSms(LINK);
    expect(msg).toContain(LINK);
    expect(msg).not.toMatch(/reply with a number/i);
    expect(msg).toMatch(/Reply STOP to opt out/);
  });

  it("falls back to the 1-5 question when no link is configured", () => {
    const msg = reviewAskSms(null);
    expect(msg).toMatch(/Reply with a number 1-5/);
    expect(msg).toMatch(/Reply STOP to opt out/);
  });

  it("emails the same link", () => {
    expect(reviewAskEmailHtml(LINK)).toContain(`href="${LINK}"`);
  });
});

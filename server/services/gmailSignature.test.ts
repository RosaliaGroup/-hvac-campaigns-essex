import { describe, expect, it } from "vitest";
import { cleanSignatureHtml, composeMimeWithSignature } from "./gmailCompose";

describe("follow-up signature", () => {
  it("replaces the owner's cell with the business line", () => {
    const out = cleanSignatureHtml('<a href="tel:+12014496850">201-449-6850</a> (201) 449-6850 201.449.6850');
    expect(out).not.toMatch(/449/);
    expect(out).toContain("tel:+18624191763");
    expect(out).toContain("(862) 419-1763");
  });
  it("builds a multipart email with text and html parts", () => {
    const raw = Buffer.from(composeMimeWithSignature("a@example.com", "Hi", "Hello,\n\nThanks.", "<b>Ana Haynes</b><br>President"), "base64url").toString();
    expect(raw).toContain("multipart/alternative");
    expect(raw).toContain("text/plain");
    expect(raw).toContain("text/html");
  });
});

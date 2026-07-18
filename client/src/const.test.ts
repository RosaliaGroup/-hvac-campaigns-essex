/**
 * #4 — unauthenticated redirect must go to the working team login, never the
 * unconfigured Manus OAuth portal (which produced mechanicalenterprise.com/
 * app-auth?appId=local-dev → 404), and must not become an open redirect.
 */
import { describe, it, expect } from "vitest";
import { getLoginUrl, sanitizeReturnPath } from "./const";

describe("sanitizeReturnPath", () => {
  it("keeps a safe same-origin relative path (with query)", () => {
    expect(sanitizeReturnPath("/field/my-jobs?tech=3")).toBe("/field/my-jobs?tech=3");
    expect(sanitizeReturnPath("/field/jobs/4")).toBe("/field/jobs/4");
  });
  it("rejects open-redirect / non-relative inputs, falling back to /field/my-jobs", () => {
    expect(sanitizeReturnPath("//evil.example.com")).toBe("/field/my-jobs");
    expect(sanitizeReturnPath("https://evil.example.com")).toBe("/field/my-jobs");
    expect(sanitizeReturnPath("http://mechanicalenterprise.com/app-auth")).toBe("/field/my-jobs");
    expect(sanitizeReturnPath("/\\evil.example.com")).toBe("/field/my-jobs");
    expect(sanitizeReturnPath("javascript:alert(1)")).toBe("/field/my-jobs");
    expect(sanitizeReturnPath("field/my-jobs")).toBe("/field/my-jobs"); // no leading slash
    expect(sanitizeReturnPath("")).toBe("/field/my-jobs");
  });
});

describe("getLoginUrl", () => {
  it("redirects to /team-login and NEVER to the OAuth portal", () => {
    const url = getLoginUrl();
    expect(url.startsWith("/team-login?return=")).toBe(true);
    expect(url).not.toContain("mechanicalenterprise.com");
    expect(url).not.toContain("app-auth");
    expect(url).not.toContain("local-dev");
    expect(url).not.toContain("://"); // relative, same-origin
  });
  it("carries a sanitized, same-origin relative return path", () => {
    const url = getLoginUrl();
    const ret = decodeURIComponent(url.split("return=")[1] ?? "");
    expect(ret.startsWith("/")).toBe(true);
    expect(ret.startsWith("//")).toBe(false);
  });
});

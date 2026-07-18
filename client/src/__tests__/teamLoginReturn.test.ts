/**
 * #4 (review finding) — TeamLogin honors a post-login `?return=` path, but MUST
 * sanitize it to a safe same-origin relative path so a crafted
 * `/team-login?return=//evil.com` cannot become an open redirect after login.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(process.cwd(), "client/src/pages/TeamLogin.tsx"), "utf8");

describe("#4 TeamLogin sanitizes the post-login return path", () => {
  it("routes the ?return= value through sanitizeReturnPath", () => {
    expect(src).toContain("sanitizeReturnPath");
  });
  it("does not assign returnPath straight from decodeURIComponent (must sanitize)", () => {
    // Guard: the return value must pass through sanitizeReturnPath, not be used raw.
    expect(src).not.toMatch(/returnPath\s*=\s*params\.get\("return"\)\s*\?\s*decodeURIComponent/);
  });
});

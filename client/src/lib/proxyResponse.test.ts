import { describe, expect, it } from "vitest";
import { describeProxyFailure } from "./proxyResponse";

describe("describeProxyFailure", () => {
  it("passes through a normal JSON success (returns null)", () => {
    expect(describeProxyFailure(200, "application/json", '{"result":{"data":1}}')).toBeNull();
  });

  it("passes through a proper tRPC JSON error envelope (returns null)", () => {
    expect(describeProxyFailure(401, "application/json; charset=utf-8", '{"error":{"json":{}}}')).toBeNull();
    expect(describeProxyFailure(400, "application/json", '{"error":{"json":{}}}')).toBeNull();
  });

  it("flags an empty-body 400 (Netlify over-cap proxy rejection) with the size hint", () => {
    const msg = describeProxyFailure(400, "text/plain; charset=utf-8", "");
    expect(msg).toContain("HTTP 400");
    expect(msg).toContain("empty response");
    expect(msg).toMatch(/too large for the API proxy/i);
  });

  it("flags a gateway 502/504 as a gateway failure", () => {
    const msg = describeProxyFailure(504, "text/html", "<html>gateway timeout</html>");
    expect(msg).toContain("HTTP 504");
    expect(msg).toMatch(/gateway/i);
  });

  it("truncates the response snippet and never exceeds the cap", () => {
    const long = "x".repeat(500);
    const msg = describeProxyFailure(500, "text/plain", long)!;
    expect(msg).toContain("HTTP 500");
    // snippet capped at 200 chars — the full 500-char body must not appear
    expect(msg).not.toContain(long);
    expect(msg.includes("x".repeat(200))).toBe(true);
    expect(msg.includes("x".repeat(201))).toBe(false);
  });

  it("does not flag an empty 2xx JSON response (leaves it to tRPC)", () => {
    expect(describeProxyFailure(200, "application/json", "")).toBeNull();
  });
});

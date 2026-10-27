import { describe, expect, it, vi, afterEach } from "vitest";
import { verifyLiveBlogPath } from "./livePublicationCheck";

afterEach(() => vi.unstubAllGlobals());

const path = "/blog/commercial-hvac-repair-or-replace-decision-guide";
const url = "https://mechanicalenterprise.com" + path;
function mockPage(html: string, status = 200, finalUrl = url) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status, url: finalUrl, text: async () => html,
  }));
}
describe("independent production blog verifier", () => {
  it("accepts a 200 response with correct canonical and page content", async () => {
    mockPage('<html><head><link rel="canonical" href="' + url + '"></head><body>' + path.slice(6) + '</body></html>');
    const result = await verifyLiveBlogPath(path);
    expect(result.status).toBe("verified_live");
    expect(result.canonicalMatches).toBe(true);
    expect(result.contentPresent).toBe(true);
  });
  it("rejects site-wide HTML without the expected article", async () => {
    mockPage('<link rel="canonical" href="' + url + '"><div>Generic SPA fallback</div>');
    expect((await verifyLiveBlogPath(path)).status).toBe("not_live");
  });
  it("rejects canonical pointing at a different article", async () => {
    mockPage('<link rel="canonical" href="https://mechanicalenterprise.com/blog/other"><p>' + path.slice(6) + '</p>');
    expect((await verifyLiveBlogPath(path)).canonicalMatches).toBe(false);
  });
  it("rejects redirected destination", async () => {
    mockPage('<p>' + path.slice(6) + '</p>', 200, "https://mechanicalenterprise.com/");
    expect((await verifyLiveBlogPath(path)).reason).toContain("Redirected");
  });
  it("reports non-200 response as not live", async () => {
    mockPage("", 404);
    expect((await verifyLiveBlogPath(path)).httpStatus).toBe(404);
  });
  it("reports fetch errors as unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    expect((await verifyLiveBlogPath(path)).status).toBe("unreachable");
  });
  it("rejects unsafe paths before requesting the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(verifyLiveBlogPath("/admin")).rejects.toThrow("Invalid blog path");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

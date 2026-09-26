import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getNetlifyCheckState,
  hasAnyPRComments,
  closePR,
  mergePR,
  isGithubConfigured,
  GithubNotConfiguredError,
} from "./github";

const originalFetch = global.fetch;
const originalToken = process.env.SEO_GITHUB_TOKEN;

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

beforeEach(() => {
  process.env.SEO_GITHUB_TOKEN = "test-token";
});
afterEach(() => {
  global.fetch = originalFetch;
  process.env.SEO_GITHUB_TOKEN = originalToken;
});

describe("isGithubConfigured", () => {
  it("is false without a token and every write throws GithubNotConfiguredError", async () => {
    delete process.env.SEO_GITHUB_TOKEN;
    expect(isGithubConfigured()).toBe(false);
    await expect(closePR(1)).rejects.toThrow(GithubNotConfiguredError);
  });
});

describe("getNetlifyCheckState", () => {
  it("maps a netlify success status", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({ statuses: [{ context: "netlify/site/deploy-preview", state: "success" }] }),
    ) as unknown as typeof fetch;
    expect(await getNetlifyCheckState("abc123")).toBe("success");
  });

  it("maps a netlify failure status", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({ statuses: [{ context: "netlify/site/deploy-preview", state: "failure" }] }),
    ) as unknown as typeof fetch;
    expect(await getNetlifyCheckState("abc123")).toBe("failure");
  });

  it("returns unknown when there is no netlify status at all", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ statuses: [] })) as unknown as typeof fetch;
    expect(await getNetlifyCheckState("abc123")).toBe("unknown");
  });
});

describe("hasAnyPRComments", () => {
  it("true when the PR has comments", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse([{ id: 1 }])) as unknown as typeof fetch;
    expect(await hasAnyPRComments(5)).toBe(true);
  });

  it("false when the PR has none", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse([])) as unknown as typeof fetch;
    expect(await hasAnyPRComments(5)).toBe(false);
  });
});

describe("closePR", () => {
  it("PATCHes state=closed and never merges", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    global.fetch = fetchMock as unknown as typeof fetch;
    await closePR(9);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/pulls/9");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ state: "closed" });
  });
});

describe("mergePR", () => {
  it("PUTs to /merge and returns the merge result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ merged: true, sha: "deadbeef" }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const result = await mergePR(9);
    expect(result).toEqual({ merged: true, sha: "deadbeef" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/pulls/9/merge");
    expect(init.method).toBe("PUT");
  });
});

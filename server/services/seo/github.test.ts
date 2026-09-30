import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getNetlifyCheckState,
  hasHumanPRComments,
  hasHumanComment,
  isBotComment,
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

describe("hasHumanPRComments", () => {
  const netlify = { id: 1, user: { login: "netlify[bot]", type: "Bot" }, body: "Deploy Preview ready!" };
  const person = { id: 2, user: { login: "RosaliaGroup", type: "User" }, body: "hold on, wrong title" };

  /** Route the two endpoints to different payloads. */
  function mockComments(issue: unknown[], review: unknown[]) {
    global.fetch = vi.fn(async (url: string) => jsonResponse(String(url).includes("/pulls/") ? review : issue)) as unknown as typeof fetch;
  }

  it("true when a person commented", async () => {
    mockComments([person], []);
    expect(await hasHumanPRComments(5)).toBe(true);
  });

  it("false when the PR has no comments at all", async () => {
    mockComments([], []);
    expect(await hasHumanPRComments(5)).toBe(false);
  });

  it("FALSE when the only comment is Netlify's deploy-preview bot (the 2026-09-30 #141 case) — that must not block auto-merge", async () => {
    mockComments([netlify], []);
    expect(await hasHumanPRComments(5)).toBe(false);
  });

  it("true when a bot AND a person commented (the person still blocks)", async () => {
    mockComments([netlify, person], []);
    expect(await hasHumanPRComments(5)).toBe(true);
  });

  it("true for an inline REVIEW comment by a person (the gate covers review comments, not just top-level ones)", async () => {
    mockComments([netlify], [person]);
    expect(await hasHumanPRComments(5)).toBe(true);
  });

  it("false when the inline review comments are all bots too", async () => {
    mockComments([netlify], [{ user: { login: "github-actions[bot]", type: "Bot" } }]);
    expect(await hasHumanPRComments(5)).toBe(false);
  });

  it("checks BOTH endpoints", async () => {
    mockComments([], []);
    await hasHumanPRComments(7);
    const urls = vi.mocked(global.fetch).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("/issues/7/comments"))).toBe(true);
    expect(urls.some((u) => u.includes("/pulls/7/comments"))).toBe(true);
  });
});

describe("isBotComment / hasHumanComment", () => {
  it("recognises bots by type OR by a [bot] login suffix", () => {
    expect(isBotComment({ user: { type: "Bot", login: "x" } })).toBe(true);
    expect(isBotComment({ user: { type: "User", login: "renovate[bot]" } })).toBe(true);
    expect(isBotComment({ user: { type: "User", login: "RosaliaGroup" } })).toBe(false);
  });

  it("treats a comment with no user info as human (fail toward blocking the merge, never toward merging)", () => {
    expect(isBotComment({})).toBe(false);
    expect(isBotComment({ user: null })).toBe(false);
    expect(hasHumanComment([{ id: 1 }])).toBe(true);
  });

  it("is false for a non-array payload or an empty list", () => {
    expect(hasHumanComment(undefined)).toBe(false);
    expect(hasHumanComment({ message: "Not Found" })).toBe(false);
    expect(hasHumanComment([])).toBe(false);
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

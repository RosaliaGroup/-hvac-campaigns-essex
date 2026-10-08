import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getNetlifyCheckState,
  hasAnyPRComments,
  countHumanPRComments,
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
  it("accepts only a successful dedicated build check for the requested commit when Netlify is absent", async () => {
    const mock = vi.fn().mockResolvedValueOnce(jsonResponse({ statuses: [] }))
      .mockResolvedValueOnce(jsonResponse({ check_runs: [{ name: "SEO automation build", status: "completed", conclusion: "success" }] }));
    global.fetch = mock as unknown as typeof fetch;
    expect(await getNetlifyCheckState("head123")).toBe("success");
    expect(mock.mock.calls[1][0]).toContain("/commits/head123/check-runs");
  });
  it.each(["failure", "cancelled", "skipped", "timed_out"])("blocks a build concluded %s", async (conclusion) => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ statuses: [] }))
      .mockResolvedValueOnce(jsonResponse({ check_runs: [{ name: "SEO automation build", status: "completed", conclusion }] })) as unknown as typeof fetch;
    expect(await getNetlifyCheckState("head123")).toBe("failure");
  });
  it("keeps an unfinished build pending", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ statuses: [] }))
      .mockResolvedValueOnce(jsonResponse({ check_runs: [{ name: "SEO automation build", status: "in_progress", conclusion: null }] })) as unknown as typeof fetch;
    expect(await getNetlifyCheckState("head123")).toBe("pending");
  });

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

describe("hasAnyPRComments — bot comments don't count (PR #141 regression)", () => {
  const netlify = { id: 1, user: { login: "netlify[bot]", type: "Bot" } };
  const human = { id: 2, user: { login: "RosaliaGroup", type: "User" } };

  function mockFetch(issue: unknown[], review: unknown[] = []) {
    global.fetch = vi.fn().mockImplementation(async (url: string) => jsonResponse(String(url).includes("/pulls/") ? review : issue)) as unknown as typeof fetch;
  }

  it("ignores Netlify's deploy-preview comment — a PR whose only comment is the bot's has no human comments", async () => {
    mockFetch([netlify]);
    expect(await hasAnyPRComments(141)).toBe(false);
    expect(await countHumanPRComments(141)).toBe(0);
  });

  it("ignores any [bot] login even if type is missing", async () => {
    mockFetch([{ id: 3, user: { login: "github-actions[bot]" } }]);
    expect(await hasAnyPRComments(5)).toBe(false);
  });

  it("still blocks on a human issue comment (the veto-by-comment gate)", async () => {
    mockFetch([netlify, human]);
    expect(await hasAnyPRComments(5)).toBe(true);
    expect(await countHumanPRComments(5)).toBe(1);
  });

  it("counts inline review comments too (issue comments alone missed those)", async () => {
    mockFetch([netlify], [human]);
    expect(await hasAnyPRComments(5)).toBe(true);
  });

  it("isBotComment: type Bot or [bot] suffix; a missing user is treated as human (fail closed)", () => {
    expect(isBotComment({ user: { login: "x", type: "Bot" } })).toBe(true);
    expect(isBotComment({ user: { login: "dependabot[bot]" } })).toBe(true);
    expect(isBotComment({ user: { login: "RosaliaGroup", type: "User" } })).toBe(false);
    expect(isBotComment({ user: null })).toBe(false);
    expect(isBotComment({})).toBe(false);
  });
});

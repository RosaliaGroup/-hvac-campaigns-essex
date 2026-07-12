import { describe, it, expect } from "vitest";
import { publishSocialPost, retrySocialPost, type PublisherDeps } from "./socialPublisher";
import {
  runSuccessCanary,
  runFailureRetryCanary,
  deleteCanaryExternal,
  getStatus,
  getAudit,
  runSafetyChecks,
  buildDestinationStatus,
  CANARY_CONTENT,
  CANARY_TYPE_SUCCESS,
  CANARY_TYPE_FAILURE,
  CanaryError,
  type CanaryDeps,
  type DestinationStatus,
} from "./marketingCanary";

/** Shared in-memory store wired into BOTH publisher deps and canary deps. */
function makeHarness(opts?: {
  connected?: boolean;
  platformFn?: (platform: string) => Promise<string>;
}) {
  const rows: any[] = [];
  let seq = 0;
  let externalPosts = 0;
  const connected = opts?.connected ?? true;

  const publisherDeps: PublisherDeps = {
    getById: async (id) => rows.find((r) => r.id === id) ?? null,
    findReusable: async (platform, content) =>
      [...rows].reverse().find((r) => r.platform === platform && r.content === content) ?? null,
    create: async (row) => {
      const id = ++seq;
      rows.push({ id, postId: null, ...row });
      return id;
    },
    update: async (id, patch) => {
      const r = rows.find((x) => x.id === id);
      if (r) Object.assign(r, patch);
    },
    publishToPlatform: async (platform) => {
      externalPosts++;
      if (opts?.platformFn) return await opts.platformFn(platform);
      return `ext_${platform}_${externalPosts}`;
    },
  };

  const status = (platform: string): DestinationStatus => ({
    platform,
    label: platform,
    connected,
    credentialsAvailable: connected,
    destinationName: connected ? platform : null,
    destinationRef: connected ? "…4321" : null,
    health: connected ? "connected" : "missing",
  });

  const canaryDeps: CanaryDeps = {
    publisherDeps,
    publish: publishSocialPost,
    retry: retrySocialPost,
    credentialStatus: async (p) => status(p),
    findCanaryRow: async (platform, contentType) => {
      const r = [...rows].reverse().find((x) => x.platform === platform && x.contentType === contentType);
      return r ? { id: r.id, status: r.status } : null;
    },
    createRow: async (row) => {
      const id = ++seq;
      rows.push({ id, content: CANARY_CONTENT, postId: null, status: "draft", ...row });
      return id;
    },
    getRow: async (id) => {
      const r = rows.find((x) => x.id === id);
      return r
        ? { id: r.id, platform: r.platform, contentType: r.contentType ?? null, status: r.status, postId: r.postId ?? null, engagement: r.engagement ?? null, errorMessage: r.errorMessage ?? null }
        : null;
    },
    updateRow: async (id, patch) => {
      const r = rows.find((x) => x.id === id);
      if (r) Object.assign(r, patch);
    },
    listCanary: async () =>
      rows
        .filter((r) => String(r.contentType ?? "").startsWith("canary"))
        .map((r) => ({ id: r.id, platform: r.platform, contentType: r.contentType, status: r.status, postId: r.postId ?? null, createdAt: null, postedAt: null, errorMessage: r.errorMessage ?? null, meta: r.engagement ? JSON.parse(r.engagement) : null })),
    deleteExternalPost: async (platform) =>
      platform === "instagram" ? { supported: false, deleted: false, detail: "unsupported" } : { supported: true, deleted: true },
  };

  return { rows, canaryDeps, get externalPosts() { return externalPosts; } };
}

describe("marketingCanary — preflight guards", () => {
  it("requires explicit confirmation", async () => {
    const h = makeHarness();
    await expect(runSuccessCanary("facebook", 1, false as any, h.canaryDeps)).rejects.toMatchObject({ code: "NOT_CONFIRMED" });
    expect(h.externalPosts).toBe(0);
  });

  it("blocks when no destination is connected", async () => {
    const h = makeHarness({ connected: false });
    await expect(runSuccessCanary("facebook", 1, true, h.canaryDeps)).rejects.toBeInstanceOf(CanaryError);
    await expect(runSuccessCanary("facebook", 1, true, h.canaryDeps)).rejects.toMatchObject({ code: "NO_DESTINATION" });
    expect(h.externalPosts).toBe(0);
  });

  it("getStatus reports connection + never leaks a token", async () => {
    const h = makeHarness();
    const st = await getStatus(h.canaryDeps);
    expect(st.platforms.length).toBe(3);
    expect(st.canaryContent).toBe(CANARY_CONTENT);
    expect(JSON.stringify(st)).not.toMatch(/accessToken|Bearer|secret/i);
  });
});

describe("marketingCanary — successful publish + idempotency", () => {
  it("publishes once, uses fixed content, and a repeat reuses the same row/external id", async () => {
    const h = makeHarness();
    const r = await runSuccessCanary("facebook", 7, true, h.canaryDeps);

    expect(r.firstStatus).toBe("posted");
    expect(r.externalId).toBeTruthy();
    expect(r.secondAlreadyPosted).toBe(true);
    expect(r.duplicatePrevented).toBe(true);
    expect(h.externalPosts).toBe(1); // ONE external post despite two requests

    const canaryRows = h.rows.filter((x) => x.contentType === CANARY_TYPE_SUCCESS);
    expect(canaryRows).toHaveLength(1); // ONE DB row
    expect(canaryRows[0].content).toBe(CANARY_CONTENT); // fixed, no real content
    expect(canaryRows[0].postId).toBe(r.externalId); // external id stored
  });
});

describe("marketingCanary — failure then retry", () => {
  it("row becomes failed with a safe error, then retry reuses the same row → posted", async () => {
    const h = makeHarness();
    const r = await runFailureRetryCanary("facebook", 7, true, h.canaryDeps);

    expect(r.failedStatus).toBe("failed");
    expect(r.failedError).toBeTruthy();
    expect(r.failedError).not.toContain("\n");
    expect(r.retryStatus).toBe("posted");
    expect(r.sameRow).toBe(true);
    expect(r.duplicatePrevented).toBe(true);
    expect(r.externalId).toBeTruthy();

    const rows = h.rows.filter((x) => x.contentType === CANARY_TYPE_FAILURE);
    expect(rows).toHaveLength(1); // no duplicate row
    expect(h.externalPosts).toBe(1); // only the successful retry hit the API (failure made no call)
  });

  it("a second failure/retry run is idempotent (already posted)", async () => {
    const h = makeHarness();
    await runFailureRetryCanary("facebook", 7, true, h.canaryDeps);
    const again = await runFailureRetryCanary("facebook", 7, true, h.canaryDeps);
    expect(again.alreadyPosted).toBe(true);
    expect(h.externalPosts).toBe(1); // unchanged
  });
});

describe("marketingCanary — cleanup", () => {
  it("deletes the external post and marks the row canary_completed (row preserved)", async () => {
    const h = makeHarness();
    const r = await runSuccessCanary("facebook", 7, true, h.canaryDeps);
    const del = await deleteCanaryExternal(r.rowId, h.canaryDeps);

    expect(del.deleted).toBe(true);
    expect(del.state).toBe("canary_completed");

    const audit = await getAudit(h.canaryDeps);
    const row = audit.find((x) => x.id === r.rowId)!;
    expect(row).toBeTruthy(); // row preserved as audit evidence
    expect(row.meta?.state).toBe("canary_completed");
  });

  it("refuses to delete a non-canary row", async () => {
    const h = makeHarness();
    h.rows.push({ id: 999, platform: "facebook", content: "real content", contentType: "hvac_tip", status: "posted", postId: "x" });
    await expect(deleteCanaryExternal(999, h.canaryDeps)).rejects.toMatchObject({ code: "NOT_CANARY" });
  });
});

describe("marketingCanary — credential safety (no leakage)", () => {
  it("buildDestinationStatus masks the reference and never returns the token", () => {
    const st = buildDestinationStatus("facebook", { accessToken: "SUPER_SECRET_TOKEN_123", pageId: "987654321" });
    expect(st.connected).toBe(true);
    expect(st.destinationRef).toBe("…4321");
    expect(JSON.stringify(st)).not.toContain("SUPER_SECRET_TOKEN_123");
    expect(JSON.stringify(st)).not.toContain("accessToken");
  });

  it("reports not-connected when credentials are missing", () => {
    const st = buildDestinationStatus("google_business", { accessToken: "t" });
    expect(st.connected).toBe(false);
    expect(st.destinationRef).toBeNull();
    expect(st.health).toBe("missing");
  });
});

describe("marketingCanary — deterministic safety checks", () => {
  it("all guardrail checks pass (approval, Nextdoor queued, AI safety)", async () => {
    const checks = await runSafetyChecks();
    const byName = Object.fromEntries(checks.map((c) => [c.name, c.passed]));
    expect(byName.unapproved_blocked).toBe(true);
    expect(byName.retry_requires_approval).toBe(true);
    expect(byName.nextdoor_queued_only).toBe(true);
    expect(byName.malformed_ai_json_safe).toBe(true);
    expect(byName.testimonial_no_invention).toBe(true);
  });
});

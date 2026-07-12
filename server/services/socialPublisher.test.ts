import { describe, it, expect } from "vitest";
import {
  publishSocialPost,
  retrySocialPost,
  PublishError,
  safeErrorMessage,
  isApiPublishable,
  type PublisherDeps,
  type SocialPostRow,
} from "./socialPublisher";

/**
 * In-memory fake of the publisher's persistence + platform deps. Lets us assert
 * on the exact rows written and the number of external publish calls made —
 * i.e. the idempotency / failure / retry guarantees at the persistence and
 * external-payload level, with no DB or network.
 */
function makeHarness(opts?: {
  // Per-platform behaviour: return an external id (success) or throw (failure).
  platform?: (platform: string, content: string, media?: string[]) => Promise<string>;
}) {
  const rows: SocialPostRow[] = [];
  let seq = 0;
  let publishCalls = 0;
  const publishArgs: Array<{ platform: string; content: string; media?: string[] }> = [];

  const deps: PublisherDeps = {
    getById: async (id) => rows.find((r) => r.id === id) ?? null,
    findReusable: async (platform, content) =>
      [...rows].reverse().find((r) => r.platform === platform && r.content === content) ?? null,
    create: async (row) => {
      const id = ++seq;
      rows.push({
        id,
        platform: row.platform,
        content: row.content,
        status: row.status,
        postId: null,
        mediaUrls: row.mediaUrls,
      });
      return id;
    },
    update: async (id, patch) => {
      const r = rows.find((x) => x.id === id);
      if (r) Object.assign(r, patch);
    },
    publishToPlatform: async (platform, content, media) => {
      publishCalls++;
      publishArgs.push({ platform, content, media });
      if (opts?.platform) return await opts.platform(platform, content, media);
      return `ext_${platform}_${publishCalls}`;
    },
  };

  return {
    deps,
    rows,
    publishArgs,
    get publishCalls() {
      return publishCalls;
    },
  };
}

describe("socialPublisher — idempotency", () => {
  it("does not create a duplicate external post or row when the same content is published twice", async () => {
    const h = makeHarness();
    const first = await publishSocialPost(
      { platform: "facebook", content: "New heat pump install!", approved: true },
      h.deps,
    );
    const second = await publishSocialPost(
      { platform: "facebook", content: "New heat pump install!", approved: true },
      h.deps,
    );

    expect(first.status).toBe("posted");
    expect(first.alreadyPosted).toBe(false);
    expect(second.status).toBe("posted");
    expect(second.alreadyPosted).toBe(true); // short-circuited
    expect(second.postId).toBe(first.postId); // reused the same external id
    expect(h.publishCalls).toBe(1); // only ONE external call
    expect(h.rows).toHaveLength(1); // only ONE db row
  });

  it("reuses an existing scheduled row when publishing by id (scheduled idempotency)", async () => {
    const h = makeHarness();
    const id = await h.deps.create({
      platform: "facebook",
      content: "Scheduled tip",
      contentType: null,
      mediaUrls: null,
      status: "scheduled",
    });

    const r1 = await publishSocialPost({ id, platform: "facebook", content: "Scheduled tip" }, h.deps);
    const r2 = await publishSocialPost({ id, platform: "facebook", content: "Scheduled tip" }, h.deps);

    expect(r1.id).toBe(id);
    expect(r1.status).toBe("posted");
    expect(r2.alreadyPosted).toBe(true);
    expect(h.publishCalls).toBe(1);
    expect(h.rows).toHaveLength(1); // reused, never duplicated
  });
});

describe("socialPublisher — approval gate", () => {
  it("refuses to publish an unapproved post and writes no row", async () => {
    const h = makeHarness();
    await expect(
      publishSocialPost({ platform: "facebook", content: "Unapproved", approved: false }, h.deps),
    ).rejects.toMatchObject({ code: "NOT_APPROVED" });
    expect(h.publishCalls).toBe(0);
    expect(h.rows).toHaveLength(0);
  });

  it("treats an already-scheduled row as approved", async () => {
    const h = makeHarness();
    const id = await h.deps.create({
      platform: "facebook",
      content: "Scheduled + approved",
      contentType: null,
      mediaUrls: null,
      status: "scheduled",
    });
    const r = await publishSocialPost({ id, platform: "facebook", content: "Scheduled + approved" }, h.deps);
    expect(r.status).toBe("posted");
  });
});

describe("socialPublisher — failure persistence & retry", () => {
  it("persists status=failed with a safe error message and throws PUBLISH_FAILED", async () => {
    const h = makeHarness({
      platform: async () => {
        throw new Error("Facebook API error: {\"code\":190,\"message\":\"token expired\"}\nstack line");
      },
    });

    await expect(
      publishSocialPost({ platform: "facebook", content: "Will fail", approved: true }, h.deps),
    ).rejects.toBeInstanceOf(PublishError);

    expect(h.rows).toHaveLength(1);
    expect(h.rows[0].status).toBe("failed");
    const err = (h.rows[0] as any).errorMessage as string;
    expect(err).toContain("token expired");
    expect(err).not.toContain("\n"); // single-line, safe to persist
  });

  it("retries a failed post successfully on the SAME row (no duplicate)", async () => {
    let mode: "fail" | "ok" = "fail";
    const h = makeHarness({
      platform: async () => {
        if (mode === "fail") throw new Error("temporary network error");
        return "ext_ok_1";
      },
    });

    await expect(
      publishSocialPost({ platform: "facebook", content: "Retry me", approved: true }, h.deps),
    ).rejects.toBeInstanceOf(PublishError);
    expect(h.rows[0].status).toBe("failed");
    const failedId = h.rows[0].id;

    mode = "ok";
    const retried = await retrySocialPost(failedId, h.deps);

    expect(retried.status).toBe("posted");
    expect(retried.id).toBe(failedId); // same row
    expect(retried.postId).toBe("ext_ok_1");
    expect(h.rows).toHaveLength(1); // no duplicate row
  });

  it("retry of an already-posted row is idempotent (no second external post)", async () => {
    const h = makeHarness();
    const r = await publishSocialPost(
      { platform: "facebook", content: "Once", approved: true },
      h.deps,
    );
    const callsBefore = h.publishCalls;

    const retried = await retrySocialPost(r.id, h.deps);
    expect(retried.alreadyPosted).toBe(true);
    expect(retried.status).toBe("posted");
    expect(h.publishCalls).toBe(callsBefore); // unchanged
    expect(h.rows).toHaveLength(1);
  });

  it("rejects retry of a non-failed (draft/scheduled) post", async () => {
    const h = makeHarness();
    const id = await h.deps.create({
      platform: "facebook",
      content: "scheduled",
      contentType: null,
      mediaUrls: null,
      status: "scheduled",
    });
    await expect(retrySocialPost(id, h.deps)).rejects.toMatchObject({ code: "NOT_RETRYABLE" });
  });
});

describe("socialPublisher — partial platform failure", () => {
  it("one platform failing does not affect the other", async () => {
    const h = makeHarness({
      platform: async (platform) => {
        if (platform === "instagram") throw new Error("instagram rejected the image");
        return `ext_${platform}`;
      },
    });

    const fb = await publishSocialPost(
      { platform: "facebook", content: "Cross-post", mediaUrls: ["https://img/1.jpg"], approved: true },
      h.deps,
    );
    await expect(
      publishSocialPost(
        { platform: "instagram", content: "Cross-post", mediaUrls: ["https://img/1.jpg"], approved: true },
        h.deps,
      ),
    ).rejects.toBeInstanceOf(PublishError);

    expect(fb.status).toBe("posted");
    const igRow = h.rows.find((r) => r.platform === "instagram")!;
    const fbRow = h.rows.find((r) => r.platform === "facebook")!;
    expect(fbRow.status).toBe("posted");
    expect(igRow.status).toBe("failed");
  });
});

describe("socialPublisher — non-API channels (Nextdoor)", () => {
  it("queues a Nextdoor post for manual posting and never marks it posted", async () => {
    const h = makeHarness();
    const r = await publishSocialPost(
      { platform: "nextdoor", content: "Neighborhood update", approved: true },
      h.deps,
    );

    expect(r.status).toBe("queued");
    expect(r.queued).toBe(true);
    expect(r.status).not.toBe("posted");
    expect(r.postId).toBeNull();
    expect(h.publishCalls).toBe(0); // no fake API call
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0].status).toBe("scheduled"); // queued row actually persisted
  });

  it("isApiPublishable classifies channels correctly", () => {
    expect(isApiPublishable("facebook")).toBe(true);
    expect(isApiPublishable("instagram")).toBe(true);
    expect(isApiPublishable("google_business")).toBe(true);
    expect(isApiPublishable("nextdoor")).toBe(false);
  });
});

describe("safeErrorMessage", () => {
  it("flattens multi-line errors and bounds length", () => {
    const msg = safeErrorMessage(new Error("line1\nline2   with   spaces"));
    expect(msg).toBe("line1 line2 with spaces");
    const long = safeErrorMessage("x".repeat(1000), 50);
    expect(long.length).toBeLessThanOrEqual(50);
    expect(long.endsWith("…")).toBe(true);
  });

  it("never throws on non-Error values", () => {
    expect(safeErrorMessage(undefined)).toBe("Unknown error");
    expect(safeErrorMessage({ a: 1 })).toContain("a");
  });
});

import { describe, it, expect } from "vitest";
import {
  scheduleForHold,
  processDueHolds,
  vetoPost,
  revertPost,
  buildVetoLink,
  buildRevertLink,
  GuardrailBlockedError,
  SocialActionAlreadyHandledError,
  type HoldRepoDeps,
  type HoldablePostRow,
} from "./holdAndPublish";
import { MockSocialPlatformClient } from "./platformClient";
import type { PublisherDeps, SocialPostRow } from "../socialPublisher";

// The Social Lane veto/revert links reuse actionLinks.ts's HMAC secret.
process.env.SEO_ACTION_LINK_SECRET ||= "test-secret-for-social-lane-tests";

/** One shared in-memory store, exposed as BOTH a HoldRepoDeps and a PublisherDeps
 * (mirroring how the real DB row backs both server/services/social/repo.ts and
 * server/services/socialPublisher.ts). */
function makeSharedHarness() {
  const rows: Array<HoldablePostRow & { errorMessage?: string | null }> = [];
  let seq = 0;

  const holdRepo: HoldRepoDeps = {
    create: async (row) => {
      const id = ++seq;
      rows.push({ id, platform: row.platform, content: row.content, status: "draft", postId: null, mediaUrls: row.mediaUrls, holdUntil: null });
      return id;
    },
    getById: async (id) => rows.find((r) => r.id === id) ?? null,
    setHeld: async (id, holdUntil) => {
      const r = rows.find((x) => x.id === id);
      if (r) { r.status = "held"; r.holdUntil = holdUntil; }
    },
    setVetoed: async (id) => {
      const r = rows.find((x) => x.id === id);
      if (r) r.status = "vetoed";
    },
    setReverted: async (id) => {
      const r = rows.find((x) => x.id === id);
      if (r) r.status = "reverted";
    },
    listDueHeld: async (now) => rows.filter((r) => r.status === "held" && r.holdUntil && r.holdUntil <= now),
  };

  const publisherDeps: PublisherDeps = {
    getById: async (id) => {
      const r = rows.find((x) => x.id === id);
      return r ? (r as unknown as SocialPostRow) : null;
    },
    findReusable: async () => null,
    create: async () => {
      throw new Error("not used in this harness — rows are created via scheduleForHold");
    },
    update: async (id, patch) => {
      const r = rows.find((x) => x.id === id);
      if (r) Object.assign(r, patch);
    },
    publishToPlatform: async (platform, content, mediaUrls) => {
      return client.publish(platform as any, content, mediaUrls);
    },
  };

  const client = new MockSocialPlatformClient();

  return { rows, holdRepo, publisherDeps, client };
}

describe("Social Lane — hold → publish (no veto)", () => {
  it("does not publish before the hold window elapses", async () => {
    const h = makeSharedHarness();
    const { id, holdUntil } = await scheduleForHold({ platform: "facebook", content: "Ask about our 10-Year Parts & Labor Coverage." }, h.holdRepo, new Date("2026-01-01T00:00:00Z"), 12);
    expect(h.rows.find((r) => r.id === id)?.status).toBe("held");

    const results = await processDueHolds(h.holdRepo, h.publisherDeps, new Date("2026-01-01T05:00:00Z")); // before holdUntil
    expect(results).toHaveLength(0);
    expect(h.rows.find((r) => r.id === id)?.status).toBe("held");
    expect(holdUntil.toISOString()).toBe("2026-01-01T12:00:00.000Z");
  });

  it("publishes via the platform client once the hold window elapses", async () => {
    const h = makeSharedHarness();
    const { id } = await scheduleForHold({ platform: "facebook", content: "Ask about our 10-Year Parts & Labor Coverage." }, h.holdRepo, new Date("2026-01-01T00:00:00Z"), 12);

    const results = await processDueHolds(h.holdRepo, h.publisherDeps, new Date("2026-01-01T12:00:01Z"));
    expect(results).toEqual([{ id, outcome: "published" }]);
    const row = h.rows.find((r) => r.id === id)!;
    expect(row.status).toBe("posted");
    expect(row.postId).toMatch(/^mock_facebook_/);
    expect(h.client.published.has(row.postId!)).toBe(true);
  });

  it("blocks guardrail-failing content before any row is created", async () => {
    const h = makeSharedHarness();
    await expect(
      scheduleForHold({ platform: "facebook", content: "We're the #1 HVAC company — call John Smith at (555) 000-1111!" }, h.holdRepo),
    ).rejects.toBeInstanceOf(GuardrailBlockedError);
    expect(h.rows).toHaveLength(0);
  });
});

describe("Social Lane — veto", () => {
  it("a vetoed post never gets published even after the hold window elapses", async () => {
    const h = makeSharedHarness();
    const { id } = await scheduleForHold({ platform: "facebook", content: "Ask about our 10-Year Parts & Labor Coverage." }, h.holdRepo, new Date("2026-01-01T00:00:00Z"), 12);

    const link = buildVetoLink("https://mechanicalenterprise.com", id);
    const token = new URL(link).searchParams.get("token")!;
    const vetoResult = await vetoPost(token, h.holdRepo);
    expect(vetoResult.id).toBe(id);
    expect(h.rows.find((r) => r.id === id)?.status).toBe("vetoed");

    const results = await processDueHolds(h.holdRepo, h.publisherDeps, new Date("2026-01-01T12:00:01Z"));
    expect(results).toHaveLength(0); // no longer "held" — listDueHeld excludes it
    expect(h.client.published.size).toBe(0);
  });

  it("vetoing an already-posted post is a no-op error, not a silent success", async () => {
    const h = makeSharedHarness();
    const { id } = await scheduleForHold({ platform: "facebook", content: "Ask about our 10-Year Parts & Labor Coverage." }, h.holdRepo, new Date("2026-01-01T00:00:00Z"), 12);
    await processDueHolds(h.holdRepo, h.publisherDeps, new Date("2026-01-01T12:00:01Z"));

    const link = buildVetoLink("https://mechanicalenterprise.com", id);
    const token = new URL(link).searchParams.get("token")!;
    await expect(vetoPost(token, h.holdRepo)).rejects.toBeInstanceOf(SocialActionAlreadyHandledError);
  });
});

describe("Social Lane — revert", () => {
  it("reverts a posted post: deletes on the platform client and marks the row reverted", async () => {
    const h = makeSharedHarness();
    const { id } = await scheduleForHold({ platform: "facebook", content: "Ask about our 10-Year Parts & Labor Coverage." }, h.holdRepo, new Date("2026-01-01T00:00:00Z"), 12);
    await processDueHolds(h.holdRepo, h.publisherDeps, new Date("2026-01-01T12:00:01Z"));
    const row = h.rows.find((r) => r.id === id)!;
    expect(h.client.published.has(row.postId!)).toBe(true);

    const link = buildRevertLink("https://mechanicalenterprise.com", id);
    const token = new URL(link).searchParams.get("token")!;
    const revertResult = await revertPost(token, h.holdRepo, h.client);

    expect(revertResult.id).toBe(id);
    expect(h.rows.find((r) => r.id === id)?.status).toBe("reverted");
    expect(h.client.deleted.has(row.postId!)).toBe(true);
    expect(h.client.published.has(row.postId!)).toBe(false); // actually deleted, not just marked
  });

  it("reverting a held (never-posted) post is rejected", async () => {
    const h = makeSharedHarness();
    const { id } = await scheduleForHold({ platform: "facebook", content: "Ask about our 10-Year Parts & Labor Coverage." }, h.holdRepo, new Date("2026-01-01T00:00:00Z"), 12);
    const link = buildRevertLink("https://mechanicalenterprise.com", id);
    const token = new URL(link).searchParams.get("token")!;
    await expect(revertPost(token, h.holdRepo, h.client)).rejects.toBeInstanceOf(SocialActionAlreadyHandledError);
  });
});

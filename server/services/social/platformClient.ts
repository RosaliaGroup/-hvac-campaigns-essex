/**
 * Social Lane — platform seam (docs/social-lane-spec.md, owner build
 * instruction #1).
 *
 * Every outbound call to a real platform (Facebook/Instagram publish+delete,
 * GBP local-post create+delete, a Meta ads boost) goes through this
 * interface. There are two concrete implementations:
 *
 *  - `MockSocialPlatformClient` — pure in-memory, used whenever live
 *    credentials aren't present or `SOCIAL_LANE_ENABLED` is false. Lets the
 *    full hold → veto → publish → revert round-trip be exercised end-to-end
 *    in tests without any network access or real credentials.
 *  - `RealSocialPlatformClient` — wraps the existing platform integrations
 *    (server/integrations/facebook.ts, server/integrations/google-business.ts)
 *    and server/metaAds.ts for the boost call.
 *
 * `resolveSocialPlatformClient()` is the ONLY place that decides mock vs
 * real, and it decides PER PLATFORM: a platform only ever gets the real
 * client when BOTH its `aiVaCredentials` row is present+active AND
 * `SOCIAL_LANE_ENABLED=true`. Absent either, that platform always gets the
 * mock client — never a silent fail-open to a real API call (owner
 * instruction #6).
 */
import * as dbModule from "../../db";
import { postToFacebook, postToInstagram, deleteFacebookPost, deleteInstagramPost } from "../../integrations/facebook";
import { postToGoogleBusiness, deleteGoogleBusinessPost } from "../../integrations/google-business";
import { boostPost as metaBoostPost } from "../../metaAds";

export type SocialPlatform = "facebook" | "instagram" | "google_business";

export interface BoostParams {
  platform: SocialPlatform;
  postId: string;
  dailyBudgetCents: number;
  objective: "leads" | "traffic";
  targetCounties: string[];
  destinationUrl: string;
}

export interface BoostResult {
  externalCampaignId: string;
  spendCents: number;
}

/** The seam every social publish/delete/boost call goes through. */
export interface SocialPlatformClient {
  readonly mode: "mock" | "real";
  publish(platform: SocialPlatform, content: string, mediaUrls?: string[]): Promise<string>;
  deletePost(platform: SocialPlatform, externalPostId: string): Promise<void>;
  boost(params: BoostParams): Promise<BoostResult>;
}

/* ── Mock implementation ──────────────────────────────────────────────── */

/**
 * Fully in-memory. Deterministic ids, tracks published/deleted/boosted state
 * so tests can assert the full round-trip (including that revert really
 * "deletes" the mock post).
 */
export class MockSocialPlatformClient implements SocialPlatformClient {
  readonly mode = "mock" as const;
  private seq = 0;
  readonly published = new Map<string, { platform: SocialPlatform; content: string; mediaUrls?: string[] }>();
  readonly deleted = new Set<string>();
  readonly boosts: BoostParams[] = [];

  async publish(platform: SocialPlatform, content: string, mediaUrls?: string[]): Promise<string> {
    const id = `mock_${platform}_${++this.seq}`;
    this.published.set(id, { platform, content, mediaUrls });
    return id;
  }

  async deletePost(platform: SocialPlatform, externalPostId: string): Promise<void> {
    if (!this.published.has(externalPostId)) {
      throw new Error(`MockSocialPlatformClient: unknown post id "${externalPostId}" for ${platform}`);
    }
    this.deleted.add(externalPostId);
    this.published.delete(externalPostId);
  }

  async boost(params: BoostParams): Promise<BoostResult> {
    this.boosts.push(params);
    return { externalCampaignId: `mock_boost_${++this.seq}`, spendCents: params.dailyBudgetCents };
  }
}

/* ── Real implementation ──────────────────────────────────────────────── */

/** Resolve stored credentials for a platform, same lookup socialPublisher.ts uses. */
async function credsFor(platform: SocialPlatform) {
  const service = platform === "instagram" ? "facebook" : platform;
  const cred = await dbModule.getAiVaCredentials(service);
  return cred as Record<string, string> | undefined;
}

export class RealSocialPlatformClient implements SocialPlatformClient {
  readonly mode = "real" as const;

  async publish(platform: SocialPlatform, content: string, mediaUrls?: string[]): Promise<string> {
    const cred = await credsFor(platform);
    if (!cred?.accessToken) throw new Error(`No credentials saved for ${platform}. Please configure in AI VA Settings.`);

    if (platform === "google_business") {
      return await postToGoogleBusiness({ accessToken: cred.accessToken, accountId: cred.accountId, locationId: cred.locationId }, content, mediaUrls);
    }
    if (platform === "facebook") {
      return await postToFacebook({ accessToken: cred.accessToken, pageId: cred.pageId, instagramAccountId: cred.instagramAccountId }, content, mediaUrls?.[0]);
    }
    if (!mediaUrls?.[0]) throw new Error("Instagram posts require an image URL");
    return await postToInstagram({ accessToken: cred.accessToken, pageId: cred.pageId, instagramAccountId: cred.instagramAccountId }, content, mediaUrls[0]);
  }

  async deletePost(platform: SocialPlatform, externalPostId: string): Promise<void> {
    const cred = await credsFor(platform);
    if (!cred?.accessToken) throw new Error(`No credentials saved for ${platform}. Please configure in AI VA Settings.`);

    if (platform === "google_business") {
      await deleteGoogleBusinessPost({ accessToken: cred.accessToken, accountId: cred.accountId, locationId: cred.locationId }, externalPostId);
      return;
    }
    if (platform === "facebook") {
      await deleteFacebookPost({ accessToken: cred.accessToken, pageId: cred.pageId }, externalPostId);
      return;
    }
    await deleteInstagramPost({ accessToken: cred.accessToken, pageId: cred.pageId }, externalPostId);
  }

  async boost(params: BoostParams): Promise<BoostResult> {
    // Reuses the existing metaAds router's boost primitive (server/metaAds.ts).
    // GBP has no boost concept; callers only invoke this for facebook/instagram.
    return await metaBoostPost(params);
  }
}

/* ── Resolution: the ONLY place that picks mock vs real, per platform ──── */

export function isSocialLaneEnabled(): boolean {
  return String(process.env.SOCIAL_LANE_ENABLED ?? "false").toLowerCase() === "true";
}

/** Is this platform's aiVaCredentials row present and active (isActive=1, has an accessToken)? */
export async function isPlatformCredentialed(platform: SocialPlatform): Promise<boolean> {
  const cred = await credsFor(platform);
  return !!cred?.accessToken;
}

/**
 * A single client whose `publish`/`deletePost`/`boost` decide mock-vs-real
 * PER CALL based on the platform argument — so a mixed FB(real)/IG(mock)
 * state (e.g. mid-rollout) never silently does the wrong thing for either.
 */
export function makeGatedSocialPlatformClient(
  real: SocialPlatformClient = new RealSocialPlatformClient(),
  mock: SocialPlatformClient = new MockSocialPlatformClient(),
): SocialPlatformClient {
  async function pick(platform: SocialPlatform): Promise<SocialPlatformClient> {
    if (isSocialLaneEnabled() && (await isPlatformCredentialed(platform))) return real;
    return mock;
  }
  return {
    mode: "real", // nominal; actual per-call mode is decided dynamically
    async publish(platform, content, mediaUrls) {
      return (await pick(platform)).publish(platform, content, mediaUrls);
    },
    async deletePost(platform, externalPostId) {
      return (await pick(platform)).deletePost(platform, externalPostId);
    },
    async boost(params) {
      return (await pick(params.platform)).boost(params);
    },
  };
}

/**
 * Facebook/Instagram Integration (Meta Graph API)
 * Handles posting to Facebook Pages and Instagram Business accounts
 *
 * NOTE: these functions are pure API callers — they DO NOT write to the
 * database. Persistence (and idempotency / failure handling) is owned by
 * server/services/socialPublisher.ts, which is the single writer of
 * socialPosts rows. Each publish function returns the external post id.
 */

export interface FacebookCredentials {
  accessToken: string;
  pageId: string;
  instagramAccountId?: string;
}

/**
 * Post to Facebook Page
 */
export async function postToFacebook(
  credentials: FacebookCredentials,
  content: string,
  imageUrl?: string
) {
  const { accessToken, pageId } = credentials;

  if (!accessToken || !pageId) {
    throw new Error("Missing Facebook credentials");
  }

  // An image file is posted as a photo (shows the picture with the text as its caption). Any other URL is
  // posted as a link post. Before Oct 31, 2026 an image URL was sent as `link`, which published a bare
  // link to the .png instead of the picture.
  // A video file (.mp4/.mov) is uploaded to the Page as a video post (Nov 12, 2026).
  if (imageUrl && /\.(mp4|mov)(\?|$)/i.test(imageUrl)) {
    const vr = await fetch(`https://graph-video.facebook.com/v18.0/${pageId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_url: imageUrl, description: content, access_token: accessToken }),
    });
    if (!vr.ok) throw new Error(`Facebook API error: ${JSON.stringify(await vr.json().catch(() => ({})))}`);
    const v = await vr.json();
    console.log("[Facebook] Video published:", v.id);
    return String(v.id) as string;
  }

  const isImage = !!imageUrl && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(imageUrl);
  const url = `https://graph.facebook.com/v18.0/${pageId}/${isImage ? "photos" : "feed"}`;

  const body: any = isImage
    ? { url: imageUrl, caption: content, access_token: accessToken }
    : { message: content, access_token: accessToken, ...(imageUrl ? { link: imageUrl } : {}) };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Facebook API error: ${JSON.stringify(error)}`);
  }

  // A photo returns { id: <photo id>, post_id: <page>_<post> }; the feed post id is what boosting and
  // deleting the Page post use.
  const data = await response.json();
  if (data.post_id) data.id = data.post_id;

  console.log("[Facebook] Post published:", data.id);
  return String(data.id) as string;
}

/** True for a video file URL (published to Instagram as a Reel). */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov)(\?|$)/i.test(url);
}

/**
 * Instagram's API accepts JPEG images only. PNG/WebP images hosted on our own
 * site are converted on the fly by Netlify's image CDN (fm=jpg). Other hosts
 * are passed through unchanged (Instagram may reject them).
 */
export function toInstagramImageUrl(url: string): string {
  if (/\.jpe?g(\?|$)/i.test(url)) return url;
  const m = url.match(/^https:\/\/(?:www\.)?mechanicalenterprise\.com(\/[^?#]*)/i);
  if (!m) return url;
  return `https://mechanicalenterprise.com/.netlify/images?url=${encodeURIComponent(m[1])}&fm=jpg&q=90`;
}

const GRAPH = "https://graph.facebook.com/v18.0";

async function graphPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Instagram API error (${path.split("/").pop()}): ${JSON.stringify(data)}`);
  return data as { id?: string };
}

/**
 * Wait until an Instagram media container is ready to publish. Videos (Reels)
 * are processed asynchronously; images are usually FINISHED immediately.
 */
export async function waitForInstagramContainer(
  creationId: string,
  accessToken: string,
  opts: { timeoutMs?: number; intervalMs?: number; fetchFn?: typeof fetch } = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;
  const intervalMs = opts.intervalMs ?? 5000;
  const f = opts.fetchFn ?? fetch;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await f(`${GRAPH}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`);
    const data = (await res.json().catch(() => ({}))) as { status_code?: string; status?: string };
    if (data.status_code === "FINISHED" || data.status_code === "PUBLISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(`Instagram media processing ${data.status_code}: ${data.status ?? "no detail"}`);
    }
    if (Date.now() + intervalMs > deadline) {
      throw new Error(`Instagram media still ${data.status_code ?? "processing"} after ${Math.round(timeoutMs / 1000)}s`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/**
 * Post to Instagram Business account. A video URL (.mp4/.mov) is published as
 * a Reel (also shown in the main feed); anything else as a single photo.
 */
export async function postToInstagram(
  credentials: FacebookCredentials,
  content: string,
  mediaUrl: string
) {
  const { accessToken, instagramAccountId } = credentials;

  if (!accessToken || !instagramAccountId) {
    throw new Error("Missing Instagram credentials");
  }

  // Step 1: create the media container.
  const reel = isVideoUrl(mediaUrl);
  const container = await graphPost(`${instagramAccountId}/media`, reel
    ? { media_type: "REELS", video_url: mediaUrl, caption: content, share_to_feed: true, access_token: accessToken }
    : { image_url: toInstagramImageUrl(mediaUrl), caption: content, access_token: accessToken });
  if (!container.id) throw new Error("Instagram container error: no id returned");

  // Step 2: wait for processing (Reels take a while), then publish.
  await waitForInstagramContainer(container.id, accessToken);
  const data = await graphPost(`${instagramAccountId}/media_publish`, {
    creation_id: container.id,
    access_token: accessToken,
  });

  console.log(`[Instagram] ${reel ? "Reel" : "Post"} published:`, data.id);
  return String(data.id) as string;
}

/**
 * Delete a Facebook post by its external id. Used by the marketing canary
 * cleanup to remove the visible test post. Returns void on success.
 */
export async function deleteFacebookPost(
  credentials: FacebookCredentials,
  postId: string
): Promise<void> {
  const { accessToken } = credentials;
  if (!accessToken) throw new Error("Missing Facebook credentials");

  const url = `https://graph.facebook.com/v18.0/${postId}?access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Facebook delete error: ${error}`);
  }
}

/**
 * Delete a published Instagram media object by its id (the value stored in
 * socialPosts.postId). Used by the Social Lane revert path (§7).
 *
 * CAVEAT: as of the Instagram Content Publishing API, Meta does not
 * generally support deleting an already-published IG media object via the
 * Graph API the way it supports Facebook post deletion — this call is
 * best-effort and may return an error from Meta even with valid
 * credentials. Callers should treat an Instagram revert failure as
 * "un-revertible via API" and fall back to the manual queue's "remove"
 * semantics (surface it to the owner rather than retrying indefinitely).
 */
export async function deleteInstagramPost(
  credentials: FacebookCredentials,
  mediaId: string
): Promise<void> {
  const { accessToken } = credentials;
  if (!accessToken) throw new Error("Missing Instagram credentials");

  const url = `https://graph.facebook.com/v18.0/${mediaId}?access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Instagram delete error (Meta does not guarantee delete support for published media): ${error}`);
  }
}

/**
 * Get Facebook Page insights
 */
export async function getFacebookInsights(
  credentials: FacebookCredentials,
  postId: string
) {
  const { accessToken } = credentials;

  const url = `https://graph.facebook.com/v18.0/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${accessToken}`;
  
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch Facebook insights");
  }

  const data = await response.json();
  
  return {
    likes: data.likes?.summary?.total_count || 0,
    comments: data.comments?.summary?.total_count || 0,
    shares: data.shares?.count || 0,
  };
}

/**
 * Respond to Facebook comment
 */
export async function replyToFacebookComment(
  credentials: FacebookCredentials,
  commentId: string,
  message: string
) {
  const { accessToken } = credentials;

  const url = `https://graph.facebook.com/v18.0/${commentId}/comments`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      access_token: accessToken,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Facebook comment error: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

/**
 * Facebook/Instagram Integration (Meta Graph API)
 * Handles posting to Facebook Pages and Instagram Business accounts
 */

import * as db from "../db";

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

  const url = `https://graph.facebook.com/v18.0/${pageId}/feed`;
  
  const body: any = {
    message: content,
    access_token: accessToken,
  };

  if (imageUrl) {
    body.link = imageUrl;
  }

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

  const data = await response.json();
  
  // Log post to database
  await db.createSocialPost({
    platform: "facebook",
    content,
    mediaUrls: imageUrl ? JSON.stringify([imageUrl]) : null,
    postedAt: new Date(),
    postId: data.id,
    status: "posted",
  });

  console.log("[Facebook] Post published:", data.id);
  return data;
}

/**
 * Post to Instagram Business account
 */
export async function postToInstagram(
  credentials: FacebookCredentials,
  content: string,
  imageUrl: string
) {
  const { accessToken, instagramAccountId } = credentials;

  if (!accessToken || !instagramAccountId) {
    throw new Error("Missing Instagram credentials");
  }

  // Instagram requires a two-step process: create media container, then publish

  // Step 1: Create media container
  const containerUrl = `https://graph.facebook.com/v18.0/${instagramAccountId}/media`;
  const containerResponse = await fetch(containerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: imageUrl,
      caption: content,
      access_token: accessToken,
    }),
  });

  if (!containerResponse.ok) {
    const error = await containerResponse.json();
    throw new Error(`Instagram container error: ${JSON.stringify(error)}`);
  }

  const containerData = await containerResponse.json();
  const creationId = containerData.id;

  // Step 2: Publish the container
  const publishUrl = `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`;
  const publishResponse = await fetch(publishUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: accessToken,
    }),
  });

  if (!publishResponse.ok) {
    const error = await publishResponse.json();
    throw new Error(`Instagram publish error: ${JSON.stringify(error)}`);
  }

  const data = await publishResponse.json();
  
  // Log post to database
  await db.createSocialPost({
    platform: "instagram",
    content,
    mediaUrls: JSON.stringify([imageUrl]),
    postedAt: new Date(),
    postId: data.id,
    status: "posted",
  });

  console.log("[Instagram] Post published:", data.id);
  return data;
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

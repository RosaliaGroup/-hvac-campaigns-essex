/**
 * Google Business Profile Integration
 * Handles posting updates, photos, and managing reviews
 *
 * NOTE: postToGoogleBusiness is a pure API caller and DOES NOT write to the
 * database. Persistence / idempotency / failure handling is owned by
 * server/services/socialPublisher.ts. It returns the external post id.
 */

export interface GoogleBusinessCredentials {
  accessToken: string;
  accountId: string;
  locationId: string;
}

/**
 * Post update to Google Business Profile
 */
export async function postToGoogleBusiness(
  credentials: GoogleBusinessCredentials,
  content: string,
  imageUrls?: string[]
) {
  const { accessToken, accountId, locationId } = credentials;

  if (!accessToken || !accountId || !locationId) {
    throw new Error("Missing Google Business credentials");
  }

  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`;
  
  const body: any = {
    languageCode: "en-US",
    summary: content,
    topicType: "STANDARD",
  };

  if (imageUrls && imageUrls.length > 0) {
    body.media = imageUrls.map((url) => ({
      mediaFormat: "PHOTO",
      sourceUrl: url,
    }));
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Business API error: ${error}`);
  }

  const data = await response.json();

  console.log("[Google Business] Post published:", data.name);
  return String(data.name) as string;
}

/**
 * Delete a Google Business local post by its resource name (the value stored in
 * socialPosts.postId, e.g. "accounts/.../localPosts/..."). Used by the canary
 * cleanup. Returns void on success.
 */
export async function deleteGoogleBusinessPost(
  credentials: GoogleBusinessCredentials,
  localPostName: string
): Promise<void> {
  const { accessToken } = credentials;
  if (!accessToken) throw new Error("Missing Google Business credentials");

  const url = `https://mybusiness.googleapis.com/v4/${localPostName}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Business delete error: ${error}`);
  }
}

/**
 * Get Google Business Profile reviews
 */
export async function getGoogleBusinessReviews(
  credentials: GoogleBusinessCredentials
) {
  const { accessToken, accountId, locationId } = credentials;

  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`;
  
  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Google Business reviews");
  }

  return await response.json();
}

/**
 * Reply to Google Business review
 */
export async function replyToGoogleBusinessReview(
  credentials: GoogleBusinessCredentials,
  reviewName: string,
  comment: string
) {
  const { accessToken } = credentials;

  const url = `https://mybusiness.googleapis.com/v4/${reviewName}/reply`;
  
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      comment,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Business reply error: ${error}`);
  }

  return await response.json();
}

/**
 * Upload photo to Google Business Profile
 */
export async function uploadPhotoToGoogleBusiness(
  credentials: GoogleBusinessCredentials,
  photoUrl: string,
  category: "PROFILE" | "LOGO" | "COVER" | "ADDITIONAL"
) {
  const { accessToken, accountId, locationId } = credentials;

  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      locationAssociation: {
        category,
      },
      sourceUrl: photoUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Business photo upload error: ${error}`);
  }

  return await response.json();
}

/**
 * HeyGen Personalized Video Integration
 * Generates personalized talking-head videos for HVAC leads using the HeyGen API.
 */

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY!;
const HEYGEN_BASE = "https://api.heygen.com";

// Default avatar and voice for HVAC sales context (professional, friendly, English)
export const DEFAULT_AVATAR_ID = "Adriana_Business_Front_public"; // Adriana Business Front
export const DEFAULT_VOICE_ID = "42d00d4aac5441279d8536cd6b52c53c"; // Hope - warm female English voice

export interface HeyGenVideoRequest {
  clientName: string;
  /** One of: rebates | financing | solar | assessment */
  topic: "rebates" | "financing" | "solar" | "assessment";
  /** Optional: estimated rebate amount to personalize the script */
  rebateAmount?: number;
  /** Optional: override avatar */
  avatarId?: string;
  /** Optional: override voice */
  voiceId?: string;
}

export interface HeyGenVideoStatus {
  videoId: string;
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

/**
 * Build a personalized script for the given topic.
 */
function buildScript(req: HeyGenVideoRequest): string {
  const name = req.clientName.split(" ")[0]; // First name only

  switch (req.topic) {
    case "rebates":
      return (
        `Hi ${name}, this is Ana from Mechanical Enterprise. ` +
        `I wanted to personally walk you through the NJ Clean Heat rebate program — ` +
        `because right now, New Jersey homeowners like you can get back up to ` +
        `${req.rebateAmount ? `$${req.rebateAmount.toLocaleString()}` : "$16,000"} ` +
        `in rebates when you upgrade to a high-efficiency heat pump system. ` +
        `That's money back in your pocket — and with zero-percent on-bill financing, ` +
        `your monthly payment can actually be less than your current heating bill. ` +
        `Click below to run your free rebate estimate, or call us at 862-419-1763. ` +
        `We'd love to help you take advantage of this before the program fills up.`
      );

    case "financing":
      return (
        `Hi ${name}, Ana here from Mechanical Enterprise. ` +
        `I wanted to explain how our zero-percent on-bill financing works — ` +
        `because it's one of the best-kept secrets in New Jersey right now. ` +
        `Through the NJ Clean Heat OBR program, you can finance your entire heat pump installation ` +
        `with no money down, no interest, and payments added directly to your PSE&G bill. ` +
        `For LMI-qualified homes, the term extends to 10 years, making monthly payments even lower. ` +
        `If you'd like to see your exact numbers, use our free Rebate Calculator on the site. ` +
        `We're here to make this as easy as possible for you.`
      );

    case "solar":
      return (
        `Hi ${name}, this is Ana from Mechanical Enterprise. ` +
        `I noticed you're interested in solar — and I wanted to share something exciting. ` +
        `When you pair a heat pump system with solar panels, the savings stack up fast. ` +
        `Most NJ homeowners save between $1,200 and $1,800 per year on energy costs, ` +
        `and the federal solar tax credit covers 30% of the installation cost. ` +
        `Combined with the NJ Clean Heat rebates, your payback period can be as short as 6 years. ` +
        `We'd love to put together a combined solar and heat pump proposal for your home. ` +
        `Book a free assessment and we'll run the full numbers for you.`
      );

    case "assessment":
      return (
        `Hi ${name}, Ana from Mechanical Enterprise here. ` +
        `Thank you so much for booking your free home assessment — we're really looking forward to meeting you. ` +
        `Our certified technician will evaluate your home's heating and cooling needs, ` +
        `identify every rebate and incentive you qualify for, ` +
        `and walk you through all four of our financing options — including zero-down OBR financing. ` +
        `There's absolutely no obligation, and the assessment is completely free. ` +
        `If you have any questions before your appointment, call us at 862-419-1763. ` +
        `See you soon!`
      );
  }
}

/**
 * Generate a personalized HeyGen video. Returns the video ID for polling.
 */
export async function generatePersonalizedVideo(req: HeyGenVideoRequest): Promise<string> {
  const script = buildScript(req);
  const avatarId = req.avatarId ?? DEFAULT_AVATAR_ID;
  const voiceId = req.voiceId ?? DEFAULT_VOICE_ID;

  const payload = {
    video_inputs: [
      {
        character: {
          type: "avatar",
          avatar_id: avatarId,
          avatar_style: "normal",
        },
        voice: {
          type: "text",
          input_text: script,
          voice_id: voiceId,
          speed: 1.0,
        },
        background: {
          type: "color",
          value: "#1e3a5f",
        },
      },
    ],
    dimension: {
      width: 1280,
      height: 720,
    },
    aspect_ratio: "16:9",
  };

  const res = await fetch(`${HEYGEN_BASE}/v2/video/generate`, {
    method: "POST",
    headers: {
      "X-Api-Key": HEYGEN_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HeyGen video generation failed: ${res.status} ${text}`);
  }

  const data = await res.json() as { data?: { video_id: string }; error?: string | null };
  if (data.error) throw new Error(`HeyGen error: ${data.error}`);
  if (!data.data?.video_id) throw new Error("HeyGen returned no video_id");

  return data.data.video_id;
}

/**
 * Poll the status of a HeyGen video generation job.
 */
export async function getVideoStatus(videoId: string): Promise<HeyGenVideoStatus> {
  const res = await fetch(`${HEYGEN_BASE}/v1/video_status.get?video_id=${videoId}`, {
    headers: {
      "X-Api-Key": HEYGEN_API_KEY,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    return { videoId, status: "failed", error: `HTTP ${res.status}` };
  }

  const data = await res.json() as {
    data?: {
      status: string;
      video_url?: string;
      thumbnail_url?: string;
      error?: string;
    };
    error?: string | null;
  };

  if (data.error) return { videoId, status: "failed", error: data.error };

  const d = data.data;
  if (!d) return { videoId, status: "failed", error: "No data returned" };

  const statusMap: Record<string, HeyGenVideoStatus["status"]> = {
    pending: "pending",
    processing: "processing",
    waiting: "pending",
    completed: "completed",
    failed: "failed",
  };

  return {
    videoId,
    status: statusMap[d.status] ?? "processing",
    videoUrl: d.video_url,
    thumbnailUrl: d.thumbnail_url,
    error: d.error,
  };
}

/**
 * List available avatars (non-premium only).
 */
export async function listAvatars() {
  const res = await fetch(`${HEYGEN_BASE}/v2/avatars`, {
    headers: { "X-Api-Key": HEYGEN_API_KEY },
  });
  const data = await res.json() as { data?: { avatars?: unknown[] } };
  return (data.data?.avatars ?? []) as Array<{
    avatar_id: string;
    avatar_name: string;
    gender: string;
    preview_image_url: string;
    preview_video_url: string;
    premium: boolean;
  }>;
}

/**
 * List available English voices.
 */
export async function listVoices() {
  const res = await fetch(`${HEYGEN_BASE}/v2/voices`, {
    headers: { "X-Api-Key": HEYGEN_API_KEY },
  });
  const data = await res.json() as { data?: { voices?: unknown[] } };
  const voices = (data.data?.voices ?? []) as Array<{
    voice_id: string;
    name: string;
    gender: string;
    language: string;
    preview_audio: string;
  }>;
  return voices.filter((v) => v.language?.toLowerCase().startsWith("english"));
}

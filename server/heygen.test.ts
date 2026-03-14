import { describe, it, expect } from "vitest";
import { listAvatars, listVoices, DEFAULT_AVATAR_ID, DEFAULT_VOICE_ID } from "./heygen";

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_BASE = "https://api.heygen.com";

describe("HeyGen API credentials", () => {
  it("should have HEYGEN_API_KEY set in environment", () => {
    expect(HEYGEN_API_KEY).toBeTruthy();
    expect(typeof HEYGEN_API_KEY).toBe("string");
    expect(HEYGEN_API_KEY!.length).toBeGreaterThan(10);
  });

  it("should successfully authenticate with HeyGen API and list avatars", async () => {
    const res = await fetch(`${HEYGEN_BASE}/v2/avatars`, {
      headers: {
        "X-Api-Key": HEYGEN_API_KEY!,
        "Content-Type": "application/json",
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json() as { data?: { avatars?: unknown[] }; error?: string | null };
    // HeyGen returns error: null on success (not undefined)
    expect(data.error ?? null).toBeNull();
    expect(data.data).toBeDefined();
    console.log(`[HeyGen] Available avatars: ${data.data?.avatars?.length ?? 0}`);
  }, 15000);

  it("should be able to list available voices", async () => {
    const res = await fetch(`${HEYGEN_BASE}/v2/voices`, {
      headers: {
        "X-Api-Key": HEYGEN_API_KEY!,
        "Content-Type": "application/json",
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json() as { data?: { voices?: unknown[] }; error?: string | null };
    // HeyGen returns error: null on success (not undefined)
    expect(data.error ?? null).toBeNull();
    console.log(`[HeyGen] Available voices: ${data.data?.voices?.length ?? 0}`);
  }, 15000);
});

describe("HeyGen helper module", () => {
  it("should export valid default avatar and voice IDs", () => {
    expect(typeof DEFAULT_AVATAR_ID).toBe("string");
    expect(DEFAULT_AVATAR_ID.length).toBeGreaterThan(0);
    expect(typeof DEFAULT_VOICE_ID).toBe("string");
    expect(DEFAULT_VOICE_ID.length).toBeGreaterThan(0);
  });

  it("should list avatars via helper and return an array", async () => {
    const avatars = await listAvatars();
    expect(Array.isArray(avatars)).toBe(true);
    expect(avatars.length).toBeGreaterThan(0);
    console.log(`[HeyGen] listAvatars returned ${avatars.length} avatars`);
  }, 15000);

  it("should list voices via helper and return an array", async () => {
    const voices = await listVoices();
    expect(Array.isArray(voices)).toBe(true);
    expect(voices.length).toBeGreaterThan(0);
    console.log(`[HeyGen] listVoices returned ${voices.length} voices`);
  }, 15000);

  it("should filter non-premium avatars", async () => {
    const avatars = await listAvatars();
    const nonPremium = avatars.filter((a) => !a.premium);
    // There should be at least some non-premium avatars
    expect(nonPremium.length).toBeGreaterThan(0);
    console.log(`[HeyGen] Non-premium avatars: ${nonPremium.length}`);
  }, 15000);
});

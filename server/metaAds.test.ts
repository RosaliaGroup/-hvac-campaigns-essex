import { describe, it, expect } from "vitest";
import "dotenv/config";

const META_API_VERSION = "v21.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

describe("Meta Ads API - token validation", () => {
  it("should have a META_ACCESS_TOKEN env var set", () => {
    expect(process.env.META_ACCESS_TOKEN).toBeTruthy();
    expect(process.env.META_ACCESS_TOKEN!.length).toBeGreaterThan(20);
  });

  it("should successfully call the /me endpoint with the token", async () => {
    const token = process.env.META_ACCESS_TOKEN!;
    const qs = new URLSearchParams({ access_token: token, fields: "id,name" });
    const res = await fetch(`${META_BASE}/me?${qs}`);
    const json = await res.json() as { id?: string; name?: string; error?: { message: string } };

    expect(json.error).toBeUndefined();
    expect(json.id).toBeTruthy();
    console.log(`✅ Meta token valid — user: ${json.name} (id: ${json.id})`);
  }, 15000);
});

/**
 * Telnyx credentials validation test
 * Verifies the API key is valid by fetching account balance
 */
import { describe, it, expect } from "vitest";

// Live smoke test — hits the real Telnyx API. Only runs when credentials are
// present (e.g. locally / CI with secrets). Skipped in the default suite so a
// dev machine without keys or network does not fail the regression run.
const hasLiveCreds = Boolean(process.env.TELNYX_API_KEY && process.env.TELNYX_FROM_NUMBER);

describe.skipIf(!hasLiveCreds)("Telnyx credentials (live)", () => {
  it("should have TELNYX_API_KEY set", () => {
    expect(process.env.TELNYX_API_KEY).toBeTruthy();
    expect(process.env.TELNYX_API_KEY).toMatch(/^KEY/);
  });

  it("should have TELNYX_FROM_NUMBER set in E.164 format", () => {
    expect(process.env.TELNYX_FROM_NUMBER).toBeTruthy();
    expect(process.env.TELNYX_FROM_NUMBER).toMatch(/^\+1\d{10}$/);
  });

  it("should successfully authenticate with Telnyx API", async () => {
    const apiKey = process.env.TELNYX_API_KEY;
    const res = await fetch("https://api.telnyx.com/v2/balance", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { data: { balance: string } };
    expect(data.data).toBeDefined();
    expect(data.data.balance).toBeDefined();
    console.log(`[Telnyx] Account balance: $${data.data.balance}`);
  }, 15000);
});

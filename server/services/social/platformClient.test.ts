import { describe, it, expect } from "vitest";
import { MockSocialPlatformClient } from "./platformClient";

describe("MockSocialPlatformClient", () => {
  it("publishes and tracks the post, then really removes it on delete", async () => {
    const client = new MockSocialPlatformClient();
    const id = await client.publish("facebook", "hello world", ["https://img/1.jpg"]);
    expect(client.published.has(id)).toBe(true);

    await client.deletePost("facebook", id);
    expect(client.published.has(id)).toBe(false);
    expect(client.deleted.has(id)).toBe(true);
  });

  it("throws on deleting an unknown post id (no silent success)", async () => {
    const client = new MockSocialPlatformClient();
    await expect(client.deletePost("facebook", "does-not-exist")).rejects.toThrow();
  });

  it("records boost calls", async () => {
    const client = new MockSocialPlatformClient();
    const id = await client.publish("facebook", "hello");
    const result = await client.boost({ platform: "facebook", postId: id, dailyBudgetCents: 1000, objective: "leads", targetCounties: ["Essex"], destinationUrl: "https://x.com" });
    expect(result.spendCents).toBe(1000);
    expect(client.boosts).toHaveLength(1);
  });
});

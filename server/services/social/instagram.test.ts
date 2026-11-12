import { existsSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  REEL_CALENDAR,
  REEL_PHOTO_CREDITS,
  dueReels,
  isImageUrl,
  socialRuleViolation,
  toInstagramCaption,
} from "./instagram";
import { isVideoUrl, toInstagramImageUrl, waitForInstagramContainer } from "../../integrations/facebook";

describe("instagram — content rules", () => {
  it("blocks rebate, 24/7, same-day and price wording", () => {
    expect(socialRuleViolation("Up to $16,000 in NJ heat pump rebates")).toBeTruthy();
    expect(socialRuleViolation("We're available 24/7")).toBe("24/7");
    expect(socialRuleViolation("Same-day installs")).toBeTruthy();
    expect(socialRuleViolation("Ask about PSE&G on-bill repayment")).toBeTruthy();
    expect(socialRuleViolation("Premium HVAC, honestly priced.")).toBeNull();
  });

  it("every calendar Reel caption passes the rules and has a rendered video", () => {
    const dir = join(__dirname, "../../../client/public/reels");
    for (const r of REEL_CALENDAR) {
      expect(socialRuleViolation(r.caption), r.slug).toBeNull();
      expect(r.caption.length).toBeLessThanOrEqual(2200);
      const file = r.videoUrl ? join(__dirname, "../../../client/public", new URL(r.videoUrl).pathname) : join(dir, `${r.slug}.mp4`);
      expect(existsSync(file), file).toBe(true);
      if (r.facebookCaption) expect(socialRuleViolation(r.facebookCaption), `${r.slug} fb`).toBeNull();
      expect(r.caption, `${r.slug} photo credit`).toContain("📷 Equipment photos:");
      expect(REEL_PHOTO_CREDITS[r.slug], r.slug).toBeTruthy();
    }
  });
});

describe("instagram — captions", () => {
  it("drops links, adds the call/text CTA and hashtags", () => {
    const c = toInstagramCaption("Old furnace? We replace it right.\n\nLearn more: https://mechanicalenterprise.com/contact?utm_source=fb");
    expect(c).not.toContain("http");
    expect(c).not.toMatch(/Learn more/i);
    expect(c).toContain("(862) 419-1763");
    expect(c).toContain("(551) 600-7027");
    expect(c).toContain("link in our bio");
    expect(c).toMatch(/#NJHVAC/);
  });

  it("is idempotent in shape (no double CTA)", () => {
    const once = toInstagramCaption("Hello");
    expect(toInstagramCaption(once)).toBe(once);
  });
});

describe("instagram — media", () => {
  it("routes videos as Reels and converts our PNGs to JPEG", () => {
    expect(isVideoUrl("https://mechanicalenterprise.com/reels/done-right.mp4")).toBe(true);
    expect(isVideoUrl("https://mechanicalenterprise.com/x.png")).toBe(false);
    expect(toInstagramImageUrl("https://mechanicalenterprise.com/fb-ad-nj-homeowners.png")).toBe(
      "https://mechanicalenterprise.com/.netlify/images?url=%2Ffb-ad-nj-homeowners.png&fm=jpg&q=90",
    );
    expect(toInstagramImageUrl("https://mechanicalenterprise.com/a.jpg")).toBe("https://mechanicalenterprise.com/a.jpg");
    expect(toInstagramImageUrl("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
    expect(isImageUrl("https://x/y.webp")).toBe(true);
    expect(isImageUrl(undefined)).toBe(false);
  });

  it("waits for the container to finish, and surfaces processing errors", async () => {
    const seq = ["IN_PROGRESS", "IN_PROGRESS", "FINISHED"];
    const okFetch = (async () => ({ json: async () => ({ status_code: seq.shift() }) })) as unknown as typeof fetch;
    await expect(waitForInstagramContainer("c1", "tok", { intervalMs: 1, fetchFn: okFetch })).resolves.toBeUndefined();

    const errFetch = (async () => ({ json: async () => ({ status_code: "ERROR", status: "bad video" }) })) as unknown as typeof fetch;
    await expect(waitForInstagramContainer("c1", "tok", { intervalMs: 1, fetchFn: errFetch })).rejects.toThrow(/ERROR/);

    const slowFetch = (async () => ({ json: async () => ({ status_code: "IN_PROGRESS" }) })) as unknown as typeof fetch;
    await expect(waitForInstagramContainer("c1", "tok", { intervalMs: 1, timeoutMs: 5, fetchFn: slowFetch })).rejects.toThrow(/still/);
  });
});

describe("instagram — reel calendar", () => {
  it("posts only entries that are due within the grace window", () => {
    const cal = [
      { slug: "a", publishAt: "2026-11-12T23:30:00Z", caption: "a" },
      { slug: "b", publishAt: "2026-11-17T23:30:00Z", caption: "b" },
    ];
    expect(dueReels(new Date("2026-11-12T23:00:00Z"), cal)).toEqual([]);
    expect(dueReels(new Date("2026-11-12T23:35:00Z"), cal).map((r) => r.slug)).toEqual(["a"]);
    // 2 days late → skipped (no backlog dump after downtime)
    expect(dueReels(new Date("2026-11-14T23:35:00Z"), cal)).toEqual([]);
  });

  it("calendar is in order and on Tue/Thu evenings New York time", () => {
    let prev = 0;
    // Campaign launches (videoUrl set, e.g. Warm & Safe) post when the owner says go.
    for (const r of REEL_CALENDAR.filter((e) => !e.videoUrl)) {
      const t = Date.parse(r.publishAt);
      expect(t).toBeGreaterThan(prev);
      prev = t;
      const ny = new Date(t).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" });
      expect(ny).toMatch(/^(Tue|Thu),? 6:30 PM$/);
    }
  });
});

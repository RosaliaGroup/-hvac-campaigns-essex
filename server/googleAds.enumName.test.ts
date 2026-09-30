import { describe, it, expect, vi } from "vitest";

vi.mock("./db", () => ({ getAiVaCredentials: vi.fn(async () => ({})) }));

import { enums } from "google-ads-api";
import { enumName } from "./googleAds";

describe("enumName (Google Ads status/channel labels)", () => {
  it("maps the numeric enums the API returns to their names", () => {
    expect(enumName(enums.CampaignStatus as any, 2)).toBe("ENABLED");
    expect(enumName(enums.CampaignStatus as any, 3)).toBe("PAUSED");
    expect(enumName(enums.AdvertisingChannelType as any, 2)).toBe("SEARCH");
    expect(enumName(enums.AdvertisingChannelType as any, 10)).toBe("PERFORMANCE_MAX");
  });
  it("passes strings through and never returns a bare number", () => {
    expect(enumName(enums.CampaignStatus as any, "ENABLED")).toBe("ENABLED");
    expect(enumName(enums.CampaignStatus as any, 9999)).toBe("UNKNOWN");
    expect(enumName(enums.CampaignStatus as any, undefined)).toBe("UNKNOWN");
  });
});

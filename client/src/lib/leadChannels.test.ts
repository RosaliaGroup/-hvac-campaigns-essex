import { describe, it, expect } from "vitest";
import {
  LEAD_CHANNELS,
  matchesChannel,
  filterLeadsByChannel,
  type LeadChannel,
} from "./leadChannels";

describe("lead channels", () => {
  it("exposes the five source filters with All Sources first", () => {
    expect(LEAD_CHANNELS.map((c) => c.id)).toEqual([
      "all",
      "google_ads",
      "facebook",
      "website",
      "email_sms",
    ]);
    expect(LEAD_CHANNELS[0].label).toBe("All Sources");
  });

  it("'all' matches every lead", () => {
    expect(matchesChannel("meta_lead_ad", "all")).toBe(true);
    expect(matchesChannel(null, "all")).toBe(true);
    expect(matchesChannel(undefined, "all")).toBe(true);
  });

  it("maps raw captureTypes to the correct channel", () => {
    expect(matchesChannel("lp_heat_pump", "google_ads")).toBe(true);
    expect(matchesChannel("meta_lead_ad", "facebook")).toBe(true);
    expect(matchesChannel("exit_popup", "website")).toBe(true);
    expect(matchesChannel("newsletter", "email_sms")).toBe(true);
  });

  it("does not cross-match channels", () => {
    expect(matchesChannel("meta_lead_ad", "google_ads")).toBe(false);
    expect(matchesChannel("lp_heat_pump", "facebook")).toBe(false);
    expect(matchesChannel("unknown_source", "website")).toBe(false);
  });

  it("filterLeadsByChannel returns the full list for 'all' and a subset otherwise", () => {
    const leads = [
      { captureType: "lp_heat_pump" },
      { captureType: "meta_lead_ad" },
      { captureType: "exit_popup" },
      { captureType: "newsletter" },
    ];
    expect(filterLeadsByChannel(leads, "all")).toHaveLength(4);
    expect(filterLeadsByChannel(leads, "google_ads")).toEqual([{ captureType: "lp_heat_pump" }]);
    expect(filterLeadsByChannel(leads, "facebook")).toEqual([{ captureType: "meta_lead_ad" }]);
    const counts = (["all", "google_ads", "facebook", "website", "email_sms"] as LeadChannel[]).map(
      (c) => filterLeadsByChannel(leads, c).length
    );
    expect(counts).toEqual([4, 1, 1, 1, 1]);
  });
});

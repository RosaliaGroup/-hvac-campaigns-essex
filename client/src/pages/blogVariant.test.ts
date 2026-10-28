import { describe, expect, it } from "vitest";
import { pickBlogVariant } from "./blogVariant";

describe("pickBlogVariant", () => {
  it("routes commercial posts without a commercial slug keyword by category", () => {
    expect(pickBlogVariant("nj-cooling-tower-shutdown-planning", "Commercial HVAC")).toBe("commercial");
    expect(pickBlogVariant("closed-loop-pump-rotation-checklist-nj", "Commercial HVAC Planning")).toBe("commercial");
    expect(pickBlogVariant("some-guide", "Commercial & Multifamily HVAC")).toBe("commercial");
  });
  it("routes commercial slugs even without a category", () => {
    expect(pickBlogVariant("nj-cooling-tower-shutdown-planning")).toBe("commercial");
    expect(pickBlogVariant("rooftop-hvac-replacement-quote-checklist-nj")).toBe("commercial");
    expect(pickBlogVariant("nj-multifamily-no-heat-hvac-service-checklist")).toBe("commercial");
  });
  it("keeps residential routing unchanged", () => {
    expect(pickBlogVariant("ac-repair-tips-nj", "HVAC Guides")).toBe("emergency");
    expect(pickBlogVariant("pseg-rebate-denied-what-to-do-nj", "PSE&G Programs")).toBe("rebate");
    expect(pickBlogVariant("heat-pump-installation-nj-guide", "HVAC Guides")).toBe("residential");
  });
});

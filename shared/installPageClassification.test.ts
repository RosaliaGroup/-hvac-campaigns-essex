import { describe, it, expect } from "vitest";
import { isInstallationOrCityPage } from "./seoLinter";

// Exported from seoLinter.ts so the meta-lane drafting prompt (server/services/seo/ai/anthropicProvider.ts)
// uses this ONE definition of "install page". Its own file so it can't conflict with other branches
// appending to seoLinter.test.ts.
describe("isInstallationOrCityPage", () => {
  it.each([
    "/heat-pump-installation-nj", "/central-ac-installation-nj", "/ductless-mini-split-installation-nj", "/vrv-vrf-installation-nj",
    "/commercial-hvac-installation-nj", "/hvac-union-nj", "/hvac-newark-nj",
  ])("true for %s", (p) => expect(isInstallationOrCityPage(p)).toBe(true));

  it.each([
    "/blog/hvac-installation-cost-nj-2026", "/direct-install/bakeries-nj", "/about", "/contact", "/warranty", "/residential", "/commercial", "/commercial/property-managers", "/ac-repair-nj",
  ])("false for %s", (p) => expect(isInstallationOrCityPage(p)).toBe(false));

  it("tolerates a trailing slash on a city page and a query string is not part of the path it is given", () => {
    expect(isInstallationOrCityPage("/hvac-union-nj")).toBe(true);
    expect(isInstallationOrCityPage("/blog/hvac-union-nj")).toBe(false);
  });
});

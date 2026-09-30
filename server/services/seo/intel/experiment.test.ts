import { describe, it, expect, vi } from "vitest";

vi.mock("../../../integrations/searchConsole", () => ({
  getSearchConsoleAccessToken: vi.fn(), getSeoSiteUrl: () => "https://x.test/", getSiteOrigin: () => "https://x.test", inspectUrl: vi.fn(), querySearchAnalytics: vi.fn(),
}));

import { concludeExperiment, sumWindow, holdIsOver } from "./experiment";
import { REINDEX_EXPERIMENT, experimentPhase, isHeldForExperiment, EXPERIMENT_READ_AFTER_DAYS } from "../../../../shared/seoExperiment";
import { isStaticallyLocked } from "../../../seo/lockedPages";
import type { ExperimentPageRead } from "../../../../shared/marketIntelTypes";

const page = (group: "treatment" | "control", over: Partial<ExperimentPageRead> = {}): ExperimentPageRead => ({
  path: "/p", group, coverageState: "Page with redirect", verdict: "excluded", lastCrawlTime: null, recrawledSinceStart: false, impressionsBefore: 0, impressionsAfter: 0, ...over,
});
const indexed = { verdict: "indexed", coverageState: "Submitted and indexed", recrawledSinceStart: true };

describe("concludeExperiment", () => {
  it("crawl fault (H2): >=2 treatment pages indexed again and the controls did not follow", () => {
    const r = concludeExperiment([page("treatment", indexed), page("treatment", indexed), page("treatment"), page("treatment"), page("control"), page("control"), page("control"), page("control")]);
    expect(r.conclusion).toBe("supports_crawl_fault");
  });
  it("quality demotion (H1): Google re-crawled >=2 treatment pages and restored none", () => {
    const r = concludeExperiment([page("treatment", { recrawledSinceStart: true }), page("treatment", { recrawledSinceStart: true }), page("treatment"), page("treatment"), page("control"), page("control")]);
    expect(r.conclusion).toBe("supports_quality_demotion");
  });
  it("inconclusive when treatment and control move together (e.g. the whole site recovers)", () => {
    const r = concludeExperiment([page("treatment", indexed), page("treatment", indexed), page("control", indexed), page("control", indexed)]);
    expect(r.conclusion).toBe("inconclusive");
  });
  it("inconclusive when nothing was re-crawled yet", () => {
    expect(concludeExperiment([page("treatment"), page("treatment"), page("control")]).conclusion).toBe("inconclusive");
  });
  it("summary always carries the raw numbers", () => {
    const r = concludeExperiment([page("treatment", { impressionsBefore: 1, impressionsAfter: 40 }), page("control", { impressionsBefore: 2, impressionsAfter: 3 })]);
    expect(r.summary).toContain("impressions 1 → 40");
    expect(r.summary).toContain("impressions 2 → 3");
  });
});

describe("sumWindow", () => {
  it("sums inclusively over the window and ignores other days and missing pages", () => {
    const m = { "2026-10-01": 5, "2026-10-02": 7, "2026-10-03": 11, "2026-10-04": 100 };
    expect(sumWindow(m, "2026-10-02", "2026-10-03")).toBe(18);
    expect(sumWindow(undefined, "2026-10-01", "2026-10-31")).toBe(0);
  });
});

describe("experiment design (shared/seoExperiment.ts)", () => {
  it("treatment and control are disjoint, 4 each, inside the hold set", () => {
    expect(REINDEX_EXPERIMENT.treatment).toHaveLength(4);
    expect(REINDEX_EXPERIMENT.control).toHaveLength(4);
    expect(REINDEX_EXPERIMENT.treatment.filter((p) => (REINDEX_EXPERIMENT.control as readonly string[]).includes(p))).toEqual([]);
    for (const p of [...REINDEX_EXPERIMENT.treatment, ...REINDEX_EXPERIMENT.control]) expect(REINDEX_EXPERIMENT.holdPaths as readonly string[]).toContain(p);
  });
  it("excludes the confounded pages (titles changed by the 2026-09-30 batches) and the genuine 301", () => {
    const groups = [...REINDEX_EXPERIMENT.treatment, ...REINDEX_EXPERIMENT.control] as string[];
    for (const p of ["/blog/heat-pump-vs-gas-furnace-nj-2026", "/blog/heat-pump-installation-nj-guide", "/blog/nj-clean-heat-program-2026", "/blog/hvac-contractor-newark-nj"]) expect(groups).not.toContain(p);
  });
  it("holds all 15 flagged pages", () => {
    expect(REINDEX_EXPERIMENT.holdPaths).toHaveLength(15);
  });
  it("the hold blocks a held page (also with trailing slash or query), through the real lock gate, until holdUntil", () => {
    const inside = new Date("2026-10-10T12:00:00Z");
    expect(isHeldForExperiment("/hvac-linden-nj", inside)).toBe(true);
    expect(isHeldForExperiment("/hvac-linden-nj/?x=1", inside)).toBe(true);
    expect(isHeldForExperiment("/hvac-newark-nj", inside)).toBe(false);
    expect(isHeldForExperiment("/hvac-linden-nj", new Date("2026-10-23T00:00:00Z"))).toBe(false);
    expect(isHeldForExperiment("/hvac-linden-nj", new Date("2026-10-22T23:00:00Z"))).toBe(true);
    // the live gate (uses the real clock, so only assert while the hold is running)
    if (!holdIsOver(new Date())) {
      const r = isStaticallyLocked("/hvac-linden-nj");
      expect(r.locked).toBe(true);
      if (r.locked) expect(r.reason.kind).toBe("experiment_hold");
    }
  });
});

describe("experimentPhase", () => {
  it("not_started until startedAt is set", () => {
    expect(experimentPhase(new Date("2026-10-05T00:00:00Z"), null)).toEqual({ phase: "not_started" });
  });
  it("running until +16 days, then read", () => {
    const start = "2026-10-01";
    expect(experimentPhase(new Date("2026-10-10T00:00:00Z"), start)).toEqual({ phase: "running", daysUntilRead: EXPERIMENT_READ_AFTER_DAYS - 9 });
    expect(experimentPhase(new Date("2026-10-16T23:59:00Z"), start).phase).toBe("running");
    expect(experimentPhase(new Date("2026-10-17T00:00:00Z"), start)).toEqual({ phase: "read", startedAt: start });
  });
});

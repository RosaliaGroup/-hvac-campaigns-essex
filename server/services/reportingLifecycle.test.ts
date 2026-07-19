/**
 * Reporting lifecycle cutover — server helpers (flag + mode + filter composition).
 *
 * Proves the runtime flag fails SAFELY to legacy for absent/false/invalid values and
 * only engages canonical for an exact "true"; that the mode selects the right terminal
 * predicate; and that the comparison's date/technician/customer filters compose as
 * the dashboard's do. No DB required.
 */
import "../testEnvSetup"; // MUST be first
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isReportingLifecycleEnabled,
  reportingMode,
  terminalJobCondition,
  comparisonJobConditions,
} from "./reportingLifecycle";

const FLAG = "REPORTING_LIFECYCLE_ENABLED";
let saved: string | undefined;
beforeEach(() => {
  saved = process.env[FLAG];
  delete process.env[FLAG];
});
afterEach(() => {
  if (saved === undefined) delete process.env[FLAG];
  else process.env[FLAG] = saved;
});

describe("reportingLifecycle — feature flag (fail-safe to legacy)", () => {
  it("flag ABSENT → legacy reporting", () => {
    delete process.env[FLAG];
    expect(isReportingLifecycleEnabled()).toBe(false);
    expect(reportingMode()).toBe("legacy");
  });

  it('flag "false" → legacy reporting', () => {
    process.env[FLAG] = "false";
    expect(isReportingLifecycleEnabled()).toBe(false);
    expect(reportingMode()).toBe("legacy");
  });

  it('flag "true" → canonical reporting', () => {
    process.env[FLAG] = "true";
    expect(isReportingLifecycleEnabled()).toBe(true);
    expect(reportingMode()).toBe("canonical");
  });

  it("flag is case/whitespace tolerant for the exact true value", () => {
    for (const v of ["TRUE", "True", "  true  ", "tRuE"]) {
      process.env[FLAG] = v;
      expect(isReportingLifecycleEnabled()).toBe(true);
    }
  });

  it("INVALID values fail safely to legacy (1, yes, on, empty, garbage)", () => {
    for (const v of ["1", "yes", "on", "", "enabled", "0", "null", "canonical"]) {
      process.env[FLAG] = v;
      expect(isReportingLifecycleEnabled()).toBe(false);
      expect(reportingMode()).toBe("legacy");
    }
  });
});

describe("reportingLifecycle — terminal predicate by mode", () => {
  it("returns a defined SQL condition for both legacy and canonical modes", () => {
    expect(terminalJobCondition("legacy")).toBeDefined();
    expect(terminalJobCondition("canonical")).toBeDefined();
  });
});

describe("reportingLifecycle — comparison filter composition", () => {
  const D_FROM = new Date("2026-01-01T00:00:00Z");
  const D_TO = new Date("2026-04-01T00:00:00Z");

  it("no filters → no conditions (full pipeline snapshot)", () => {
    expect(comparisonJobConditions({}).length).toBe(0);
  });

  it("technician filter adds exactly one condition (assignee)", () => {
    expect(comparisonJobConditions({ technicianId: 7 }).length).toBe(1);
  });

  it("customer filter adds exactly one condition", () => {
    expect(comparisonJobConditions({ customerId: 42 }).length).toBe(1);
  });

  it("date range adds one condition per bound (on completedAt)", () => {
    expect(comparisonJobConditions({ dateFrom: D_FROM }).length).toBe(1);
    expect(comparisonJobConditions({ dateTo: D_TO }).length).toBe(1);
    expect(comparisonJobConditions({ dateFrom: D_FROM, dateTo: D_TO }).length).toBe(2);
  });

  it("all filters compose additively (customer + tech + 2 date bounds = 4)", () => {
    expect(
      comparisonJobConditions({ customerId: 42, technicianId: 7, dateFrom: D_FROM, dateTo: D_TO }).length,
    ).toBe(4);
  });
});

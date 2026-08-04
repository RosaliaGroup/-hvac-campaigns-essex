import { describe, it, expect } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { opportunities } from "../../drizzle/schema";
import { PARKED_STAGES, STAGE_ORDER, isParkedStage } from "../../shared/stageMeta";
import { isProvisionalWeightStage } from "../../shared/opportunityDashboard";
import { stageDefaultProbabilityCase, weightedValueSql } from "./opportunityStageSql";

// Render the drizzle SQL fragment to { sql, params } via the real MySQL dialect.
// Stage names are bound params, so a stage absent from `params` has NO CASE branch.
const render = () => new MySqlDialect().sqlToQuery(stageDefaultProbabilityCase(opportunities.stage));

describe("stageDefaultProbabilityCase — parked + provisional contribute zero", () => {
  it("emits NO WHEN branch for any parked stage (it falls through to ELSE 0)", () => {
    const { sql, params } = render();
    for (const p of PARKED_STAGES) {
      expect(params, `parked stage '${p}' must not carry a default probability in weighted SQL`).not.toContain(p);
    }
    expect(sql).toContain("ELSE 0");
  });

  it("weights a stage IFF its default is confirmed — provisional new stages + parked excluded", () => {
    const { params } = render();
    for (const s of STAGE_ORDER) {
      const shouldWeight = !isParkedStage(s) && !isProvisionalWeightStage(s);
      expect(params.includes(s), `stage '${s}' weighted-default expected=${shouldWeight}`).toBe(shouldWeight);
    }
  });
});

describe("weightedValueSql — parked zeroed even with an explicit probability", () => {
  const render = () => new MySqlDialect().sqlToQuery(
    weightedValueSql(opportunities.amount, opportunities.probability, opportunities.stage),
  );
  it("guards parked stages to 0 (so SQL agrees with JS weightedValue)", () => {
    const { sql, params } = render();
    expect(sql).toContain("THEN 0"); // parked short-circuit
    // Parked stage is named ONLY in the zero-guard IN-list — never carrying a probability.
    for (const p of PARKED_STAGES) expect(params).toContain(p);
  });
});

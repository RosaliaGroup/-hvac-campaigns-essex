import { describe, it, expect } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { opportunities } from "../../drizzle/schema";
import { PARKED_STAGES, OPEN_STAGES, WON_STAGES, LOST_STAGES } from "../../shared/stageMeta";
import { stageDefaultProbabilityCase } from "./opportunityStageSql";

// Render the drizzle SQL fragment to { sql, params } via the real MySQL dialect.
// Stage names are bound params, so a stage absent from `params` has NO CASE branch.
const render = () => new MySqlDialect().sqlToQuery(stageDefaultProbabilityCase(opportunities.stage));

describe("stageDefaultProbabilityCase — parked contributes zero to weighted pipeline", () => {
  it("emits NO WHEN branch for any parked stage (it falls through to ELSE 0)", () => {
    const { sql, params } = render();
    for (const p of PARKED_STAGES) {
      expect(params, `parked stage '${p}' must not carry a default probability in weighted SQL`).not.toContain(p);
    }
    expect(sql).toContain("ELSE 0");
  });

  it("still weights every non-parked stage", () => {
    const { params } = render();
    for (const s of [...OPEN_STAGES, ...WON_STAGES, ...LOST_STAGES]) {
      expect(params, `non-parked stage '${s}' should have a weighted CASE branch`).toContain(s);
    }
  });
});

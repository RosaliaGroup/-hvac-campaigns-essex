import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { deriveResidentialStageId, RESIDENTIAL_PIPELINE_KEY } from "./opportunityStages";

// Minimal fake db for the single select().from().where().limit() lookup.
function fakeDb(result: unknown[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(result),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { select: () => chain } as any;
}
function throwingDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { select: () => { throw new Error("no such table"); } } as any;
}

describe("deriveResidentialStageId — enum→stageId lockstep for non-commercial inserts", () => {
  it("returns the residential stageId when the enum maps to a seeded stage", async () => {
    expect(await deriveResidentialStageId(fakeDb([{ id: 42 }]), "new")).toBe(42);
  });

  it("returns null for a null/empty stage without querying", async () => {
    expect(await deriveResidentialStageId(fakeDb([{ id: 1 }]), null)).toBeNull();
    expect(await deriveResidentialStageId(fakeDb([{ id: 1 }]), "")).toBeNull();
  });

  it("returns null (never throws) when stages are not seeded yet — pre-0065 fallback", async () => {
    expect(await deriveResidentialStageId(fakeDb([]), "new")).toBeNull();
    expect(await deriveResidentialStageId(throwingDb(), "new")).toBeNull();
  });

  it("targets the residential pipeline", () => {
    expect(RESIDENTIAL_PIPELINE_KEY).toBe("residential");
  });
});

describe("non-commercial insert paths keep stageId in lockstep (regression guard)", () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
  const sync = read("../integrations/accounting/salesDocSync.ts");
  const oppRouter = read("../routers/opportunities.ts");

  it("QBO sync insert derives stageId from the enum", () => {
    expect(sync).toMatch(/deriveResidentialStageId\(db, stage\)/);
  });
  it("CRM manual-create insert derives stageId from the enum", () => {
    expect(oppRouter).toMatch(/deriveResidentialStageId\(db, "new"\)/);
  });
});

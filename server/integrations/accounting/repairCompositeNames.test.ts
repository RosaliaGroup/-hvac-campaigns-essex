import { describe, it, expect } from "vitest";
import {
  planCustomerRepair,
  findMergeCandidates,
  isHighConfidenceApplyTarget,
  assessPreMigration,
  collectPreMigrationDryRun,
  UNAVAILABLE_RAW,
  UNAVAILABLE_APPROVAL,
  type RepairCustomerRow,
  type PreMigrationRow,
  type ReadExec,
} from "./repairCompositeNames";

function row(overrides: Partial<RepairCustomerRow> = {}): RepairCustomerRow {
  return {
    id: 1,
    type: "residential",
    displayName: "PN-173-B | Marco Weber | 9005 Smith Ave, North Bergen, NJ 07047 | Basement I",
    companyName: null,
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    quickbooksCustomerId: null,
    quickbooksRawDisplayName: null,
    projectReference: null,
    displayNameManuallyApproved: false,
    ...overrides,
  };
}

describe("planCustomerRepair", () => {
  it("cleans a composite person name into name + project + address + notes", () => {
    const d = planCustomerRepair(row());
    expect(d.kind).toBe("repair");
    if (d.kind !== "repair") return;
    expect(d.action.before.displayName).toContain("PN-173-B");
    expect(d.action.after.displayName).toBe("Marco Weber");
    expect(d.action.after.firstName).toBe("Marco");
    expect(d.action.after.lastName).toBe("Weber");
    expect(d.action.projectReference).toBe("PN-173-B");
    expect(d.action.serviceAddress).toMatchObject({ line1: "9005 Smith Ave", city: "North Bergen", state: "NJ" });
    expect(d.action.locationNotes).toBe("Basement I");
    // Original composite preserved for audit.
    expect(d.action.rawDisplayNameToPreserve).toBe(row().displayName);
  });

  it("routes a composite company into companyName", () => {
    const d = planCustomerRepair(
      row({ id: 2, displayName: "PN#172 | Cushman & Wakefield | 28th Floor 444 Madison Avenue, New York, NY 10022" }),
    );
    expect(d.kind).toBe("repair");
    if (d.kind !== "repair") return;
    expect(d.action.after.displayName).toBe("Cushman & Wakefield");
    expect(d.action.after.companyName).toBe("Cushman & Wakefield");
    expect(d.action.after.type).toBe("commercial");
    expect(d.action.after.firstName).toBeNull();
  });

  it("SKIPS a manually-approved name (never overwrite)", () => {
    const d = planCustomerRepair(row({ displayNameManuallyApproved: true }));
    expect(d).toMatchObject({ kind: "skip", reason: expect.stringContaining("manually approved") });
  });

  it("SKIPS a legitimate non-composite name", () => {
    const d = planCustomerRepair(row({ id: 3, displayName: "Marco Weber" }));
    expect(d).toMatchObject({ kind: "skip", reason: expect.stringContaining("not a composite") });
  });

  it("SKIPS a legitimate company name that merely contains a pipe", () => {
    const d = planCustomerRepair(row({ id: 4, displayName: "Smith | Sons Plumbing & Heating" }));
    expect(d.kind).toBe("skip");
  });

  it("is idempotent: a name already cleaned to the customer is skipped", () => {
    // First pass produces the clean name.
    const first = planCustomerRepair(row());
    expect(first.kind).toBe("repair");
    if (first.kind !== "repair") return;
    // Second pass over the cleaned record: displayName is now "Marco Weber".
    const second = planCustomerRepair(row({ displayName: first.action.after.displayName, displayNameManuallyApproved: true }));
    expect(second.kind).toBe("skip");
  });

  it("preserves an already-stored raw display name instead of overwriting it", () => {
    const d = planCustomerRepair(row({ quickbooksRawDisplayName: "ORIGINAL RAW" }));
    if (d.kind !== "repair") throw new Error("expected repair");
    expect(d.action.rawDisplayNameToPreserve).toBe("ORIGINAL RAW");
  });
});

describe("findMergeCandidates", () => {
  const target = row({
    id: 10,
    email: "marco@example.test",
    phone: "(201) 555-0142",
    quickbooksCustomerId: "QB-77",
  });

  it("flags matches by QBO id, email and normalized phone — and excludes self", () => {
    const others = [
      { id: 10, displayName: "self", email: "marco@example.test", phone: "201-555-0142", quickbooksCustomerId: "QB-77" },
      { id: 11, displayName: "By QBO id", email: null, phone: null, quickbooksCustomerId: "QB-77" },
      { id: 12, displayName: "By email", email: "MARCO@example.test", phone: null, quickbooksCustomerId: null },
      { id: 13, displayName: "By phone", email: null, phone: "+1 (201) 555-0142", quickbooksCustomerId: null },
      { id: 14, displayName: "Unrelated", email: "someone@else.test", phone: "973-555-0000", quickbooksCustomerId: "QB-99" },
    ];
    const found = findMergeCandidates(target, others);
    expect(found.map(f => f.id).sort()).toEqual([11, 12, 13]);
    expect(found.find(f => f.id === 11)?.matchedBy).toBe("quickbooksCustomerId");
    expect(found.find(f => f.id === 12)?.matchedBy).toBe("email");
    expect(found.find(f => f.id === 13)?.matchedBy).toBe("phone");
    // Self (id 10) is never a candidate.
    expect(found.find(f => f.id === 10)).toBeUndefined();
  });

  it("returns nothing when there are no keys to match on", () => {
    const bare = row({ id: 20, email: null, phone: null, quickbooksCustomerId: null });
    const found = findMergeCandidates(bare, [{ id: 21, displayName: "x", email: null, phone: null, quickbooksCustomerId: null }]);
    expect(found).toEqual([]);
  });
});

// ── Required repair-level fixtures (17–20) + space-delimited repair ──────────
describe("space-delimited repair + protections", () => {
  it("plans a high-confidence repair from a space-delimited composite", () => {
    const d = planCustomerRepair(row({ id: 30, displayName: "PN#210 Jordan Fielder 4200 Example Ave, Springfield, NJ 07081" }));
    expect(d.kind).toBe("repair");
    if (d.kind !== "repair") return;
    expect(d.action.after.displayName).toBe("Jordan Fielder");
    expect(d.action.projectReference).toBe("PN#210");
    expect(d.action.confidence).toBe("high");
    expect(d.action.format).toBe("space");
    expect(d.action.serviceAddress).toMatchObject({ line1: "4200 Example Ave", city: "Springfield" });
  });

  it("#16 project-only space name: repair carries low confidence and proposes NO rename", () => {
    const d = planCustomerRepair(row({ id: 31, displayName: "PN-220-C" }));
    expect(d.kind).toBe("repair");
    if (d.kind !== "repair") return;
    expect(d.action.confidence).toBe("low");
    expect(d.action.nameConfident).toBe(false);
    expect(d.action.after.displayName).toBe("PN-220-C"); // unchanged — never rename to a project code
  });

  it("#17 manual-correction protection: manually-approved name is never changed", () => {
    const d = planCustomerRepair(row({ id: 32, displayName: "PN#210 Jordan Fielder 4200 Example Ave, Springfield, NJ 07081", displayNameManuallyApproved: true }));
    expect(d).toMatchObject({ kind: "skip", reason: expect.stringContaining("manually approved") });
  });

  it("#18 duplicate prevention: candidates are reported, and dedupe never returns self", () => {
    const target = row({ id: 33, email: "dup@example.test", quickbooksCustomerId: "QB-33" });
    const found = findMergeCandidates(target, [
      { id: 33, displayName: "self", email: "dup@example.test", phone: null, quickbooksCustomerId: "QB-33" },
      { id: 34, displayName: "same email", email: "DUP@example.test", phone: null, quickbooksCustomerId: null },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: 34, matchedBy: "email" });
  });

  it("#19 raw-name preservation: the original composite is kept verbatim", () => {
    const original = "PN-212-A Dana Whitfield 88 Testbrook Rd, Fairview, NJ 07022 Basement II";
    const d = planCustomerRepair(row({ id: 35, displayName: original }));
    if (d.kind !== "repair") throw new Error("expected repair");
    expect(d.action.rawDisplayNameToPreserve).toBe(original);
  });

  it("#20 no automatic merge behavior: planner only ever returns 'repair' or 'skip'", () => {
    for (const dn of ["PN#210 Jordan Fielder 4200 Example Ave, Springfield, NJ 07081", "Jordan Fielder", "PN-220-C"]) {
      const d = planCustomerRepair(row({ id: 40, displayName: dn }));
      expect(["repair", "skip"]).toContain(d.kind); // never "merge"
    }
  });

  it("classifies a composite company as commercial from the CLEAN name, even with stale first/last (fix for CRM #15)", () => {
    const d = planCustomerRepair(
      row({
        id: 55,
        displayName: "PN#172 I Cushman & Wakefield I 28th Floor 444 Madison Avenue, New York, NY 10022",
        firstName: "STALE", // garbage from the old corrupted split — must NOT force person
        lastName: "GARBAGE",
      }),
    );
    if (d.kind !== "repair") throw new Error("expected repair");
    expect(d.action.after.displayName).toBe("Cushman & Wakefield");
    expect(d.action.after.companyName).toBe("Cushman & Wakefield");
    expect(d.action.after.type).toBe("commercial");
    // Stale person fields are CLEARED so they can never override the company class.
    expect(d.action.after.firstName).toBeNull();
    expect(d.action.after.lastName).toBeNull();
    expect(d.action.confidence).toBe("high");
  });

  it("classifies company-suffix names as commercial", () => {
    const d = planCustomerRepair(row({ id: 56, displayName: "PN#301 Summit HVAC LLC 12 Sample St, Newark, NJ 07102" }));
    if (d.kind !== "repair") throw new Error("expected repair");
    expect(d.action.after.companyName).toBe("Summit HVAC LLC");
    expect(d.action.after.type).toBe("commercial");
    expect(d.action.after.firstName).toBeNull();
  });

  it("keeps a normal person as residential with a clean split (overwrites stale first/last)", () => {
    const d = planCustomerRepair(row({ id: 57, displayName: "PN#210 Jordan Fielder 4200 Example Ave, Springfield, NJ 07081", firstName: "OLD", lastName: "JUNK" }));
    if (d.kind !== "repair") throw new Error("expected repair");
    expect(d.action.after.companyName).toBeNull();
    expect(d.action.after.type).toBe("residential");
    expect(d.action.after.firstName).toBe("Jordan"); // clean split, not "OLD"
    expect(d.action.after.lastName).toBe("Fielder");
  });

  it("manual-approval protection also protects customer type (whole record skipped)", () => {
    const d = planCustomerRepair(
      row({ id: 58, displayName: "PN#172 I Cushman & Wakefield I 28th Floor 444 Madison Avenue, New York, NY 10022", displayNameManuallyApproved: true }),
    );
    expect(d.kind).toBe("skip"); // no name, type, or any field is touched
  });

  it("apply gate: ONLY high-confidence, name-confident, dup-free records are apply targets", () => {
    const high = planCustomerRepair(row({ id: 50, displayName: "PN#210 Jordan Fielder 4200 Example Ave, Springfield, NJ 07081" }));
    const mediumNoAddr = planCustomerRepair(row({ id: 51, displayName: "PN#218 Cornerstone Advisors" })); // medium
    const projectOnly = planCustomerRepair(row({ id: 52, displayName: "PN-220-C" })); // low
    if (high.kind !== "repair" || mediumNoAddr.kind !== "repair" || projectOnly.kind !== "repair") throw new Error("expected repairs");

    expect(isHighConfidenceApplyTarget(high.action, [])).toBe(true);
    expect(isHighConfidenceApplyTarget(mediumNoAddr.action, [])).toBe(false); // medium excluded
    expect(isHighConfidenceApplyTarget(projectOnly.action, [])).toBe(false); // low excluded
    // A high record WITH a possible duplicate is excluded (manual merge only).
    expect(isHighConfidenceApplyTarget(high.action, [{ id: 999, matchedBy: "email", displayName: "dupe" }])).toBe(false);
  });

  // Regression: the address-tail downgrade must live in the CORE planCustomerRepair
  // (action.confidence), not only in the pre-migration assessment — otherwise the
  // real --apply gate is more permissive than the reviewed dry-run and would repair
  // records whose address lacks a confident city/state tail. Names are the exact
  // production shapes (corrupted-pipe `I`) for CRM #7/#9/#10 (excluded) vs
  // #11/#15/#23 (eligible).
  it("core confidence downgrades composites whose address has no confident city/state tail", () => {
    const eligible = [
      "PN#165 I Cynthia Rodriguez I 36 Stuyvesant Rd, Teaneck, NJ 07666", // #11
      "PN#172 I Cushman & Wakefield I 28th Floor 444 Madison Avenue, New York, NY 10022", // #15 (commercial)
      "PN-173-B I Marco Weber I 9005 Smith Ave, North Bergen, NJ 07047 I Basement I", // #23
    ];
    const excluded = [
      "PN#160 I NATANYA L PHIPPS I 351 CENTRAL AVE HALEDON", // #7 — no state
      "PN#132 I PDC I 828 Summer Ave Newark NJ", // #9 — no comma-delimited city
      "PN #163 I Colbert Watson I 360 Littleton Ave, Newark NJ 07103", // #10 — no city/state comma
    ];
    for (const dn of eligible) {
      const d = planCustomerRepair(row({ id: 60, displayName: dn }));
      if (d.kind !== "repair") throw new Error(`expected repair for ${dn}`);
      expect(d.action.confidence).toBe("high");
      expect(isHighConfidenceApplyTarget(d.action, [])).toBe(true);
    }
    for (const dn of excluded) {
      const d = planCustomerRepair(row({ id: 61, displayName: dn }));
      if (d.kind !== "repair") throw new Error(`expected repair for ${dn}`);
      expect(d.action.confidence).toBe("medium");
      expect(isHighConfidenceApplyTarget(d.action, [])).toBe(false);
    }
  });
});

// ── Pre-migration, read-only dry-run ─────────────────────────────────────────

function preRow(overrides: Partial<PreMigrationRow> = {}): PreMigrationRow {
  return {
    id: 1,
    type: "residential",
    displayName: "PN-173-B | Marco Weber | 9005 Smith Ave, North Bergen, NJ 07047 | Basement I",
    companyName: null,
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    quickbooksCustomerId: "QB-1",
    ...overrides,
  };
}

describe("assessPreMigration", () => {
  it("marks the 0038-only fields explicitly unavailable, never guessing", () => {
    const r = assessPreMigration(preRow(), []);
    expect(r.rawDisplayName).toBe(UNAVAILABLE_RAW);
    expect(r.approvalLockStatus).toBe(UNAVAILABLE_APPROVAL);
  });

  it("proposes a high-confidence repair for a clean 4-part person composite", () => {
    const r = assessPreMigration(preRow(), []);
    expect(r.status).toBe("repair-candidate");
    expect(r.confidence).toBe("high");
    expect(r.proposedCleanName).toBe("Marco Weber");
    expect(r.proposedType).toBe("residential");
    expect(r.proposedProjectReference).toBe("PN-173-B");
    expect(r.proposedAddressLine1).toBe("9005 Smith Ave");
    expect(r.proposedAction).toContain("repair AFTER migration");
  });

  it("FLAGS (does not repair) a pipe composite that has no address (name-only)", () => {
    const r = assessPreMigration(preRow({ id: 2, displayName: "PN-50 | Bob Vance" }), []);
    expect(r.status).toBe("flag-for-review");
    expect(r.confidence).toBe("medium"); // pipe + plausible name but no address → medium
    expect(r.proposedAction).toContain("do NOT auto-repair");
  });

  it("FLAGS a record with a conflicting identity signal (possible duplicate)", () => {
    const r = assessPreMigration(preRow({ id: 3 }), [{ id: 900, matchedBy: "email", displayName: "Marco Weber" }]);
    expect(r.status).toBe("flag-for-review");
    expect(r.confidence).toBe("medium"); // high composite downgraded to medium by the duplicate
    expect(r.reasons.join(" ")).toContain("possible duplicate");
  });

  it("SKIPS a non-composite name", () => {
    const r = assessPreMigration(preRow({ id: 4, displayName: "Smith | Sons Plumbing & Heating" }), []);
    expect(r.status).toBe("skip");
    expect(r.proposedCleanName).toBeNull();
  });
});

describe("collectPreMigrationDryRun — READ-ONLY guarantee", () => {
  // A fake executor that records every statement and returns canned reads.
  function makeExec(): { exec: ReadExec; seen: string[] } {
    const seen: string[] = [];
    const candidates: PreMigrationRow[] = [
      preRow({ id: 1 }), // clean person → repair-candidate, property create-new
      preRow({ id: 2, displayName: "PN#172 | Cushman & Wakefield | 28th Floor 444 Madison Avenue, New York, NY 10022", type: "residential", quickbooksCustomerId: "QB-2" }),
      preRow({ id: 3, displayName: "PN-50 | Bob Vance", quickbooksCustomerId: "QB-3" }), // too few segments → flag
      preRow({ id: 4, displayName: "Smith | Sons Plumbing & Heating", quickbooksCustomerId: "QB-4" }), // not composite → skip
    ];
    const all = [
      ...candidates.map(c => ({ id: c.id, displayName: c.displayName, email: c.email, phone: c.phone, quickbooksCustomerId: c.quickbooksCustomerId })),
    ];
    const exec: ReadExec = async (sql, params) => {
      seen.push(sql);
      if (/FROM customers WHERE displayName LIKE/.test(sql)) return candidates as unknown as Record<string, unknown>[];
      if (/SELECT id, displayName, email, phone, quickbooksCustomerId FROM customers/.test(sql)) return all as unknown as Record<string, unknown>[];
      if (/FROM properties WHERE customerId = \?/.test(sql)) {
        // customer #1 already has the exact service property → reuse; others → create.
        if (params?.[0] === 1) return [{ id: 10, addressLine1: "9005 Smith Ave" }];
        return [];
      }
      return [];
    };
    return { exec, seen };
  }

  it("issues ONLY reads — no INSERT/UPDATE/DELETE/ALTER/DROP/MERGE/COMMIT", async () => {
    const { exec, seen } = makeExec();
    const report = await collectPreMigrationDryRun(exec);

    // The report itself must claim zero writes / zero merges.
    expect(report.totals.databaseWritesPerformed).toBe(0);
    expect(report.totals.automaticMergesPerformed).toBe(0);

    // Transaction is read-only and rolled back.
    expect(seen).toContain("SET SESSION TRANSACTION READ ONLY");
    expect(seen).toContain("START TRANSACTION READ ONLY");
    expect(seen).toContain("ROLLBACK");

    // EVERY statement is a read or read-only transaction control.
    const forbidden = /\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|MERGE|CREATE|REPLACE|COMMIT|SET\s+SESSION\s+TRANSACTION\s+READ\s+WRITE)\b/i;
    for (const s of report.statementsIssued) {
      expect(s, `statement must be read-only: ${s}`).not.toMatch(forbidden);
      expect(s).toMatch(/^(SELECT|SET SESSION TRANSACTION READ ONLY|START TRANSACTION READ ONLY|ROLLBACK)\b/i);
    }
  });

  it("produces correct assessments + totals from the reads", async () => {
    const { exec } = makeExec();
    const { records, totals } = await collectPreMigrationDryRun(exec);

    const byId = Object.fromEntries(records.map(r => [r.crmId, r]));
    expect(byId[1].status).toBe("repair-candidate");
    expect(byId[1].propertyAction).toBe("reuse-existing"); // exact match exists
    expect(byId[2].status).toBe("repair-candidate");
    expect(byId[2].propertyAction).toBe("create-new");
    expect(byId[3].status).toBe("flag-for-review");
    expect(byId[4].status).toBe("skip");

    expect(totals.scannedCandidates).toBe(4);
    expect(totals.confidentRepairCandidates).toBe(2);
    expect(totals.ambiguousFlagged).toBe(1);
    expect(totals.notCompositeSkipped).toBe(1);
    expect(totals.existingPropertiesReused).toBe(1);
    expect(totals.proposedNewProperties).toBe(1);
    expect(totals.automaticMergesPerformed).toBe(0);
    expect(totals.databaseWritesPerformed).toBe(0);
  });
});

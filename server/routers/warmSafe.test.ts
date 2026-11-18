import { describe, expect, it } from "vitest";
import { eligibilityNote, nominationEmailHtml, nominationInput, type NominationInput } from "./warmSafe";

const base: NominationInput = {
  nominatorName: "Pat Doe",
  nominatorPhone: "2015550100",
  nomineeTown: "Bogota",
  heatingSituation: "Old boiler that needs replacing",
  nomineeKnows: true,
};

describe("Warm & Safe intake", () => {
  it("accepts the full nominee details", () => {
    const parsed = nominationInput.parse({
      ...base,
      nomineeFullName: "Sheryl Smith",
      nomineeAddress: "1 Main St",
      nomineePhone: "2015550199",
      nomineeBestTime: "Mornings",
      nomineeIs65Plus: "yes",
      nomineeOwnsHome: "yes",
    });
    expect(parsed.nomineeFullName).toBe("Sheryl Smith");
  });

  it("still accepts the old minimal form (first name only)", () => {
    expect(() => nominationInput.parse({ ...base, nomineeFirstName: "Sheryl" })).not.toThrow();
  });

  it("shows contact details and no gaps when everything is confirmed", () => {
    const n = { ...base, nomineeFullName: "Sheryl Smith", nomineeAddress: "1 Main St", nomineePhone: "2015550199", nomineeIs65Plus: "yes", nomineeOwnsHome: "yes" } as NominationInput;
    const html = nominationEmailHtml(n, "now");
    expect(html).toContain("Sheryl Smith");
    expect(html).toContain("1 Main St");
    expect(html).toContain("2015550199");
    expect(eligibilityNote(n)).toBe("");
  });

  it("never shows the nominee phone when they don't know about the nomination", () => {
    const n = { ...base, nomineeKnows: false, nomineePhone: "2015550199" };
    expect(nominationEmailHtml(n, "now")).not.toContain("2015550199");
  });

  it("flags what still needs checking", () => {
    const note = eligibilityNote({ ...base, nomineeIs65Plus: "unsure", nomineeOwnsHome: "no" });
    expect(note).toContain("confirm age 65+");
    expect(note).toContain("don't own the home");
    expect(note).toContain("no street address");
    expect(note).toContain("no phone given");
  });
});

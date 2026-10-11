import { describe, expect, it } from "vitest";
import { parseProspectCsv } from "./prospectImport";
const header = "email,company,decisionMaker,sourceUrl,draftSubject,draftBody";
describe("prospect research CSV import", () => {
  it("parses a verified contact with quoted commas", () => {
    const result = parseProspectCsv(header + '\n"JANE@EXAMPLE.COM","Acme, LLC",Jane Smith,https://example.com/team,HVAC planning,"Hi Jane, hello"');
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ email: "jane@example.com", company: "Acme, LLC" });
  });
  it("rejects missing verification and deduplicates", () => {
    const result = parseProspectCsv(header + "\na@example.com,Acme,A,not-a-url,Subject,Body\na@example.com,Acme,A,https://example.com,Subject,Body\na@example.com,Acme,A,https://example.com,Subject,Body");
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
  });
  it("fails closed when mandatory columns are absent", () => {
    expect(parseProspectCsv("email,company\na@example.com,Acme").rows).toEqual([]);
  });
});

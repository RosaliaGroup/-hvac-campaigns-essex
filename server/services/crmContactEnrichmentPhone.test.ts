import { describe, expect, it } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { effectiveContactPhoneSQL } from "./crmContactEnrichment";

describe("CRM enrichment phone coverage SQL", () => {
  it("checks both the contact and its linked customer, treating whitespace as missing", () => {
    const compiled = new MySqlDialect().sqlToQuery(effectiveContactPhoneSQL).sql;
    expect(compiled).toContain("COALESCE");
    expect(compiled).toContain("NULLIF(TRIM");
    expect(compiled).toMatch(/crmExternalContacts/i);
    expect(compiled).toMatch(/customers/i);
    expect(compiled).toMatch(/phone/i);
  });
});

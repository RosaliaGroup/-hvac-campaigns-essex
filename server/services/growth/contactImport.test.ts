import { describe, it, expect } from "vitest";
import { parseImportCsv, validateHeaders } from "./contactImport";

const HEADER = "name,phone,email,company,address,type,last_job_date,notes,consent";

describe("parseImportCsv", () => {
  it("parses a well-formed row", () => {
    const csv = `${HEADER}\nJane Doe,8624239396,jane@example.com,Acme Co,123 Main St,residential,2025-01-01,VIP customer,customer`;
    const { headers, rows } = parseImportCsv(csv);
    expect(headers).toEqual(["name", "phone", "email", "company", "address", "type", "last_job_date", "notes", "consent"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Jane Doe", phone: "8624239396", email: "jane@example.com", consent: "customer" });
  });

  it("handles quoted fields containing commas", () => {
    const csv = `${HEADER}\n"Doe, Jane",8624239396,,,"123 Main St, Apt 4",residential,,,unknown`;
    const { rows } = parseImportCsv(csv);
    expect(rows[0].name).toBe("Doe, Jane");
    expect(rows[0].address).toBe("123 Main St, Apt 4");
  });

  it("returns empty for a blank file", () => {
    expect(parseImportCsv("")).toEqual({ headers: [], rows: [] });
  });

  it("handles multiple rows", () => {
    const csv = `${HEADER}\nA,1,,,,, ,,\nB,2,,,,,,,`;
    const { rows } = parseImportCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("A");
    expect(rows[1].name).toBe("B");
  });
});

describe("validateHeaders", () => {
  it("passes with all 9 required columns present (order-independent)", () => {
    expect(validateHeaders(["consent", "name", "phone", "email", "company", "address", "type", "last_job_date", "notes"])).toEqual([]);
  });

  it("reports each missing column", () => {
    expect(validateHeaders(["name", "phone"])).toEqual(
      expect.arrayContaining(["email", "company", "address", "type", "last_job_date", "notes", "consent"]),
    );
  });
});

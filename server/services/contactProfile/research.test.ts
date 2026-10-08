import { describe, expect, it, vi } from "vitest";
import {
  businessDomain,
  publicUrl,
  researchContact,
  validateResearch,
} from "./research";
const companySource = "https://example.com/about",
  personUrl = "https://www.linkedin.com/in/sample-person";
const fact = (
  value: string,
  evidence = "Sample Person works at Example Company"
) => ({ value, source: companySource, evidence });
const company = {
  name: fact("Example Company"),
  website: fact("https://example.com"),
  industry: fact("Property management"),
};
const person = {
  url: personUrl,
  source: personUrl,
  evidence: "Sample Person at Example Company",
};
describe("Sourced contact profiles", () => {
  it("does not treat personal email providers as company domains", () => {
    expect(businessDomain("client@gmail.com")).toBeNull();
    expect(businessDomain(" Client@Example.com ")).toBe("example.com");
  });
  it("rejects unsafe and invented source URLs", () => {
    expect(publicUrl("javascript:alert(1)")).toBeNull();
    expect(publicUrl("https://user:pass@example.com")).toBeNull();
    expect(publicUrl("https://127.0.0.1/profile")).toBeNull();
    expect(
      validateResearch({ company }, [], {
        name: "Sample Person",
        email: "sample@example.com",
      }).company
    ).toEqual({});
  });
  it("populates company facts for a matching business domain and sourced person profile", () => {
    const result = validateResearch(
      { company, social: [person] },
      [companySource, personUrl],
      { name: "Sample Person", email: "sample@example.com" }
    );
    expect(result.company.name?.value).toBe("Example Company");
    expect(result.social[0].platform).toBe("LinkedIn");
  });
  it("does not assign an employer to a Gmail contact without a known company", () => {
    expect(
      validateResearch(
        { company, social: [person] },
        [companySource, personUrl],
        { name: "Sample Person", email: "sample@gmail.com" }
      )
    ).toMatchObject({ company: {}, social: [], status: "not_found" });
  });
  it("requires employer or exact email evidence, not a name-only social match", () => {
    const result = validateResearch(
      { company, social: [{ ...person, evidence: "Sample Person" }] },
      [companySource, personUrl],
      { name: "Sample Person", email: "sample@example.com" }
    );
    expect(result.social).toEqual([]);
  });
  it("accepts known employer evidence for personal email contacts", () => {
    const result = validateResearch(
      { company, social: [person] },
      [companySource, personUrl],
      {
        name: "Sample Person",
        email: "sample@gmail.com",
        company: "Example Company",
      }
    );
    expect(result.social).toHaveLength(1);
  });
  it("rejects company LinkedIn pages as person profiles", () => {
    expect(
      validateResearch(
        {
          social: [
            { ...person, url: "https://www.linkedin.com/company/example" },
          ],
        },
        ["https://www.linkedin.com/company/example", personUrl],
        { name: "Sample Person", company: "Example Company" }
      ).social
    ).toEqual([]);
  });
  it("shows unavailable without calling an unconfigured research provider", async () => {
    const fetcher = vi.fn();
    expect(
      await researchContact({ name: "Sample Person" }, {}, fetcher)
    ).toMatchObject({ status: "unavailable" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it("accepts equivalent cited URL variants and bare company domains", () => {
  const result = validateResearch(
    {
      company: {
        ...company,
        website: fact("www.example.com"),
        name: { ...company.name, source: "http://www.example.com/about/" },
      },
      social: [{ ...person, url: personUrl + "/", source: personUrl + "/" }],
    },
    [companySource, personUrl],
    { name: "Sample Person", email: "sample@example.com" }
  );
  expect(result.company.name?.value).toBe("Example Company");
  expect(result.company.website?.value).toBe("https://example.com/");
  expect(result.social).toHaveLength(1);
});

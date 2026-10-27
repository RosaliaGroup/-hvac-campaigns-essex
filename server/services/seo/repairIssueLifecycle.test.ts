import { describe, expect, it } from "vitest";
import { seoIssueActions } from "./repairIssueLifecycle";
describe("SEO repair issue lifecycle", () => {
  it("creates an issue for a newly failing page", () => {
    expect(seoIssueActions([{path:"/blog/a",status:"not_live"}], []).create).toEqual(["[SEO Repair] /blog/a"]);
  });
  it("does not duplicate an existing open issue", () => {
    expect(seoIssueActions([{path:"/blog/a",status:"not_live"}], ["[SEO Repair] /blog/a"]).create).toEqual([]);
  });
  it("closes a recovered page's issue", () => {
    expect(seoIssueActions([{path:"/blog/a",status:"verified_live"}], ["[SEO Repair] /blog/a"]).close).toEqual(["[SEO Repair] /blog/a"]);
  });
  it("does not close issues for pages omitted from an audit", () => {
    expect(seoIssueActions([{path:"/blog/a",status:"verified_live"}], ["[SEO Repair] /blog/b"]).close).toEqual([]);
  });
  it("rejects an empty audit", () => {
    expect(() => seoIssueActions([], ["[SEO Repair] /blog/a"])).toThrow("Empty audit");
  });
});

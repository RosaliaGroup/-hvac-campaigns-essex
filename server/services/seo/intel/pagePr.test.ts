import { describe, it, expect } from "vitest";
import { insertPageProposalIntoSource, removePageProposalFromSource } from "./pagePr";
import type { PageProposal } from "../../../../client/src/data/pageProposals";

const SOURCE = `export type PageProposal = { slug: string };\n\nexport const PAGE_PROPOSALS: PageProposal[] = [];\n`;

function proposal(overrides: Partial<PageProposal> = {}): PageProposal {
  return {
    slug: "ptac-replacement-nj",
    title: "PTAC Replacement in NJ",
    metaDescription: "PTAC replacement across NJ.",
    targetQuery: "PTAC replacement NJ",
    outline: "Covers PTAC replacement scope and timeline.",
    proposedAt: "2026-09-26",
    ...overrides,
  };
}

describe("insertPageProposalIntoSource / removePageProposalFromSource (page-PR revert round-trip)", () => {
  it("inserts a proposal that parses back out with the same fields", () => {
    const updated = insertPageProposalIntoSource(SOURCE, proposal());
    expect(updated).toContain('"slug":"ptac-replacement-nj"');
    expect(updated).toContain('"title":"PTAC Replacement in NJ"');
  });

  it("throws if the array marker is missing (registry file shape changed unexpectedly)", () => {
    expect(() => insertPageProposalIntoSource("no marker here", proposal())).toThrow();
  });

  it("round-trips: insert then remove restores the original source", () => {
    const inserted = insertPageProposalIntoSource(SOURCE, proposal());
    const reverted = removePageProposalFromSource(inserted, "ptac-replacement-nj");
    expect(reverted).toBe(SOURCE);
  });

  it("removing a slug that isn't present is a no-op", () => {
    const inserted = insertPageProposalIntoSource(SOURCE, proposal());
    const result = removePageProposalFromSource(inserted, "does-not-exist");
    expect(result).toBe(inserted);
  });

  it("removing one of two proposals leaves the other intact", () => {
    let source = insertPageProposalIntoSource(SOURCE, proposal({ slug: "a" }));
    source = insertPageProposalIntoSource(source, proposal({ slug: "b" }));
    const result = removePageProposalFromSource(source, "a");
    expect(result).not.toContain('"slug":"a"');
    expect(result).toContain('"slug":"b"');
  });
});

import { describe, it, expect } from "vitest";
import {
  prospectHour,
  verifiedCandidates,
  introduction,
} from "./prospectWorkflow";
const p = {
  name: "Jane Smith",
  title: "Property Manager",
  company: "Example PM",
  email: "jane@example.com",
  verificationUrl: "https://example.com/team",
  evidence: "Jane Smith jane@example.com",
  reason: "Manages multifamily buildings",
};
describe("CRM prospect workflow", () => {
  it("uses the Eastern window across DST", () => {
    expect(prospectHour(new Date("2026-10-09T13:00:00Z"))).toBe(
      "2026-10-09T09"
    );
    expect(prospectHour(new Date("2026-10-09T22:00:00Z"))).toBeNull();
    expect(prospectHour(new Date("2026-12-09T14:00:00Z"))).toBe(
      "2026-12-09T09"
    );
  });
  it("never schedules the worker on Eastern weekends", () => {
    expect(prospectHour(new Date("2026-10-10T15:00:00Z"))).toBeNull();
    expect(prospectHour(new Date("2026-10-11T15:00:00Z"))).toBeNull();
    expect(prospectHour(new Date("2026-10-12T15:00:00Z"))).not.toBeNull();
  });
  it("rejects Viza and other named exclusions", () => {
    for (const candidate of [
      { ...p, company: "Viza Property Management" },
      { ...p, name: "Thomas Visaggio" },
      { ...p, name: "Gabriel Lopes" },
      { ...p, company: "Giga" },
      { ...p, email: "jane@onyxequities.com" },
    ]) {
      candidate.evidence = `${candidate.name} ${candidate.email}`;
      expect(verifiedCandidates([candidate], [candidate.verificationUrl])).toEqual([]);
    }
  });
  it("requires exact cited name and email evidence, dedupes companies", () => {
    expect(verifiedCandidates([p, p], [p.verificationUrl])).toHaveLength(1);
    expect(verifiedCandidates([p], [])).toEqual([]);
    expect(
      verifiedCandidates(
        [{ ...p, evidence: "Jane Smith" }],
        [p.verificationUrl]
      )
    ).toEqual([]);
  });
  it("rejects excluded and generic contacts", () => {
    expect(
      verifiedCandidates(
        [
          {
            ...p,
            name: "Gabriel Lopez",
            evidence: "Gabriel Lopez jane@example.com",
          },
        ],
        [p.verificationUrl]
      )
    ).toEqual([]);
    expect(
      verifiedCandidates(
        [
          {
            ...p,
            email: "info@example.com",
            evidence: "Jane Smith info@example.com",
          },
        ],
        [p.verificationUrl]
      )
    ).toEqual([]);
  });
  it("introduces the company without claiming a submitted request", () => {
    expect(introduction(p)).toContain("Example PM");
    expect(introduction(p)).not.toContain("got your request");
  });
});

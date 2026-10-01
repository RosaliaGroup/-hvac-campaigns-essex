import { describe, it, expect } from "vitest";
import { blogPosts } from "../client/src/data/blogPosts";

/**
 * Guard on the REAL data. The content lane writes posts into blogPosts.ts as JSON object literals; the vite build does not
 * type-check, so an extra key (PR #162's checklist `content` label) shipped and only `tsc` noticed — failing main's type-check.
 * Unit tests on the generator are not enough; this fails on the data itself, in plain `vitest`.
 */
const POST_KEYS = ["title", "slug", "date", "readTime", "category", "metaDescription", "excerpt", "sections", "faqSchema"];
const SECTION_KEYS: Record<string, string[]> = {
  intro: ["type", "content"], h2: ["type", "content"], paragraph: ["type", "content"], stat_box: ["type", "content"],
  checklist: ["type", "items"], numbered_list: ["type", "items"], cta_box: ["type", "content", "buttonText", "buttonUrl"],
};

describe("client/src/data/blogPosts.ts — every post has exactly the fields BlogPostData allows", () => {
  it("has no unknown post-level keys", () => {
    const offenders = blogPosts.flatMap((p) => Object.keys(p).filter((k) => !POST_KEYS.includes(k)).map((k) => `${p.slug}: ${k}`));
    expect(offenders).toEqual([]);
  });

  it("has no unknown or missing section keys, and no unknown section types", () => {
    const offenders: string[] = [];
    for (const p of blogPosts) {
      p.sections.forEach((s, i) => {
        const allowed = SECTION_KEYS[s.type];
        if (!allowed) {
          offenders.push(`${p.slug}[${i}]: unknown type ${s.type}`);
          return;
        }
        const keys = Object.keys(s);
        for (const k of keys) if (!allowed.includes(k)) offenders.push(`${p.slug}[${i}] (${s.type}): stray key "${k}"`);
        for (const k of allowed) if (!keys.includes(k)) offenders.push(`${p.slug}[${i}] (${s.type}): missing "${k}"`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("has only question/answer on FAQ entries", () => {
    const offenders = blogPosts.flatMap((p) => (p.faqSchema ?? []).flatMap((f, i) => Object.keys(f).filter((k) => !["question", "answer"].includes(k)).map((k) => `${p.slug} faq[${i}]: ${k}`)));
    expect(offenders).toEqual([]);
  });

  it("includes the content-lane post from PR #162 with its checklist label removed", () => {
    const p = blogPosts.find((x) => x.slug === "hvac-capital-budgeting-per-unit-apartment-owners");
    expect(p).toBeTruthy();
    const checklist = p!.sections.find((s) => s.type === "checklist") as unknown as Record<string, unknown>;
    expect(Object.keys(checklist).sort()).toEqual(["items", "type"]);
  });
});

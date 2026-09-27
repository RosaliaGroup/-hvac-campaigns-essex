/**
 * Registry of proposed new site pages (docs/market-intel-spec.md §3d "New
 * site page"). Written to by server/services/seo/intel/pagePr.ts's
 * openPagePR() via a GitHub PR — never edited directly by hand while a PR is
 * open for it. Each entry is a DATA-ONLY proposal (not yet routed/rendered) —
 * building out the full PR-3 page-template system (a real React page +
 * route) is a separate, larger project this feature does not attempt; this
 * registry exists so the market-intel job has a real, reviewable, revertible
 * write path today, per docs/market-intel-spec.md §4's "it can only call
 * approveBatchToPR/publishPost/openPagePR" rule.
 */
export type PageProposal = {
  slug: string;
  title: string;
  metaDescription: string;
  targetQuery: string;
  /** Short evidence/outline paragraph — not full page copy (see file header). */
  outline: string;
  proposedAt: string; // ISO date
};

export const PAGE_PROPOSALS: PageProposal[] = [];

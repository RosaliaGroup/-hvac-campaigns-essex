/**
 * Route resolution for clickable rows on the customer 360° dashboard.
 *
 * Kept pure and shared so the profile's row-click targets are unit-tested
 * directly (the vitest env has no DOM, so we lock the navigation *targets*
 * the component computes, not a rendered click). CustomerDetail and its tab
 * components import these — the test therefore exercises the real code path,
 * not a parallel copy.
 */

/** Where a Job row navigates when clicked. */
export function jobRoute(job: { id: number }): string {
  return `/jobs/${job.id}`;
}

/** Where an Opportunity row navigates when clicked. */
export function opportunityRoute(o: { id: number }): string {
  return `/opportunities/${o.id}`;
}

/**
 * Where an Estimate/Invoice row navigates when clicked. Sales documents don't
 * have their own detail page; they open the opportunity that backs them.
 * Returns null when the document isn't linked to an opportunity (row stays
 * non-navigable rather than dead-linking).
 */
export function salesDocRoute(doc: { opportunityId: number | null }): string | null {
  return doc.opportunityId != null ? `/opportunities/${doc.opportunityId}` : null;
}

/** Where a Property row navigates — the customer stays put; properties are edited in place. */
export function customerRoute(customer: { id: number }): string {
  return `/customers/${customer.id}`;
}

/**
 * Pure view-state decision for the Opportunity Center data views.
 *
 * Every view (Overview / Pipeline / All) loads from a tRPC query that can be
 * loading, errored, empty, or ready. Before this helper the views only checked
 * `isLoading`, so a *failed* query fell through and rendered as an empty board /
 * "no results" / perpetual spinner — a failure masquerading as an empty state.
 * Centralising the decision keeps that bug from coming back and makes the
 * four-way branch unit-testable without a DOM.
 */
export type ViewState = "loading" | "error" | "empty" | "ready";

export function viewState(q: { isLoading: boolean; isError: boolean; isEmpty: boolean }): ViewState {
  if (q.isLoading) return "loading";
  if (q.isError) return "error";
  if (q.isEmpty) return "empty";
  return "ready";
}

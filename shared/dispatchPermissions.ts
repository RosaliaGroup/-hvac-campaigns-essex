/**
 * Dispatch access gate — the single source of truth for who may use the Dispatch
 * Center. Server and client both call this so the rule lives in one place.
 *
 * M0 (approved): Admin ONLY, using the EXISTING admin authorization model — no new
 * roles are introduced in M0. A Manus admin or a team-admin both resolve to
 * `role === "admin"`. Dedicated Dispatcher / Office-Manager roles arrive in a later
 * milestone; when they do, extend this one function and the server gate follows.
 */
export interface DispatchAccessUser {
  role?: string | null;
  teamRole?: "admin" | "member" | "viewer" | null;
}

export function canAccessDispatch(user: DispatchAccessUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === "admin";
}

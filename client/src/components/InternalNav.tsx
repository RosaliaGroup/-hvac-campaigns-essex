/**
 * DEPRECATED — the horizontal internal tab bar that used to duplicate the left
 * sidebar has been removed as part of the department-based navigation cleanup.
 *
 * The single source of truth for internal navigation is now the department
 * sidebar in `DashboardLayout` (desktop = left sidebar, mobile = drawer),
 * mounted centrally by `ProtectedRoute`. This component is kept as a no-op so
 * the many pages that still import and render <InternalNav /> continue to
 * compile; those references can be deleted incrementally.
 */
export default function InternalNav() {
  return null;
}

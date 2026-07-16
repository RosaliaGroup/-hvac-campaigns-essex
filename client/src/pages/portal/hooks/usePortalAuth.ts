import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../../server/routers";
import { trpc } from "@/lib/trpc";

/** Non-null shape of `portal.auth.me` (the signed-in customer projection). */
export type PortalMe = NonNullable<inferRouterOutputs<AppRouter>["portal"]["auth"]["me"]>;

/**
 * Portal auth state, backed by `portal.auth.me` (returns null when signed out).
 * `retry: false` so a 401 resolves quickly to the unauthenticated state instead
 * of retrying; `staleTime` avoids refetch storms while navigating sections.
 */
export function usePortalAuth() {
  const meQuery = trpc.portal.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  return {
    me: meQuery.data ?? null,
    isAuthenticated: Boolean(meQuery.data),
    loading: meQuery.isLoading,
    refetch: meQuery.refetch,
  };
}

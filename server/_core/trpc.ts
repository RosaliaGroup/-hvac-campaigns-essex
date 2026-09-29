import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const createCallerFactory = t.createCallerFactory;

/**
 * Gateway-timeout guard (runtime half). The proxy in front of the app 504s any
 * request that runs past ~20s, while the handler keeps running server-side and
 * a retried click starts a duplicate. Long work must be an async job
 * (server/services/asyncLaneJob.ts startJob) — the static half of this guard is
 * server/routers/asyncMutationGuard.test.ts, which fails the build when a
 * @slow-tagged operation is awaited inline in a mutation. This middleware is
 * the safety net for anything that test can't see: it never changes behavior,
 * it just logs loudly when a mutation actually outlives the gateway.
 */
export const GATEWAY_GUARD_MS = 20_000;

export const gatewayTimeoutGuard = t.middleware(async ({ type, path, next }) => {
  if (type !== "mutation") return next();
  const startedAt = Date.now();
  try {
    return await next();
  } finally {
    const ms = Date.now() - startedAt;
    if (ms > GATEWAY_GUARD_MS) {
      console.warn(
        `[gateway-guard] mutation "${path}" ran ${(ms / 1000).toFixed(1)}s (> ${GATEWAY_GUARD_MS / 1000}s gateway timeout) — the client likely saw a 504. Make it an async job: startJob() in server/services/asyncLaneJob.ts.`,
      );
    }
  }
});

export const publicProcedure = t.procedure.use(gatewayTimeoutGuard);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Phase 1 security: viewers are READ-ONLY across the entire app.
 * Enforced centrally — any mutation on any protectedProcedure-based
 * route is rejected for teamRole "viewer". Queries remain allowed.
 */
const blockViewerMutations = t.middleware(async opts => {
  const { ctx, type, next } = opts;
  if (type === "mutation" && ctx.user?.teamRole === "viewer") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Viewers have read-only access. Ask an admin for member access to make changes.",
    });
  }
  return next();
});

export const protectedProcedure = t.procedure.use(gatewayTimeoutGuard).use(requireUser).use(blockViewerMutations);

/**
 * Requires a non-viewer authenticated user (member or admin) for BOTH
 * queries and mutations. Use for endpoints whose data shouldn't be
 * visible to viewers at all (e.g. credentials).
 */
export const memberProcedure = t.procedure.use(gatewayTimeoutGuard).use(requireUser).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (ctx.user?.teamRole === "viewer") {
      throw new TRPCError({ code: "FORBIDDEN", message: "This area requires member access." });
    }
    return next();
  }),
);

export const adminProcedure = t.procedure.use(gatewayTimeoutGuard).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

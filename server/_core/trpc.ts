import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

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

export const protectedProcedure = t.procedure.use(requireUser).use(blockViewerMutations);

/**
 * Requires a non-viewer authenticated user (member or admin) for BOTH
 * queries and mutations. Use for endpoints whose data shouldn't be
 * visible to viewers at all (e.g. credentials).
 */
export const memberProcedure = t.procedure.use(requireUser).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (ctx.user?.teamRole === "viewer") {
      throw new TRPCError({ code: "FORBIDDEN", message: "This area requires member access." });
    }
    return next();
  }),
);

export const adminProcedure = t.procedure.use(
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

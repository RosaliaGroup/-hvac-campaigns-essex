import { TRPCError } from "@trpc/server";
import { router, memberProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { homeownerEmailStatus } from "../services/homeownerEmailLane";

export const homeownerEmailRouter = router({
  status: memberProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    return homeownerEmailStatus(db);
  }),
});

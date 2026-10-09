import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getContactEnrichment, classifyContactPhone, setFollowConfirmed,
  listContactEnrichmentQueue,
} from "../services/crmContactEnrichment";

export const crmContactEnrichmentRouter = router({
  get: protectedProcedure.input(z.object({contactId:z.number().int().positive()}))
    .query(({input})=>getContactEnrichment(input.contactId)),
  classifyPhone: protectedProcedure.input(z.object({
    contactId:z.number().int().positive(),
    phoneType:z.enum(["business","cell","unknown"]),
    sourceUrl:z.string().url().max(2000).optional(),
    confirmedByUser:z.boolean().default(false),
  })).mutation(({input})=>classifyContactPhone(input)),
  confirmFollow: protectedProcedure.input(z.object({
    contactId:z.number().int().positive(),
    url:z.string().url().max(500),
    followed:z.boolean(),
  })).mutation(({input})=>setFollowConfirmed(input)),
  queue: protectedProcedure.input(z.object({
    filter:z.enum(["all","missing_phone","unknown_type","needs_social"]).default("missing_phone"),
    offset:z.number().int().min(0).default(0),
    limit:z.number().int().min(1).max(100).default(50),
  })).query(({input})=>listContactEnrichmentQueue(input)),
});

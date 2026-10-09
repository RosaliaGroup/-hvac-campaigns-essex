import { z } from "zod";
import { lushaConfigured, previewLushaContact, revealLushaPhone, savePreviewedLushaLinkedIn } from "../services/lushaCrmEnrichment";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getContactEnrichment, classifyContactPhone, setFollowConfirmed,
  listContactEnrichmentQueue,
} from "../services/crmContactEnrichment";

export const crmContactEnrichmentRouter = router({
  lushaStatus: protectedProcedure.query(()=>({
    configured:lushaConfigured(),
    message:lushaConfigured()
      ? "Lusha CRM API is configured. Previews and reveals require explicit actions."
      : "LUSHA_API_KEY is missing in Railway; the connected ChatGPT Lusha app is separate.",
  })),
  lushaPreview: protectedProcedure
    .input(z.object({contactId:z.number().int().positive(),approveSearchCost:z.literal(true)}))
    .mutation(({input})=>previewLushaContact(input.contactId)),
  lushaRevealPhone: protectedProcedure
    .input(z.object({contactId:z.number().int().positive(),approvePhoneCredits:z.literal(true)}))
    .mutation(({input})=>revealLushaPhone(input.contactId,input.approvePhoneCredits)),
  lushaSaveLinkedIn: protectedProcedure
    .input(z.object({contactId:z.number().int().positive()}))
    .mutation(({input})=>savePreviewedLushaLinkedIn(input.contactId)),

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

import { desc, like, or } from "drizzle-orm";
import { crmExternalContacts } from "../../drizzle/schema";
import { gmailCrmStatus, syncGmailPage } from "../services/gmailCrm";
import { startJob, getJob } from "../services/asyncLaneJob";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  getContactTimeline,
  logCommunication,
  upsertExternalContact,
} from "../services/crmCommunications";

const dbOrThrow = async () => {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
};

export const crmCommunicationsRouter = router({
  contacts: protectedProcedure
    .input(z.object({ search: z.string().max(255).optional() }))
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const term = `%${input.search ?? ""}%`;
      return db
        .select()
        .from(crmExternalContacts)
        .where(
          or(
            like(crmExternalContacts.name, term),
            like(crmExternalContacts.email, term),
            like(crmExternalContacts.phone, term)
          )
        )
        .orderBy(desc(crmExternalContacts.updatedAt))
        .limit(100);
    }),
  gmailStatus: protectedProcedure.query(() => gmailCrmStatus()),
  syncGmail: protectedProcedure
    .input(z.object({ pageToken: z.string().max(2048).optional() }))
    .mutation(({ input }) =>
      startJob({
        kind: "crm-gmail",
        key: "crm-gmail",
        fn: () => syncGmailPage(input),
      })
    ),
  gmailSyncJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      const job = getJob(input.jobId);
      return job?.kind === "crm-gmail" ? job : null;
    }),
  upsertContact: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        company: z.string().max(255).nullish(),
        title: z.string().max(255).nullish(),
        email: z.string().email().max(320).nullish(),
        phone: z.string().max(50).nullish(),
        propertyName: z.string().max(255).nullish(),
        source: z.string().max(100).nullish(),
        notes: z.string().nullish(),
        customerId: z.number().int().nullish(),
        leadId: z.number().int().nullish(),
        leadCaptureId: z.number().int().nullish(),
      })
    )
    .mutation(async ({ input }) =>
      upsertExternalContact(await dbOrThrow(), input)
    ),

  log: protectedProcedure
    .input(
      z.object({
        externalContactId: z.number().int().nullish(),
        customerId: z.number().int().nullish(),
        leadId: z.number().int().nullish(),
        channel: z.enum(["email", "sms", "call"]),
        direction: z.enum(["inbound", "outbound"]),
        provider: z.string().min(1).max(30),
        providerMessageId: z.string().max(255).nullish(),
        providerThreadId: z.string().max(255).nullish(),
        fromAddress: z.string().max(320).nullish(),
        toAddress: z.string().max(320).nullish(),
        subject: z.string().max(500).nullish(),
        body: z.string().nullish(),
        status: z.string().max(50).nullish(),
        occurredAt: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ input }) => logCommunication(await dbOrThrow(), input)),

  timeline: protectedProcedure
    .input(z.object({ externalContactId: z.number().int() }))
    .query(async ({ input }) =>
      getContactTimeline(await dbOrThrow(), input.externalContactId)
    ),
});

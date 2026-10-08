import { and, desc, eq, isNotNull, like, or, sql } from "drizzle-orm";
import { composeGmail } from "../services/gmailCompose";
import { sendGmailReply } from "../services/gmailReply";
import { sendAndRecordSms } from "../services/smsOutbound";
import {
  crmExternalContacts,
  crmCommunications,
  customers,
  leads,
  leadCaptures,
} from "../../drizzle/schema";
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
  contactCard: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const [contact] = await db
        .select()
        .from(crmExternalContacts)
        .where(eq(crmExternalContacts.id, input.id))
        .limit(1);
      if (!contact) throw new Error("Contact not found");
      const [customer] = await db
        .select()
        .from(customers)
        .where(
          or(
            contact.customerId
              ? eq(customers.id, contact.customerId)
              : undefined,
            contact.email ? eq(customers.email, contact.email) : undefined,
            contact.phone ? eq(customers.phone, contact.phone) : undefined
          ) ?? sql`false`
        )
        .limit(1);
      const [lead] = await db
        .select()
        .from(leads)
        .where(
          or(
            contact.leadId ? eq(leads.id, contact.leadId) : undefined,
            contact.email
              ? and(
                  eq(leads.contactType, "email"),
                  eq(leads.contact, contact.email)
                )
              : undefined,
            contact.phone
              ? and(
                  eq(leads.contactType, "phone"),
                  eq(leads.contact, contact.phone)
                )
              : undefined
          ) ?? sql`false`
        )
        .limit(1);
      const [capture] = await db
        .select()
        .from(leadCaptures)
        .where(
          or(
            contact.leadCaptureId
              ? eq(leadCaptures.id, contact.leadCaptureId)
              : undefined,
            contact.email ? eq(leadCaptures.email, contact.email) : undefined
          ) ?? sql`false`
        )
        .limit(1);
      return {
        ...contact,
        name:
          customer?.displayName ?? lead?.name ?? capture?.name ?? contact.name,
        phone:
          contact.phone ??
          customer?.phone ??
          (lead?.contactType === "phone" ? lead.contact : null) ??
          capture?.phone,
        company: contact.company ?? customer?.companyName,
        customerId: contact.customerId ?? customer?.id,
        leadId: contact.leadId ?? lead?.id,
      };
    }),
  saveContactCard: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().trim().min(1).max(255),
        phone: z
          .string()
          .trim()
          .min(7)
          .max(50)
          .refine(
            value =>
              /^[+\d\s().-]+$/.test(value) &&
              value.replace(/\D/g, "").length >= 10,
            "Enter a valid phone number with area code."
          )
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      await db
        .update(crmExternalContacts)
        .set({
          name: input.name,
          ...(input.phone
            ? { phone: input.phone.replace(/[^0-9+]/g, "") }
            : {}),
        })
        .where(eq(crmExternalContacts.id, input.id));
      return { saved: true };
    }),
  openCustomerContact: protectedProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, input.customerId))
        .limit(1);
      if (!customer) throw new Error("Contact not found");
      const [linked] = await db
        .select()
        .from(crmExternalContacts)
        .where(eq(crmExternalContacts.customerId, customer.id))
        .limit(1);
      if (linked) return linked;
      return upsertExternalContact(db, {
        customerId: customer.id,
        name: customer.displayName,
        email: customer.email,
        phone: customer.phone,
        company: customer.companyName,
        source: "crm",
      });
    }),
  composeEmail: protectedProcedure
    .input(
      z.object({
        externalContactId: z.number().int().positive(),
        subject: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .refine(v => !/[\r\n]/.test(v), "Invalid subject"),
        body: z.string().trim().min(1).max(20000),
        action: z.enum(["draft", "send"]),
        requestId: z.string().uuid(),
      })
    )
    .mutation(({ input }) =>
      startJob({
        kind: "crm-compose",
        key: `crm-compose:${input.requestId}`,
        fn: () => composeGmail(input),
      })
    ),
  replyEmail: protectedProcedure
    .input(
      z.object({
        externalContactId: z.number().int(),
        messageId: z.number().int(),
        body: z.string().trim().min(1).max(20000),
        requestId: z.string().uuid(),
      })
    )
    .mutation(({ input }) =>
      startJob({
        kind: "crm-reply",
        key: `crm-reply:${input.requestId}`,
        fn: () => sendGmailReply(input),
      })
    ),
  sendText: protectedProcedure
    .input(
      z.object({
        externalContactId: z.number().int(),
        body: z.string().trim().min(1).max(1600),
        requestId: z.string().uuid(),
      })
    )
    .mutation(({ input }) =>
      startJob({
        kind: "crm-text",
        key: `crm-text:${input.requestId}`,
        fn: async () => {
          const db = await dbOrThrow();
          const [contact] = await db
            .select()
            .from(crmExternalContacts)
            .where(eq(crmExternalContacts.id, input.externalContactId))
            .limit(1);
          if (!contact?.phone)
            throw new Error(
              "Save the contact phone number before sending a text."
            );
          const result = await sendAndRecordSms(db, {
            phone: contact.phone,
            message: input.body,
            source: "inbox_reply",
            customerId: contact.customerId,
            leadId: contact.leadId,
          });
          if (!result.success)
            throw new Error(result.error ?? "Text message could not be sent.");
          // Associate the carrier's mirrored row with the card the operator used,
          // including when an older phone-only contact exists for the same number.
          if (result.messageId) {
            try {
              await db
                .update(crmCommunications)
                .set({ externalContactId: contact.id })
                .where(
                  and(
                    eq(crmCommunications.provider, "telnyx"),
                    eq(crmCommunications.providerMessageId, result.messageId)
                  )
                );
            } catch {
              /* The carrier accepted the SMS; never report this as a send failure. */
            }
          }
          return { sent: true };
        },
      })
    ),
  sendJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      const job = getJob(input.jobId);
      return job && ["crm-reply", "crm-text", "crm-compose"].includes(job.kind)
        ? job
        : null;
    }),
  contacts: protectedProcedure
    .input(z.object({ search: z.string().max(255).optional() }))
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const term = `%${input.search ?? ""}%`;
      return db
        .select()
        .from(crmExternalContacts)
        .where(
          and(
            or(
              isNotNull(crmExternalContacts.customerId),
              isNotNull(crmExternalContacts.leadId),
              isNotNull(crmExternalContacts.leadCaptureId),
              // Include contacts imported from Gmail Sent, even before they become leads.
              sql`exists (select 1 from ${crmCommunications} where ${crmCommunications.externalContactId} = ${crmExternalContacts.id} and ${crmCommunications.direction} = 'outbound' and ${crmCommunications.channel} = 'email')`,
              sql`exists (select 1 from ${customers} where ${customers.email} = ${crmExternalContacts.email} or ${customers.phone} = ${crmExternalContacts.phone})`,
              sql`exists (select 1 from ${leads} where (${leads.contactType} = 'email' and ${leads.contact} = ${crmExternalContacts.email}) or (${leads.contactType} = 'phone' and ${leads.contact} = ${crmExternalContacts.phone}))`,
              sql`exists (select 1 from ${leadCaptures} where ${leadCaptures.email} = ${crmExternalContacts.email} or ${leadCaptures.phone} = ${crmExternalContacts.phone})`
            ),
            or(
              like(crmExternalContacts.name, term),
              like(crmExternalContacts.email, term),
              like(crmExternalContacts.phone, term),
              like(crmExternalContacts.company, term),
              like(crmExternalContacts.title, term)
            )
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

  contactForCustomer: protectedProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const [contact] = await db
        .select()
        .from(crmExternalContacts)
        .where(eq(crmExternalContacts.customerId, input.customerId))
        .limit(1);
      return contact ?? null;
    }),

  timeline: protectedProcedure
    .input(z.object({ externalContactId: z.number().int() }))
    .query(async ({ input }) =>
      getContactTimeline(await dbOrThrow(), input.externalContactId)
    ),
});

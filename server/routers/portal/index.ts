/**
 * Customer Portal — top-level tRPC router.
 *
 * Namespaced under `portal.*`. Every data procedure is a `portalProcedure`
 * (authenticated) and scopes strictly to `ctx.portal.customer.id`, so a signed-in
 * customer can only ever read/write their own data.
 *
 * Reuses existing tables READ-ONLY where they already exist:
 *   - quickbooksSalesDocuments (Estimates = docType "estimate", Invoices = "invoice")
 *   - appointments, jobs, jobStatusHistory, properties
 * Portal-owned tables back Payments, Equipment, Warranty, Maintenance Agreements,
 * Documents and Messaging.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { router } from "../../_core/trpc";
import { getDb } from "../../db";
import { storagePut, storageGet } from "../../storage";
import { stripe, getCheckoutSession } from "../../stripe-service";
import {
  customers,
  properties,
  quickbooksSalesDocuments,
  appointments,
  jobs,
  jobStatusHistory,
  portalPayments,
  customerEquipment,
  equipmentWarranties,
  maintenanceAgreements,
  customerDocuments,
  portalMessageThreads,
  portalMessages,
} from "../../../drizzle/schema";
import { portalAuthRouter } from "./auth";
import { portalProcedure, type PortalPrincipal } from "./session";

// ── helpers ──────────────────────────────────────────────────────────────────

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "The portal is temporarily unavailable. Please try again shortly." });
  }
  return db;
}

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Estimate statuses within quickbooksSalesDocuments.status. */
const ESTIMATE_STATUSES = ["pending", "accepted", "closed", "rejected", "expired"] as const;
/** Invoice statuses within quickbooksSalesDocuments.status. */
const INVOICE_STATUSES = ["paid", "partial", "unpaid", "void"] as const;

function toNumber(value: string | null | undefined): number {
  if (value == null) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Safe projection of a sales document — never leaks the raw QBO payload. */
function projectSalesDoc(row: typeof quickbooksSalesDocuments.$inferSelect) {
  return {
    id: row.id,
    docType: row.docType,
    docNumber: row.docNumber,
    status: row.status,
    totalAmount: row.totalAmount,
    balance: row.balance,
    currency: row.currency ?? "USD",
    txnDate: row.txnDate,
    dueDate: row.dueDate,
    sentAt: row.sentAt,
    expiresAt: row.expiresAt,
    voided: row.voided,
    documentLink: row.documentLink,
  };
}

/** Post a message into a thread and keep the thread's denormalized state fresh. */
async function appendMessage(
  db: Db,
  opts: { threadId: number; customerId: number; sender: "customer" | "staff"; body: string; authorId?: number | null },
) {
  await db.insert(portalMessages).values({
    threadId: opts.threadId,
    customerId: opts.customerId,
    sender: opts.sender,
    authorId: opts.authorId ?? null,
    body: opts.body,
  });
  const bump = opts.sender === "customer"
    ? { staffUnread: sql`${portalMessageThreads.staffUnread} + 1` }
    : { customerUnread: sql`${portalMessageThreads.customerUnread} + 1` };
  await db
    .update(portalMessageThreads)
    .set({ lastMessageAt: new Date(), status: "open", ...bump })
    .where(eq(portalMessageThreads.id, opts.threadId));
}

async function assertOwnedThread(db: Db, threadId: number, customerId: number) {
  const [thread] = await db
    .select()
    .from(portalMessageThreads)
    .where(and(eq(portalMessageThreads.id, threadId), eq(portalMessageThreads.customerId, customerId)))
    .limit(1);
  if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found." });
  return thread;
}

const cid = (ctx: { portal: PortalPrincipal }) => ctx.portal.customer.id;

// ── router ─────────────────────────────────────────────────────────────────—

export const portalRouter = router({
  auth: portalAuthRouter,

  // ── 1. DASHBOARD ──────────────────────────────────────────────────────────
  dashboard: router({
    summary: portalProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const customerId = cid(ctx);

      const docs = await db
        .select()
        .from(quickbooksSalesDocuments)
        .where(eq(quickbooksSalesDocuments.customerId, customerId));

      const estimates = docs.filter((d) => d.docType === "estimate" && !d.voided);
      const invoices = docs.filter((d) => d.docType === "invoice" && !d.voided);
      const openEstimates = estimates.filter((d) => d.status === "pending").length;
      const outstandingBalance = invoices
        .filter((d) => d.status === "unpaid" || d.status === "partial")
        .reduce((sum, d) => sum + toNumber(d.balance ?? d.totalAmount), 0);

      const upcoming = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.customerId, customerId),
            inArray(appointments.status, ["pending", "confirmed", "rescheduled", "arrived"]),
          ),
        )
        .orderBy(desc(appointments.scheduledAt))
        .limit(3);

      const [agreements, equipmentRows, threads] = await Promise.all([
        db.select().from(maintenanceAgreements).where(and(eq(maintenanceAgreements.customerId, customerId), eq(maintenanceAgreements.status, "active"))),
        db.select().from(customerEquipment).where(and(eq(customerEquipment.customerId, customerId), eq(customerEquipment.status, "active"))),
        db.select().from(portalMessageThreads).where(eq(portalMessageThreads.customerId, customerId)),
      ]);

      const unreadMessages = threads.reduce((sum, t) => sum + (t.customerUnread ?? 0), 0);

      return {
        customer: {
          displayName: ctx.portal.customer.displayName,
          email: ctx.portal.customer.email,
          phone: ctx.portal.customer.phone,
        },
        stats: {
          openEstimates,
          openInvoices: invoices.filter((d) => d.status === "unpaid" || d.status === "partial").length,
          outstandingBalance: outstandingBalance.toFixed(2),
          activeAgreements: agreements.length,
          equipmentCount: equipmentRows.length,
          unreadMessages,
        },
        upcomingAppointments: upcoming.map((a) => ({
          id: a.id,
          appointmentType: a.appointmentType,
          serviceType: a.serviceType,
          scheduledAt: a.scheduledAt,
          preferredDate: a.preferredDate,
          preferredTime: a.preferredTime,
          status: a.status,
        })),
      };
    }),
  }),

  // ── 2. ESTIMATES ──────────────────────────────────────────────────────────
  estimates: router({
    list: portalProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const rows = await db
        .select()
        .from(quickbooksSalesDocuments)
        .where(and(eq(quickbooksSalesDocuments.customerId, cid(ctx)), eq(quickbooksSalesDocuments.docType, "estimate")))
        .orderBy(desc(quickbooksSalesDocuments.txnDate));
      return rows.map(projectSalesDoc);
    }),
    get: portalProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const [row] = await db
        .select()
        .from(quickbooksSalesDocuments)
        .where(and(eq(quickbooksSalesDocuments.id, input.id), eq(quickbooksSalesDocuments.customerId, cid(ctx)), eq(quickbooksSalesDocuments.docType, "estimate")))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Estimate not found." });
      return projectSalesDoc(row);
    }),
    /**
     * Customer accepts / requests changes to an estimate. We do NOT mutate the
     * QBO document (its sync is owned elsewhere); instead we open a message
     * thread notifying staff of the decision.
     */
    respond: portalProcedure
      .input(z.object({ id: z.number().int().positive(), decision: z.enum(["accept", "request_changes"]), note: z.string().max(2000).optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const customerId = cid(ctx);
        const [row] = await db
          .select()
          .from(quickbooksSalesDocuments)
          .where(and(eq(quickbooksSalesDocuments.id, input.id), eq(quickbooksSalesDocuments.customerId, customerId), eq(quickbooksSalesDocuments.docType, "estimate")))
          .limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Estimate not found." });

        const label = row.docNumber ? `Estimate ${row.docNumber}` : `Estimate #${row.id}`;
        const subject = input.decision === "accept" ? `${label} accepted` : `Changes requested on ${label}`;
        const body = `${ctx.portal.customer.displayName} ${input.decision === "accept" ? "accepted" : "requested changes to"} ${label} ($${row.totalAmount}).${input.note ? `\n\nNote: ${input.note}` : ""}`;

        await db.insert(portalMessageThreads).values({ customerId, subject, status: "open", staffUnread: 1 });
        const [thread] = await db
          .select()
          .from(portalMessageThreads)
          .where(eq(portalMessageThreads.customerId, customerId))
          .orderBy(desc(portalMessageThreads.id))
          .limit(1);
        await db.insert(portalMessages).values({ threadId: thread.id, customerId, sender: "customer", body });
        return { success: true, threadId: thread.id };
      }),
  }),

  // ── 3. INVOICES ───────────────────────────────────────────────────────────
  invoices: router({
    list: portalProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const rows = await db
        .select()
        .from(quickbooksSalesDocuments)
        .where(and(eq(quickbooksSalesDocuments.customerId, cid(ctx)), eq(quickbooksSalesDocuments.docType, "invoice")))
        .orderBy(desc(quickbooksSalesDocuments.txnDate));
      return rows.map(projectSalesDoc);
    }),
    get: portalProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const [row] = await db
        .select()
        .from(quickbooksSalesDocuments)
        .where(and(eq(quickbooksSalesDocuments.id, input.id), eq(quickbooksSalesDocuments.customerId, cid(ctx)), eq(quickbooksSalesDocuments.docType, "invoice")))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
      return projectSalesDoc(row);
    }),
  }),

  // ── 4. PAYMENTS ───────────────────────────────────────────────────────────
  payments: router({
    list: portalProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db
        .select()
        .from(portalPayments)
        .where(eq(portalPayments.customerId, cid(ctx)))
        .orderBy(desc(portalPayments.createdAt));
    }),
    /**
     * Start a Stripe Checkout (payment mode) for an outstanding invoice. Records
     * a pending portalPayment and returns the hosted checkout URL. Confirmation
     * happens via `confirm` (no global webhook route needed — keeps portal isolated).
     */
    createInvoiceCheckout: portalProcedure
      .input(z.object({ invoiceId: z.number().int().positive(), origin: z.string().url() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const customerId = cid(ctx);
        const [invoice] = await db
          .select()
          .from(quickbooksSalesDocuments)
          .where(and(eq(quickbooksSalesDocuments.id, input.invoiceId), eq(quickbooksSalesDocuments.customerId, customerId), eq(quickbooksSalesDocuments.docType, "invoice")))
          .limit(1);
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
        if (invoice.voided || invoice.status === "paid" || invoice.status === "void") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This invoice is not payable." });
        }
        const due = toNumber(invoice.balance ?? invoice.totalAmount);
        if (due <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "This invoice has no outstanding balance." });

        const amountCents = Math.round(due * 100);
        const label = invoice.docNumber ? `Invoice ${invoice.docNumber}` : `Invoice #${invoice.id}`;

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          customer_email: ctx.portal.customer.email ?? ctx.portal.account.email,
          client_reference_id: `portal:${customerId}`,
          metadata: { type: "portal_invoice", portal_customer_id: String(customerId), invoice_id: String(invoice.id) },
          line_items: [
            {
              price_data: {
                currency: (invoice.currency ?? "USD").toLowerCase(),
                product_data: { name: label, description: `Payment for ${label}` },
                unit_amount: amountCents,
              },
              quantity: 1,
            },
          ],
          success_url: `${input.origin}/portal/payments?session_id={CHECKOUT_SESSION_ID}&status=success`,
          cancel_url: `${input.origin}/portal/invoices?status=cancelled`,
        });

        await db.insert(portalPayments).values({
          customerId,
          invoiceId: invoice.id,
          invoiceNumber: invoice.docNumber,
          amount: due.toFixed(2),
          currency: invoice.currency ?? "USD",
          method: "card",
          status: "pending",
          stripeSessionId: session.id,
        });

        return { checkoutUrl: session.url };
      }),
    /** Reconcile a completed Checkout Session (called on success redirect). */
    confirm: portalProcedure
      .input(z.object({ sessionId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const customerId = cid(ctx);
        const [payment] = await db
          .select()
          .from(portalPayments)
          .where(and(eq(portalPayments.stripeSessionId, input.sessionId), eq(portalPayments.customerId, customerId)))
          .limit(1);
        if (!payment) throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found." });
        if (payment.status === "succeeded") return { status: "succeeded" as const };

        const session = await getCheckoutSession(input.sessionId);
        const paid = session.payment_status === "paid";
        await db
          .update(portalPayments)
          .set({
            status: paid ? "succeeded" : "failed",
            paidAt: paid ? new Date() : null,
            stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : payment.stripePaymentIntentId,
          })
          .where(eq(portalPayments.id, payment.id));
        return { status: paid ? ("succeeded" as const) : ("failed" as const) };
      }),
  }),

  // ── 5. DOCUMENTS ──────────────────────────────────────────────────────────
  documents: router({
    list: portalProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db
        .select()
        .from(customerDocuments)
        .where(and(eq(customerDocuments.customerId, cid(ctx)), eq(customerDocuments.visibleToCustomer, true)))
        .orderBy(desc(customerDocuments.createdAt));
    }),
    /** Resolve a fresh download URL for a document the customer owns. */
    getDownloadUrl: portalProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [doc] = await db
        .select()
        .from(customerDocuments)
        .where(and(eq(customerDocuments.id, input.id), eq(customerDocuments.customerId, cid(ctx)), eq(customerDocuments.visibleToCustomer, true)))
        .limit(1);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
      if (doc.storageKey) {
        const resolved = await storageGet(doc.storageKey).catch(() => null);
        if (resolved?.url) return { url: resolved.url };
      }
      if (doc.url) return { url: doc.url };
      throw new TRPCError({ code: "NOT_FOUND", message: "This document is not available for download." });
    }),
    /** Customer uploads a document (base64 payload). */
    upload: portalProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          category: z.enum(["proposal", "invoice", "permit", "warranty", "contract", "report", "photo", "other"]).default("other"),
          fileName: z.string().min(1).max(255),
          mimeType: z.string().max(127).optional(),
          dataBase64: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const customerId = cid(ctx);
        const buffer = Buffer.from(input.dataBase64, "base64");
        if (buffer.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded file is empty." });
        if (buffer.length > 15 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "Files must be 15 MB or smaller." });

        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `portal/${customerId}/${Date.now()}_${safeName}`;
        const stored = await storagePut(key, buffer, input.mimeType ?? "application/octet-stream");

        await db.insert(customerDocuments).values({
          customerId,
          category: input.category,
          title: input.title,
          fileName: input.fileName,
          url: stored.url,
          storageKey: stored.key,
          mimeType: input.mimeType,
          sizeBytes: buffer.length,
          uploadedBy: "customer",
          visibleToCustomer: true,
        });
        return { success: true };
      }),
  }),

  // ── 6. EQUIPMENT ──────────────────────────────────────────────────────────
  equipment: router({
    list: portalProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const rows = await db
        .select()
        .from(customerEquipment)
        .where(eq(customerEquipment.customerId, cid(ctx)))
        .orderBy(desc(customerEquipment.installedAt));
      const props = await db.select().from(properties).where(eq(properties.customerId, cid(ctx)));
      const propLabel = new Map(props.map((p) => [p.id, p.addressLine1 ?? p.label ?? `Property #${p.id}`]));
      return rows.map((e) => ({ ...e, propertyLabel: e.propertyId ? propLabel.get(e.propertyId) ?? null : null }));
    }),
    get: portalProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const [row] = await db
        .select()
        .from(customerEquipment)
        .where(and(eq(customerEquipment.id, input.id), eq(customerEquipment.customerId, cid(ctx))))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Equipment not found." });
      const warranties = await db
        .select()
        .from(equipmentWarranties)
        .where(and(eq(equipmentWarranties.equipmentId, row.id), eq(equipmentWarranties.customerId, cid(ctx))));
      return { ...row, warranties };
    }),
  }),

  // ── 7. WARRANTY ───────────────────────────────────────────────────────────
  warranty: router({
    list: portalProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const rows = await db
        .select()
        .from(equipmentWarranties)
        .where(eq(equipmentWarranties.customerId, cid(ctx)))
        .orderBy(desc(equipmentWarranties.expiresAt));
      const equip = await db.select().from(customerEquipment).where(eq(customerEquipment.customerId, cid(ctx)));
      const equipLabel = new Map(equip.map((e) => [e.id, [e.make, e.model].filter(Boolean).join(" ") || e.category || `Unit #${e.id}`]));
      return rows.map((w) => ({ ...w, equipmentLabel: w.equipmentId ? equipLabel.get(w.equipmentId) ?? null : null }));
    }),
  }),

  // ── 8. MAINTENANCE AGREEMENTS ─────────────────────────────────────────────
  maintenance: router({
    list: portalProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db
        .select()
        .from(maintenanceAgreements)
        .where(eq(maintenanceAgreements.customerId, cid(ctx)))
        .orderBy(desc(maintenanceAgreements.startsAt));
    }),
    get: portalProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const [row] = await db
        .select()
        .from(maintenanceAgreements)
        .where(and(eq(maintenanceAgreements.id, input.id), eq(maintenanceAgreements.customerId, cid(ctx))))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Agreement not found." });
      return row;
    }),
  }),

  // ── 9. APPOINTMENTS ───────────────────────────────────────────────────────
  appointments: router({
    list: portalProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const rows = await db
        .select()
        .from(appointments)
        .where(eq(appointments.customerId, cid(ctx)))
        .orderBy(desc(appointments.scheduledAt));
      return rows.map((a) => ({
        id: a.id,
        appointmentType: a.appointmentType,
        serviceType: a.serviceType,
        scheduledAt: a.scheduledAt,
        preferredDate: a.preferredDate,
        preferredTime: a.preferredTime,
        durationMinutes: a.durationMinutes,
        status: a.status,
        priority: a.priority,
        issueDescription: a.issueDescription,
        notes: a.notes,
      }));
    }),
    /** Customer requests a new appointment (created as pending for staff to confirm). */
    request: portalProcedure
      .input(
        z.object({
          appointmentType: z.enum([
            "assessment", "estimate", "service_call", "installation", "maintenance",
            "warranty", "follow_up", "inspection", "sales_visit", "other",
            "free_consultation", "technician_dispatch", "maintenance_plan", "commercial_assessment",
          ]),
          serviceType: z.string().max(100).optional(),
          preferredDate: z.string().min(1).max(100),
          preferredTime: z.string().min(1).max(100),
          issueDescription: z.string().max(2000).optional(),
          propertyId: z.number().int().positive().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const customer = ctx.portal.customer;

        let propertyAddress: string | null = null;
        if (input.propertyId) {
          const [prop] = await db
            .select()
            .from(properties)
            .where(and(eq(properties.id, input.propertyId), eq(properties.customerId, customer.id)))
            .limit(1);
          if (!prop) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found." });
          propertyAddress = [prop.addressLine1, prop.city, prop.state].filter(Boolean).join(", ") || null;
        }

        await db.insert(appointments).values({
          fullName: customer.displayName,
          phone: customer.phone ?? "N/A",
          email: customer.email,
          propertyAddress,
          propertyType: customer.type === "commercial" ? "commercial" : "residential",
          appointmentType: input.appointmentType,
          serviceType: input.serviceType,
          preferredDate: input.preferredDate,
          preferredTime: input.preferredTime,
          issueDescription: input.issueDescription,
          status: "pending",
          source: "repeat_customer",
          bookedBy: "portal",
          customerId: customer.id,
          propertyId: input.propertyId ?? null,
        });
        return { success: true };
      }),
    /** Customer requests cancellation of an upcoming appointment. */
    cancel: portalProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [appt] = await db
        .select()
        .from(appointments)
        .where(and(eq(appointments.id, input.id), eq(appointments.customerId, cid(ctx))))
        .limit(1);
      if (!appt) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found." });
      if (appt.status === "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "Completed appointments can't be cancelled." });
      await db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, appt.id));
      return { success: true };
    }),
  }),

  // ── 10. SERVICE HISTORY ───────────────────────────────────────────────────
  serviceHistory: router({
    list: portalProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const rows = await db
        .select()
        .from(jobs)
        .where(eq(jobs.customerId, cid(ctx)))
        .orderBy(desc(jobs.createdAt));
      return rows.map((j) => ({
        id: j.id,
        jobNumber: j.jobNumber,
        title: j.title,
        jobType: j.jobType,
        status: j.status,
        priority: j.priority,
        customerVisibleNotes: j.customerVisibleNotes,
        completionSummary: j.completionSummary,
        warrantyStatus: j.warrantyStatus,
        scheduledStartAt: j.scheduledStartAt,
        completedAt: j.completedAt ?? j.actualCompletionAt,
        createdAt: j.createdAt,
      }));
    }),
    get: portalProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const [job] = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, input.id), eq(jobs.customerId, cid(ctx))))
        .limit(1);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Service record not found." });
      const timeline = await db
        .select()
        .from(jobStatusHistory)
        .where(eq(jobStatusHistory.jobId, job.id))
        .orderBy(desc(jobStatusHistory.createdAt));
      return {
        id: job.id,
        jobNumber: job.jobNumber,
        title: job.title,
        description: job.description,
        jobType: job.jobType,
        status: job.status,
        customerVisibleNotes: job.customerVisibleNotes,
        completionSummary: job.completionSummary,
        equipmentServiced: job.equipmentServiced,
        warrantyStatus: job.warrantyStatus,
        scheduledStartAt: job.scheduledStartAt,
        completedAt: job.completedAt ?? job.actualCompletionAt,
        createdAt: job.createdAt,
        // Only expose the status transitions the customer should see (no internal notes/actors).
        timeline: timeline.map((t) => ({ toStatus: t.toStatus, at: t.createdAt })),
      };
    }),
  }),

  // ── 11. MESSAGING ─────────────────────────────────────────────────────────
  messaging: router({
    listThreads: portalProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db
        .select()
        .from(portalMessageThreads)
        .where(eq(portalMessageThreads.customerId, cid(ctx)))
        .orderBy(desc(portalMessageThreads.lastMessageAt));
    }),
    getThread: portalProcedure.input(z.object({ threadId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const thread = await assertOwnedThread(db, input.threadId, cid(ctx));
      const messages = await db
        .select()
        .from(portalMessages)
        .where(eq(portalMessages.threadId, thread.id))
        .orderBy(portalMessages.createdAt);
      return { thread, messages };
    }),
    startThread: portalProcedure
      .input(z.object({ subject: z.string().min(1).max(255), body: z.string().min(1).max(5000) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const customerId = cid(ctx);
        await db.insert(portalMessageThreads).values({ customerId, subject: input.subject, status: "open", staffUnread: 1 });
        const [thread] = await db
          .select()
          .from(portalMessageThreads)
          .where(eq(portalMessageThreads.customerId, customerId))
          .orderBy(desc(portalMessageThreads.id))
          .limit(1);
        await db.insert(portalMessages).values({ threadId: thread.id, customerId, sender: "customer", body: input.body });
        return { success: true, threadId: thread.id };
      }),
    sendMessage: portalProcedure
      .input(z.object({ threadId: z.number().int().positive(), body: z.string().min(1).max(5000) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const customerId = cid(ctx);
        await assertOwnedThread(db, input.threadId, customerId);
        await appendMessage(db, { threadId: input.threadId, customerId, sender: "customer", body: input.body });
        return { success: true };
      }),
    /** Mark all staff messages in a thread as read by the customer. */
    markRead: portalProcedure.input(z.object({ threadId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const customerId = cid(ctx);
      await assertOwnedThread(db, input.threadId, customerId);
      await db.update(portalMessageThreads).set({ customerUnread: 0 }).where(eq(portalMessageThreads.id, input.threadId));
      return { success: true };
    }),
  }),
});

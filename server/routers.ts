import { COOKIE_NAME } from "@shared/const";
import { LEAD_STAGE_ENUM, buildLeadCapturePatch, deriveContactRelationship } from "@shared/leadPipeline";
import { extractAttribution } from "@shared/attribution";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { enforceRateLimit, getClientIp, HOUR_MS } from "./_core/rateLimit";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { handleVapiWebhook } from "./integrations/vapi";
import { handleVapiToolCalls } from "./integrations/vapiTools";
import { authenticateVapiToolCall } from "./integrations/vapiToolAuth";
import { handleIncomingSms } from "./integrations/aiVaSms";
import { notifyOwner } from "./_core/notification";
import { googleAdsRouter } from "./routers/googleAds";
import { metaAdsRouter } from "./routers/metaAds";
import { teamAuthRouter } from "./routers/teamAuth";
import { smsCampaignsRouter } from "./routers/smsCampaigns";
import { conversationCrmRouter } from "./routers/conversationCrm";
import { rebateCalculatorRouter } from "./routers/rebateCalculator";
import { heygenRouter } from "./routers/heygen";
import { coursesRouter } from "./courses-router";
import { paymentRouter } from "./payment-router";
import { runCampaignAnalysis } from "./services/campaignEngine";
import { generateSocialPost } from "./integrations/ai-content-generator";
import { publishSocialPost, retrySocialPost, PublishError } from "./services/socialPublisher";
import * as marketingCanary from "./services/marketingCanary";
import { redactCredentials } from "./services/credentialSafety";
import { takeoffsRouter } from "./routers/takeoffs";
import { customersRouter, findCustomerIdByPhone, normalizePhone, computeRelationships } from "./routers/customers";
import { jobsRouter } from "./routers/jobs";
import { dispatchAuditRouter } from "./routers/dispatchAudit";
import { quickbooksRouter } from "./routers/quickbooks";
import { opportunitiesRouter } from "./routers/opportunities";
import { seoRouter } from "./routers/seo";
import { attributionRouter } from "./routers/attribution";
import { analyticsRouter } from "./routers/analytics";
import { executiveDashboardsRouter } from "./routers/executiveDashboards";
import { gbpRouter } from "./routers/gbp";
import { googleCalendarRouter } from "./routers/googleCalendar";
import { portalRouter } from "./routers/portal";
import { parsePreferredDateTime } from "./services/appointmentTime";
import { sendAppointmentConfirmationSms } from "./services/appointmentSms";
import {
  appointments as appointmentsTable,
  teamMembers as teamMembersTable,
  appointmentAttendees as appointmentAttendeesTable,
  customers as customersTable,
  leadCaptures as leadCapturesTable,
} from "../drizzle/schema";
import { resolveTeamMemberId, dayRangeInTimeZone, categorizeFieldJobs } from "../shared/fieldApp";
import {
  normalizeAttendees,
  replaceAttendees,
  syncAppointmentInvites,
  type AttendeeInput,
} from "./services/appointmentInvites";
import { resolveAppointmentContext } from "./services/appointmentNormalization";
import { APPOINTMENT_TYPE_ENUM } from "../shared/appointmentTypes";
import { and as dAnd, eq as dEq, or as dOr, sql as dSql, gte as dGte, lte as dLte, lt as dLt, asc as dAsc, desc as dDesc, isNull as dIsNull } from "drizzle-orm";

/** Zod shape for an attendee coming from the appointment dialog. */
const attendeeInputSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(255).optional().nullable(),
  role: z.enum(["organizer", "team_member", "customer", "guest"]),
  teamMemberId: z.number().int().optional().nullable(),
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  googleAds: googleAdsRouter,
  metaAds: metaAdsRouter,
  teamAuth: teamAuthRouter,
  smsCampaigns: smsCampaignsRouter,
  conversationCrm: conversationCrmRouter,
  rebateCalculator: rebateCalculatorRouter,
  heygen: heygenRouter,
  courses: coursesRouter,
  payment: paymentRouter,
  takeoffs: takeoffsRouter,
  customers: customersRouter,
  jobs: jobsRouter,
  dispatchAudit: dispatchAuditRouter,
  quickbooks: quickbooksRouter,
  opportunities: opportunitiesRouter,
  seo: seoRouter,
  attribution: attributionRouter,
  analytics: analyticsRouter,
  executiveDashboards: executiveDashboardsRouter,
  gbp: gbpRouter,
  googleCalendar: googleCalendarRouter,
  // Customer-facing self-service portal (separate auth realm; see server/routers/portal).
  portal: portalRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    saveVideoInterests: protectedProcedure
      .input(z.object({ interests: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
        await db.saveUserVideoInterests(ctx.user.id, input.interests.join(','));
        return { success: true };
      }),
    getVideoInterests: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      const raw = user?.videoInterests ?? '';
      return { interests: raw ? raw.split(',') : [] };
    }),
  }),

  // Lead management router
  leads: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          contact: z.string().min(1),
          contactType: z.enum(["phone", "email"]),
          source: z.string().min(1),
          service: z.string().min(1),
          status: z.enum(["new", "contacted", "quoted", "won", "lost"]).default("new"),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.createLead(input);
        
        // Send email notification to owner
        await notifyOwner({
          title: `New Lead: ${input.name}`,
          content: `A new lead has been logged in the tracker:\n\nName: ${input.name}\nContact: ${input.contact} (${input.contactType})\nSource: ${input.source}\nService: ${input.service}\nStatus: ${input.status}\nNotes: ${input.notes || "None"}\n\nLog in to your marketing dashboard to follow up.`,
        });
        
        return { success: true };
      }),
    
    list: protectedProcedure.query(async () => {
      return await db.getAllLeads();
    }),
    
    updateStatus: protectedProcedure
      .input(
        z.object({
          leadId: z.number(),
          status: z.enum(["new", "contacted", "quoted", "won", "lost"]),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateLeadStatus(input.leadId, input.status);
        return { success: true };
      }),
  }),

  // Lead capture router (public - no auth required)
  leadCaptures: router({
    create: publicProcedure
      .input(
        z.object({
          email: z.string().email().optional(),
          phone: z.string().optional(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          name: z.string().optional(),
          captureType: z.enum(["exit_popup", "inline_form", "newsletter", "download_gate", "quick_quote", "qualify_form", "scroll_popup_residential", "scroll_popup_commercial", "exit_popup_residential", "exit_popup_commercial", "lp_heat_pump", "lp_commercial_vrv", "lp_emergency", "lp_fb_residential", "lp_fb_commercial", "lp_rebate_guide", "lp_maintenance", "lp_referral_partner", "lp_maintenance_subscription", "career_application", "partnership_inquiry", "pseg_checklist_download"]),
          pageUrl: z.string().optional(),
          message: z.string().optional(),
          // First-touch marketing attribution: the client sends document.referrer
          // (empty string for a direct visit). UTM/gclid are parsed from pageUrl.
          referrer: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Rate limit (Task 5): public capture endpoint — 20/IP/hour
        enforceRateLimit([{ bucket: "leadCapture.ip", key: getClientIp(ctx), max: 20, windowMs: HOUR_MS }]);
        // Validate that at least email or phone is provided
        if (!input.email && !input.phone) {
          throw new Error("Either email or phone is required");
        }

        // Derive first-touch attribution from the landing URL + referrer. Self-host
        // (the landing page's own host) is passed so internal navigation is not
        // miscounted as a referral. `channel` defaults to "unknown" — never organic.
        let selfHost: string | undefined;
        try {
          if (input.pageUrl && /^https?:\/\//i.test(input.pageUrl)) selfHost = new URL(input.pageUrl).host;
        } catch { /* ignore malformed pageUrl */ }
        const attribution = extractAttribution(input.pageUrl, input.referrer, selfHost);
        const { referrer: _referrer, ...captureInput } = input;

        await db.createLeadCapture({ ...captureInput, ...attribution });
        
        // Send email notification to owner
        const contactInfo = [];
        if (input.firstName || input.lastName) {
          const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ');
          contactInfo.push(`Name: ${fullName}`);
        } else if (input.name) {
          contactInfo.push(`Name: ${input.name}`);
        }
        if (input.email) contactInfo.push(`Email: ${input.email}`);
        if (input.phone) contactInfo.push(`Phone: ${input.phone}`);
        
        await notifyOwner({
          title: `New Lead Capture: ${input.captureType.replace(/_/g, ' ')}`,
          content: `A visitor has submitted their contact information:\n\n${contactInfo.join('\n')}\nCapture Type: ${input.captureType}\nPage: ${input.pageUrl || 'Unknown'}\nMessage: ${input.message || 'None'}\n\nLog in to your dashboard to follow up.`,
        });

        // Send email notifications via Resend
        const resendApiKey = process.env.RESEND_API_KEY;
        if (resendApiKey) {
          const leadName = input.name || [input.firstName, input.lastName].filter(Boolean).join(' ') || "Visitor";
          const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' });

          // Parse message fields into a map for structured display
          const msgFields: Record<string, string> = {};
          (input.message ?? "").split('\n').forEach(line => {
            const idx = line.indexOf(': ');
            if (idx > 0) msgFields[line.slice(0, idx).trim()] = line.slice(idx + 2).trim();
          });

          // Determine email subject and content based on capture type
          const isCareer = input.captureType === "career_application";
          const isPartnership = input.captureType === "partnership_inquiry";
          const isChecklist = input.captureType === "pseg_checklist_download";
          const clientSubject = isChecklist
            ? "Your Free PSE&G Rebate Checklist – Mechanical Enterprise"
            : isCareer
            ? "We received your application – Mechanical Enterprise"
            : isPartnership
            ? "We received your partnership inquiry – Mechanical Enterprise"
            : "We received your quote request – Mechanical Enterprise";
          const clientBody = isChecklist
            ? ""
            : isCareer
            ? "We've received your job application and our team will review it within <strong>3-5 business days</strong>."
            : isPartnership
            ? "We've received your partnership inquiry and will be in touch within <strong>24-48 hours</strong> to discuss next steps."
            : "We've received your quote request and a member of our team will follow up with you within <strong>24 hours</strong>.";
          const salesSubject = isChecklist
            ? `PSE&G Checklist Download – ${leadName}`
            : isCareer
            ? `New Job Application – ${leadName}`
            : isPartnership
            ? `New Partnership Inquiry – ${leadName}`
            : `New Quote Request – ${leadName}`;
          const salesHeading = isChecklist ? "PSE&G Checklist Download" : isCareer ? "New Job Application" : isPartnership ? "New Partnership Inquiry" : "New Quote Request";

          // 1. Client confirmation email (or checklist delivery)
          if (input.email) {
            const checklistHtml = isChecklist ? `
                    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
                      <h2 style="color:#1e3a5f">Your PSE&G Rebate Checklist</h2>
                      <p>Hi ${leadName}, here's your complete NJ PSE&G Rebate Checklist. Use this to make sure your application doesn't get rejected.</p>
                      <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:20px 0">
                        <h3 style="color:#1e3a5f;margin-top:0">Before You Apply — Required Documents</h3>
                        <table style="width:100%;border-collapse:collapse">
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; Current equipment age, make, and model number</td></tr>
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; PSE&G utility account number (from your bill)</td></tr>
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; Property address must match PSE&G account exactly</td></tr>
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; Proof of property ownership (deed or tax record)</td></tr>
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; If renting: written landlord authorization</td></tr>
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; Photos of existing HVAC equipment and labels</td></tr>
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; Square footage of conditioned space</td></tr>
                        </table>
                        <h3 style="color:#1e3a5f">Equipment Requirements</h3>
                        <table style="width:100%;border-collapse:collapse">
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; New equipment must be ENERGY STAR certified</td></tr>
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; Heat pumps: minimum 15.2 SEER2 / 7.8 HSPF2</td></tr>
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; Equipment must be on PSE&G's qualified products list</td></tr>
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; Installation by a PSE&G-certified contractor (required)</td></tr>
                        </table>
                        <h3 style="color:#1e3a5f">After Installation — Critical Timing</h3>
                        <table style="width:100%;border-collapse:collapse">
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; Submit rebate application within 90 days of installation</td></tr>
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; Include paid invoice with contractor license number</td></tr>
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; Include AHRI certificate for new equipment</td></tr>
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; Keep all permits and inspection records</td></tr>
                          <tr><td style="padding:8px 0;border-bottom:1px solid #eee">&#9744; Allow 6-8 weeks for rebate processing</td></tr>
                        </table>
                      </div>
                      <div style="background:#1e3a5f;color:#fff;border-radius:8px;padding:20px;margin:20px 0;text-align:center">
                        <h3 style="margin-top:0;color:#ff6b35">Skip the Paperwork — We Handle Everything</h3>
                        <p style="margin-bottom:16px;font-size:14px">As a PSE&G certified contractor, we file every item on this checklist for you at no extra cost.</p>
                        <a href="https://mechanicalenterprise.com/pseg-rebate-contractor-nj" style="background:#ff6b35;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">Book Free Assessment</a>
                      </div>
                      <div style="text-align:center;margin:24px 0">
                        <a href="tel:8624191763" style="background:#ff6b35;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">Call Us Now: (862) 419-1763</a>
                      </div>
                      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
                      <p style="color:#999;font-size:12px">Mechanical Enterprise LLC &bull; PSE&G Certified Contractor &bull; WMBE/SBE Certified &bull; <a href="https://mechanicalenterprise.com">mechanicalenterprise.com</a></p>
                    </div>` : "";

            try {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${resendApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: "Mechanical Enterprise <noreply@mechanicalenterprise.com>",
                  to: [input.email],
                  subject: clientSubject,
                  html: isChecklist ? checklistHtml : `
                    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
                      <h2 style="color:#1e3a5f">Thank you, ${leadName}!</h2>
                      <p>${clientBody}</p>
                      <p>Need immediate assistance? Give us a call — we're happy to help.</p>
                      <div style="text-align:center;margin:32px 0">
                        <a href="tel:8624239396" style="background:#ff6b35;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">Call Us Now: (862) 423-9396</a>
                      </div>
                      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
                      <p style="color:#999;font-size:12px">Mechanical Enterprise LLC &bull; Essex County, NJ &bull; <a href="https://mechanicalenterprise.com">mechanicalenterprise.com</a></p>
                    </div>
                  `,
                }),
              });
            } catch (e) {
              console.error("Lead capture client email error:", e);
            }
          }

          // 2. Sales team notification email
          try {
            // Build details section based on capture type
            let detailsHtml = "";
            if (isCareer) {
              detailsHtml = `
                <h3 style="margin-bottom:4px">Application Details</h3>
                <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                  <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666;width:40%">Position</td><td style="padding:6px 0;font-weight:bold">${msgFields["Position"] ?? "Not specified"}</td></tr>
                  <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Experience</td><td style="padding:6px 0">${msgFields["Experience"] ?? "Not specified"}</td></tr>
                  <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Licensed/Certified</td><td style="padding:6px 0">${msgFields["Licensed"] ?? "Not specified"}</td></tr>
                  <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Cover Letter</td><td style="padding:6px 0">${msgFields["Cover Letter"] ?? "None"}</td></tr>
                </table>`;
            } else if (isPartnership) {
              detailsHtml = `
                <h3 style="margin-bottom:4px">Partnership Details</h3>
                <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                  <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666;width:40%">Company</td><td style="padding:6px 0;font-weight:bold">${msgFields["Company"] ?? "Not specified"}</td></tr>
                  <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Partnership Type</td><td style="padding:6px 0">${msgFields["Partnership Type"] ?? "Not specified"}</td></tr>
                  <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Website</td><td style="padding:6px 0">${msgFields["Website"] ?? "N/A"}</td></tr>
                  <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Message</td><td style="padding:6px 0">${msgFields["Message"] ?? "None"}</td></tr>
                </table>`;
            } else {
              const serviceLine = msgFields["Service"] || "Not specified";
              // Remove the "Service: X" prefix from message to avoid duplication
              const cleanMessage = (input.message ?? "").replace(/^Service:.*\n\n?/, "").trim();
              detailsHtml = `
                <h3 style="margin-bottom:4px">Request Details</h3>
                <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                  <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666;width:40%">Service Requested</td><td style="padding:6px 0;font-weight:bold">${serviceLine}</td></tr>
                  ${cleanMessage ? `<tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Message</td><td style="padding:6px 0">${cleanMessage}</td></tr>` : ""}
                </table>`;
            }

            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "Mechanical Enterprise <noreply@mechanicalenterprise.com>",
                to: ["sales@mechanicalenterprise.com"],
                subject: salesSubject,
                html: `
                  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
                    <h2 style="color:#1e3a5f">${salesHeading}</h2>
                    <h3 style="margin-bottom:4px">Contact Info</h3>
                    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                      <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666;width:40%">Name</td><td style="padding:6px 0">${leadName}</td></tr>
                      <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0">${input.email ?? "N/A"}</td></tr>
                      <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0">${input.phone ?? "N/A"}</td></tr>
                    </table>
                    ${detailsHtml}
                    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                      <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666;width:40%">Page</td><td style="padding:6px 0">${input.pageUrl ?? "Unknown"}</td></tr>
                      <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Submitted</td><td style="padding:6px 0">${timestamp}</td></tr>
                      <tr style="border-bottom:1px solid #eee"><td style="padding:6px 0;color:#666">Source</td><td style="padding:6px 0">${input.captureType.replace(/_/g, " ")}</td></tr>
                    </table>
                    <p style="color:#999;font-size:12px">Log in to the <a href="https://mechanicalenterprise.com/lead-dashboard">dashboard</a> to follow up.</p>
                  </div>
                `,
              }),
            });
          } catch (e) {
            console.error("Lead capture sales email error:", e);
          }
        }

        return { success: true };
      }),
    
    list: protectedProcedure
      .input(
        z.object({
          status: z.enum(LEAD_STAGE_ENUM).optional(),
          captureType: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().optional().default(100),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ input }) => {
        const leads = await db.getAllLeadCaptures(input);
        // Attach the SAME server-derived relationship the Contacts list uses,
        // so a lead reads identically in both screens (stage alone is not enough
        // — an appointment or won job also counts).
        const dbi = await db.getDb();
        if (!dbi || leads.length === 0) {
          return leads.map((l: any) => ({ ...l, relationship: deriveContactRelationship({ leadStages: [l.status] }) }));
        }
        const relationships = await computeRelationships(
          dbi,
          leads.map((l: any) => ({ id: l.id, customerId: l.customerId, phone: l.phone, email: l.email, leadStages: [l.status] })),
        );
        return leads.map((l: any) => ({ ...l, relationship: relationships.get(l.id) ?? deriveContactRelationship({ leadStages: [l.status] }) }));
      }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(LEAD_STAGE_ENUM),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateLeadCaptureStatus(input.id, input.status);
        return { success: true };
      }),

    addNote: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          notes: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateLeadCaptureNotes(input.id, input.notes);
        return { success: true };
      }),

    /** Edit lead details from the Lead Inbox popup. */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          firstName: z.string().max(255).optional().nullable(),
          lastName: z.string().max(255).optional().nullable(),
          phone: z.string().max(50).optional().nullable(),
          email: z.string().email().max(320).optional().nullable().or(z.literal("").transform(() => null)),
          /** Requested service — stored on `message`. */
          message: z.string().max(2000).optional().nullable(),
          /** Source — stored on `captureType` (validated against the DB enum). */
          captureType: z.string().max(100).optional(),
          assignedTo: z.string().max(255).optional().nullable(),
          notes: z.string().max(5000).optional().nullable(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...edit } = input;
        await db.updateLeadCapture(id, buildLeadCapturePatch(edit));
        return { success: true };
      }),

    /**
     * Appointments tied to a lead — by customerId when converted, else a
     * phone/email fallback so pre-conversion bookings still show. Includes the
     * assigned technician's name for the popup.
     */
    appointments: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const dbi = await db.getDb();
        if (!dbi) return [];
        const cap = (await dbi.select().from(leadCapturesTable).where(dEq(leadCapturesTable.id, input.id)).limit(1))[0];
        if (!cap) return [];
        const phoneKey = normalizePhone(cap.phone);
        const emailKey = cap.email?.trim().toLowerCase() || null;
        const conds = [];
        if (cap.customerId) conds.push(dEq(appointmentsTable.customerId, cap.customerId));
        if (phoneKey) conds.push(dSql`RIGHT(REGEXP_REPLACE(${appointmentsTable.phone}, '[^0-9]', ''), 10) = ${phoneKey}`);
        if (emailKey) conds.push(dSql`LOWER(${appointmentsTable.email}) = ${emailKey}`);
        if (conds.length === 0) return [];
        return await dbi
          .select({
            id: appointmentsTable.id,
            appointmentType: appointmentsTable.appointmentType,
            serviceType: appointmentsTable.serviceType,
            scheduledAt: appointmentsTable.scheduledAt,
            preferredDate: appointmentsTable.preferredDate,
            preferredTime: appointmentsTable.preferredTime,
            status: appointmentsTable.status,
            assignedToId: appointmentsTable.assignedToId,
            assigneeName: teamMembersTable.name,
            googleCalendarEventId: appointmentsTable.googleCalendarEventId,
          })
          .from(appointmentsTable)
          .leftJoin(teamMembersTable, dEq(teamMembersTable.id, appointmentsTable.assignedToId))
          .where(dOr(...conds))
          .orderBy(dDesc(appointmentsTable.scheduledAt), dDesc(appointmentsTable.createdAt))
          .limit(50);
      }),

    stats: protectedProcedure.query(async () => {
      return await db.getLeadCaptureStats();
    }),

    analytics: protectedProcedure.query(async () => {
      return await db.getLeadCaptureAnalytics();
    }),
  }),

  // AI Virtual Assistant router
  aiVa: router({
    saveCredentials: adminProcedure
      .input(
        z.object({
          service: z.enum(["vapi", "facebook", "google_business", "google_ads_config"] as const),
          credentials: z.record(z.string(), z.string()),
        })
      )
      .mutation(async ({ input }) => {
        // Store credentials securely (encrypted)
        const credentials = input.credentials as Record<string, string>;
        await db.saveAiVaCredentials(input.service, credentials);
        return { success: true };
      }),

    // SECURITY: returns only non-secret metadata (connected + which keys are
    // configured). Credential VALUES (tokens/keys/secrets) never leave the
    // server — see redactCredentials.
    getCredentials: protectedProcedure
      .input(z.object({ service: z.enum(["vapi", "facebook", "google_business", "google_ads_config"] as const) }))
      .query(async ({ input }) => {
        const creds = await db.getAiVaCredentials(input.service);
        return redactCredentials(input.service, creds);
      }),

    getAllCredentials: protectedProcedure
      .query(async () => {
        // Return non-secret status only — no raw or encrypted credential values.
        const services = ["vapi", "facebook", "google_business", "google_ads_config"] as const;
        const summaries = await Promise.all(
          services.map(async (service) => {
            const creds = await db.getAiVaCredentials(service);
            return redactCredentials(service, creds);
          })
        );
        // Only services that actually have credentials configured.
        return summaries.filter((s) => s.connected);
      }),

    listCallLogs: protectedProcedure
      .input(
        z.object({
          limit: z.number().optional().default(50),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ input }) => {
        return await db.getCallLogs(input.limit, input.offset);
      }),

    listSmsConversations: protectedProcedure
      .input(
        z.object({
          limit: z.number().optional().default(50),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ input }) => {
        return await db.getSmsConversations(input.limit, input.offset);
      }),

    listSocialPosts: protectedProcedure
      .input(
        z.object({
          status: z.enum(["draft", "scheduled", "posted", "failed"] as const).optional(),
          limit: z.number().optional().default(50),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ input }) => {
        return await db.getSocialPosts(input.status, input.limit, input.offset);
      }),

    getAnalytics: protectedProcedure
      .input(
        z.object({
          startDate: z.string(),
          endDate: z.string(),
        })
      )
      .query(async ({ input }) => {
        return await db.getAiVaAnalytics(input.startDate, input.endDate);
      }),

    // Generate AI content for a social post
    generatePostContent: protectedProcedure
      .input(
        z.object({
          platform: z.enum(["facebook", "instagram", "google_business", "nextdoor"] as const),
          contentType: z.enum(["hvac_tip", "rebate_alert", "seasonal_advice", "energy_savings", "faq", "customer_testimonial", "maintenance_reminder", "before_after"] as const),
        })
      )
      .mutation(async ({ input }) => {
        const result = await generateSocialPost(input.contentType, input.platform);
        return result;
      }),

    // Schedule a post (save to DB as scheduled)
    schedulePost: protectedProcedure
      .input(
        z.object({
          platform: z.enum(["facebook", "instagram", "google_business", "nextdoor"] as const),
          content: z.string().min(1),
          contentType: z.string().optional(),
          scheduledAt: z.string(), // ISO string
          mediaUrls: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.createSocialPost({
          platform: input.platform,
          content: input.content,
          contentType: input.contentType,
          scheduledAt: new Date(input.scheduledAt),
          mediaUrls: input.mediaUrls ? JSON.stringify(input.mediaUrls) : null,
          status: "scheduled",
        });
        return { success: true };
      }),

    // Publish a post to the selected platform. Idempotent: reuses an existing
    // record and never creates a duplicate external post. Persists failures.
    publishPost: protectedProcedure
      .input(
        z.object({
          // Optional existing socialPosts row to publish/reuse (e.g. a scheduled post).
          id: z.number().int().optional(),
          platform: z.enum(["facebook", "instagram", "google_business", "nextdoor"] as const),
          content: z.string().min(1),
          contentType: z.string().optional(),
          mediaUrls: z.array(z.string()).optional(),
          // Clicking "Publish" is an explicit human approval; defaults to approved.
          approved: z.boolean().optional().default(true),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const result = await publishSocialPost({
            id: input.id,
            platform: input.platform,
            content: input.content,
            contentType: input.contentType,
            mediaUrls: input.mediaUrls,
            approved: input.approved,
          });
          return { success: result.status !== "failed", ...result };
        } catch (err) {
          if (err instanceof PublishError) throw new Error(err.message);
          throw err;
        }
      }),

    // Retry a failed post on its existing row (no duplicate post / row).
    retryPost: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        try {
          const result = await retrySocialPost(input.id);
          return { success: result.status !== "failed", ...result };
        } catch (err) {
          if (err instanceof PublishError) throw new Error(err.message);
          throw err;
        }
      }),

    // Delete a scheduled post
    deletePost: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSocialPost(input.id);
        return { success: true };
      }),

    // ── Marketing Publishing Canary (ADMIN ONLY, temporary) ──────────────────
    // Exercises the live publish path against ONE connected destination using
    // fixed, clearly-labeled test content. No real content, no schema change.
    canary: router({
      status: adminProcedure.query(async () => {
        return await marketingCanary.getStatus();
      }),

      runSuccess: adminProcedure
        .input(
          z.object({
            platform: z.enum(marketingCanary.CANARY_PLATFORMS),
            // The UI confirmation checkbox — must be explicitly true.
            confirmed: z.literal(true),
          })
        )
        .mutation(async ({ input, ctx }) => {
          try {
            return await marketingCanary.runSuccessCanary(input.platform, ctx.user?.id ?? null, input.confirmed);
          } catch (err) {
            if (err instanceof marketingCanary.CanaryError) throw new Error(err.message);
            throw err;
          }
        }),

      runFailureRetry: adminProcedure
        .input(
          z.object({
            platform: z.enum(marketingCanary.CANARY_PLATFORMS),
            confirmed: z.literal(true),
          })
        )
        .mutation(async ({ input, ctx }) => {
          try {
            return await marketingCanary.runFailureRetryCanary(input.platform, ctx.user?.id ?? null, input.confirmed);
          } catch (err) {
            if (err instanceof marketingCanary.CanaryError) throw new Error(err.message);
            throw err;
          }
        }),

      audit: adminProcedure.query(async () => {
        return await marketingCanary.getAudit();
      }),

      safetyChecks: adminProcedure.query(async () => {
        return await marketingCanary.runSafetyChecks();
      }),

      deleteExternal: adminProcedure
        .input(z.object({ id: z.number().int() }))
        .mutation(async ({ input }) => {
          try {
            return await marketingCanary.deleteCanaryExternal(input.id);
          } catch (err) {
            if (err instanceof marketingCanary.CanaryError) throw new Error(err.message);
            throw err;
          }
        }),
    }),
  }),

  // Lead Scoring endpoints
  leadScoring: router({
    
    // Get scored leads list
    getScoredLeads: protectedProcedure
      .input(
        z.object({
          priority: z.enum(["hot", "warm", "cold"] as const).optional(),
          limit: z.number().optional().default(50),
        })
      )
      .query(async ({ input }) => {
        return await db.getLeadsByPriority(input.priority, input.limit);
      }),

    // Get top leads by score
    getTopLeads: protectedProcedure
      .input(
        z.object({
          limit: z.number().optional().default(10),
        })
      )
      .query(async ({ input }) => {
        return await db.getTopLeads(input.limit);
      }),

    // Get lead score statistics
    getScoreStats: protectedProcedure
      .query(async () => {
        return await db.getLeadScoreStats();
      }),

    // Get lead interaction data for scoring
    getLeadInteractions: protectedProcedure
      .input(
        z.object({
          leadId: z.number(),
        })
      )
      .query(async ({ input }) => {
        return await db.getLeadInteractionData(input.leadId);
      }),

    // Manually recalculate lead score
    recalculateScore: protectedProcedure
      .input(
        z.object({
          leadId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        // Get interaction data
        const interactions = await db.getLeadInteractionData(input.leadId);
        if (!interactions) {
          throw new Error("Lead not found");
        }

        // Import scoring service
        const { calculateLeadScore, calculatePriority } = await import("./services/leadScoring");

        // Calculate scores
        const callCount = interactions.calls?.length || 0;
        const smsCount = interactions.sms?.length || 0;
        const socialCount = interactions.social?.length || 0;

        const scoringData = {
          totalCalls: callCount,
          inboundCalls: interactions.calls?.filter(c => c.direction === 'inbound').length || 0,
          totalSms: smsCount,
          inboundSms: interactions.sms?.filter(s => s.direction === 'inbound').length || 0,
          socialInteractions: socialCount,
        };

        const breakdown = calculateLeadScore(scoringData);
        const priority = calculatePriority(breakdown.total);

        // Update database
        await db.updateLeadScore(
          input.leadId,
          breakdown.total,
          priority,
          JSON.stringify(breakdown),
          callCount + smsCount + socialCount
        );

        return { score: breakdown.total, priority, breakdown };
      }),
  }),

  // Appointments router (booked by Jessica or staff)
  appointments: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
        status: z.enum(["pending", "confirmed", "completed", "cancelled", "rescheduled", "arrived"]).optional(),
        assignedToId: z.number().optional(),
        customerId: z.number().optional(),
        /** Filter on scheduledAt range (ISO strings) */
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        /** Return only rows with NO scheduledAt (the backlog) */
        unscheduledOnly: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        const dbi = await db.getDb();
        if (!dbi) return [];
        const conditions = [];
        if (input.status) conditions.push(dEq(appointmentsTable.status, input.status));
        if (input.assignedToId) conditions.push(dEq(appointmentsTable.assignedToId, input.assignedToId));
        if (input.customerId) conditions.push(dEq(appointmentsTable.customerId, input.customerId));
        if (input.unscheduledOnly) conditions.push(dIsNull(appointmentsTable.scheduledAt));
        if (input.from) conditions.push(dGte(appointmentsTable.scheduledAt, new Date(input.from)));
        if (input.to) conditions.push(dLte(appointmentsTable.scheduledAt, new Date(input.to)));
        const where = conditions.length ? dAnd(...conditions) : undefined;
        return await dbi.select().from(appointmentsTable).where(where)
          .orderBy(dDesc(appointmentsTable.scheduledAt), dDesc(appointmentsTable.createdAt))
          .limit(input.limit).offset(input.offset);
      }),

    /** Active team members for the assignee dropdown. */
    assignees: protectedProcedure.query(async () => {
      const dbi = await db.getDb();
      if (!dbi) return [];
      return await dbi.select({ id: teamMembersTable.id, name: teamMembersTable.name })
        .from(teamMembersTable).where(dEq(teamMembersTable.status, "active"));
    }),

    /** Active team members WITH emails — for inviting coworkers as attendees (Task 8). */
    teamRoster: protectedProcedure.query(async () => {
      const dbi = await db.getDb();
      if (!dbi) return [];
      return await dbi
        .select({ id: teamMembersTable.id, name: teamMembersTable.name, email: teamMembersTable.email })
        .from(teamMembersTable)
        .where(dEq(teamMembersTable.status, "active"));
    }),

    /** Invited people + their invite status for one appointment (Task 8). */
    attendees: protectedProcedure
      .input(z.object({ appointmentId: z.number().int() }))
      .query(async ({ input }) => {
        const dbi = await db.getDb();
        if (!dbi) return [];
        return await dbi
          .select()
          .from(appointmentAttendeesTable)
          .where(dEq(appointmentAttendeesTable.appointmentId, input.appointmentId))
          .orderBy(appointmentAttendeesTable.id);
      }),

    /** Staff manual booking. Auto-links customer by phone; sends SMS confirmation. */
    create: protectedProcedure
      .input(z.object({
        fullName: z.string().min(1).max(255),
        phone: z.string().min(7).max(50),
        email: z.string().email().max(320).optional().nullable(),
        propertyAddress: z.string().max(1000).optional().nullable(),
        propertyType: z.enum(["residential", "commercial"]).default("residential"),
        appointmentType: z.enum(APPOINTMENT_TYPE_ENUM),
        /** Second dropdown (equipment/job), see shared/appointmentTypes.ts. */
        serviceType: z.string().max(100).optional().nullable(),
        jobType: z.enum(["service_call", "diagnostic", "repair", "maintenance", "installation", "replacement", "estimate", "commercial_hvac", "residential_hvac", "boiler", "furnace", "ac", "heat_pump", "mini_split", "rooftop_unit", "refrigeration", "other"]).optional().nullable(),
        priority: z.enum(["normal", "urgent", "emergency"]).default("normal"),
        source: z.enum(["website", "phone", "referral", "partner", "repeat_customer", "other"]).optional().nullable(),
        scheduledAt: z.string().datetime(),
        durationMinutes: z.number().int().min(15).max(480).default(60),
        assignedToId: z.number().int().optional().nullable(),
        /** Google reminder in minutes (15/30/60/120/1440); null = none. */
        reminderMinutes: z.number().int().min(0).max(10080).optional().nullable(),
        /** Attach a Google Meet link to the calendar event. */
        googleMeetRequested: z.boolean().default(false),
        customerId: z.number().int().optional().nullable(),
        propertyId: z.number().int().optional().nullable(),
        jobId: z.number().int().optional().nullable(),
        issueDescription: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        /** Set false to skip the customer SMS (e.g. internal blocks) */
        sendConfirmation: z.boolean().default(true),
        /** Coworkers / external guests to invite (Task 8). */
        attendees: z.array(attendeeInputSchema).optional(),
        /** Auto-invite the customer at their email. */
        includeCustomer: z.boolean().default(true),
        /** Set false to skip calendar-event creation + invite emails. */
        sendInvites: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        const scheduled = new Date(input.scheduledAt);
        const dbi = await db.getDb();
        if (!dbi) throw new Error("Database not available");
        // Server-side normalization: resolve authoritative customer/property, validate
        // the propertyId↔customerId relationship, and backfill blank contact/address
        // fields. Phone auto-link runs first so phone-matched customers also resolve.
        const autoCustomerId = input.customerId ?? (await findCustomerIdByPhone(input.phone));
        const resolved = await resolveAppointmentContext(dbi, {
          customerId: autoCustomerId,
          propertyId: input.propertyId,
          fullName: input.fullName,
          phone: input.phone,
          email: input.email,
          propertyAddress: input.propertyAddress,
          propertyType: input.propertyType,
        });
        const customerId = resolved.customerId;
        const values = {
          fullName: resolved.fullName ?? input.fullName,
          phone: resolved.phone ?? input.phone,
          email: resolved.email ?? undefined,
          propertyAddress: resolved.propertyAddress ?? undefined,
          propertyType: resolved.propertyType ?? input.propertyType,
          appointmentType: input.appointmentType,
          serviceType: input.serviceType ?? undefined,
          reminderMinutes: input.reminderMinutes ?? undefined,
          googleMeetRequested: input.googleMeetRequested,
          // Keep the legacy varchars in sync for anything still reading them
          preferredDate: scheduled.toLocaleDateString("en-US", { timeZone: "America/New_York" }),
          preferredTime: scheduled.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York" }),
          scheduledAt: scheduled,
          durationMinutes: input.durationMinutes,
          jobType: input.jobType ?? undefined,
          priority: input.priority,
          source: input.source ?? undefined,
          assignedToId: input.assignedToId ?? undefined,
          customerId: resolved.customerId ?? undefined,
          propertyId: resolved.propertyId ?? undefined,
          jobId: input.jobId ?? undefined,
          issueDescription: input.issueDescription ?? undefined,
          notes: input.notes ?? undefined,
          status: "confirmed" as const,
          bookedBy: ctx.user?.name || ctx.user?.email || "staff",
        };
        const result = await db.createAppointment(values);
        const id = Number((result as unknown as { insertId?: number })?.insertId ?? 0);

        let smsSent = false;
        if (input.sendConfirmation) {
          const sms = await sendAppointmentConfirmationSms(values);
          smsSent = sms.sent;
        }

        // Attendees + calendar invites (Task 8) — best effort, never blocks the booking.
        let invitesSent = false;
        if (id > 0) {
          const attendees = normalizeAttendees((input.attendees ?? []) as AttendeeInput[], {
            customerEmail: input.includeCustomer ? input.email ?? undefined : undefined,
            customerName: input.fullName,
          });
          await replaceAttendees(id, attendees);
          if (input.sendInvites && attendees.length > 0) {
            await syncAppointmentInvites({ appointmentId: id });
            invitesSent = true;
          }
        }
        return { id, customerId, smsSent, invitesSent };
      }),

    /** Staff edit — any field. Sends reschedule SMS when scheduledAt changes. */
    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        fullName: z.string().min(1).max(255).optional(),
        phone: z.string().min(7).max(50).optional(),
        email: z.string().email().max(320).optional().nullable(),
        propertyAddress: z.string().max(1000).optional().nullable(),
        propertyType: z.enum(["residential", "commercial"]).optional(),
        appointmentType: z.enum(APPOINTMENT_TYPE_ENUM).optional(),
        serviceType: z.string().max(100).optional().nullable(),
        reminderMinutes: z.number().int().min(0).max(10080).optional().nullable(),
        googleMeetRequested: z.boolean().optional(),
        jobType: z.enum(["service_call", "diagnostic", "repair", "maintenance", "installation", "replacement", "estimate", "commercial_hvac", "residential_hvac", "boiler", "furnace", "ac", "heat_pump", "mini_split", "rooftop_unit", "refrigeration", "other"]).optional().nullable(),
        priority: z.enum(["normal", "urgent", "emergency"]).optional(),
        source: z.enum(["website", "phone", "referral", "partner", "repeat_customer", "other"]).optional().nullable(),
        scheduledAt: z.string().datetime().optional(),
        durationMinutes: z.number().int().min(15).max(480).optional(),
        assignedToId: z.number().int().optional().nullable(),
        customerId: z.number().int().optional().nullable(),
        propertyId: z.number().int().optional().nullable(),
        issueDescription: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        status: z.enum(["pending", "confirmed", "completed", "cancelled", "rescheduled", "arrived"]).optional(),
        sendConfirmation: z.boolean().default(true),
        /** When provided, REPLACES the attendee list (Task 8). Omit to leave unchanged. */
        attendees: z.array(attendeeInputSchema).optional(),
        /** Auto-invite the customer at their email when replacing attendees. */
        includeCustomer: z.boolean().default(true),
        /** Set false to skip re-syncing the calendar event + invites. */
        sendInvites: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const dbi = await db.getDb();
        if (!dbi) throw new Error("Database not available");
        const existing = (await dbi.select().from(appointmentsTable).where(dEq(appointmentsTable.id, input.id)).limit(1))[0];
        if (!existing) throw new Error("Appointment not found");

        const { id, sendConfirmation, scheduledAt, attendees: attendeesInput, sendInvites, includeCustomer, ...rest } = input;
        const patch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rest)) {
          if (v !== undefined) patch[k] = v;
        }

        let rescheduled = false;
        if (scheduledAt) {
          const newDate = new Date(scheduledAt);
          rescheduled = !existing.scheduledAt || newDate.getTime() !== new Date(existing.scheduledAt).getTime();
          patch.scheduledAt = newDate;
          patch.preferredDate = newDate.toLocaleDateString("en-US", { timeZone: "America/New_York" });
          patch.preferredTime = newDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York" });
          if (rescheduled && !patch.status && existing.scheduledAt) patch.status = "rescheduled";
        }

        // Re-run auto-link if phone changed and no explicit customerId given
        if (patch.phone && input.customerId === undefined && !existing.customerId) {
          const linked = await findCustomerIdByPhone(patch.phone as string);
          if (linked) patch.customerId = linked;
        }

        // When a customer/property linkage is being set, validate the
        // propertyId↔customerId relationship (reject mismatches) and backfill the
        // location from the linked property if the user didn't type one.
        if (input.propertyId !== undefined || input.customerId !== undefined) {
          const effCustomerId = input.customerId !== undefined ? input.customerId : ((patch.customerId as number | undefined) ?? existing.customerId ?? null);
          const effPropertyId = input.propertyId !== undefined ? input.propertyId : (existing.propertyId ?? null);
          const resolved = await resolveAppointmentContext(dbi, {
            customerId: effCustomerId,
            propertyId: effPropertyId,
            fullName: (patch.fullName as string) ?? existing.fullName,
            phone: (patch.phone as string) ?? existing.phone,
            email: (patch.email as string | null) ?? existing.email,
            propertyAddress: (patch.propertyAddress as string | null) ?? existing.propertyAddress,
            propertyType: (patch.propertyType as "residential" | "commercial") ?? existing.propertyType,
          });
          patch.customerId = resolved.customerId ?? null;
          patch.propertyId = resolved.propertyId ?? null;
          // When a property is linked, its authoritative address ALWAYS wins — even over a
          // typed value in this patch. Otherwise only backfill a blank address.
          if (resolved.propertyId != null) patch.propertyAddress = resolved.propertyAddress ?? null;
          else if (patch.propertyAddress === undefined && resolved.propertyAddress) patch.propertyAddress = resolved.propertyAddress;
          if (resolved.propertyType) patch.propertyType = resolved.propertyType;
        }

        if (Object.keys(patch).length > 0) {
          await dbi.update(appointmentsTable).set(patch).where(dEq(appointmentsTable.id, id));
        }

        let smsSent = false;
        if (rescheduled && sendConfirmation) {
          const merged = { ...existing, ...patch } as typeof existing;
          const sms = await sendAppointmentConfirmationSms(merged, { isReschedule: Boolean(existing.scheduledAt) });
          smsSent = sms.sent;
        }

        // Attendees + calendar sync (Task 8) — best effort, never blocks the edit.
        if (attendeesInput !== undefined) {
          const normalized = normalizeAttendees(attendeesInput as AttendeeInput[], {
            customerEmail: includeCustomer
              ? (patch.email as string | undefined) ?? existing.email ?? undefined
              : undefined,
            customerName: (patch.fullName as string | undefined) ?? existing.fullName,
          });
          await replaceAttendees(id, normalized);
        }
        if (sendInvites) {
          const nowCancelled = patch.status === "cancelled" && existing.status !== "cancelled";
          if (nowCancelled) {
            await syncAppointmentInvites({ appointmentId: id, cancel: true });
          } else if (attendeesInput !== undefined || rescheduled || Object.keys(patch).length > 0) {
            await syncAppointmentInvites({ appointmentId: id });
          }
        }
        return { success: true, rescheduled, smsSent };
      }),

    stats: protectedProcedure.query(async () => {
      return await db.getAppointmentStats();
    }),

    weeklyTrend: protectedProcedure.query(async () => {
      return await db.getWeeklyAppointmentCounts(8);
    }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "confirmed", "completed", "cancelled", "rescheduled", "arrived"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateAppointmentStatus(input.id, input.status);
        // Cancel the Google event / send cancellation ICS when cancelled (Task 8).
        if (input.status === "cancelled") {
          await syncAppointmentInvites({ appointmentId: input.id, cancel: true });
        }
        return { success: true };
      }),

    /**
     * Field App (mobile) feed — today's appointments assigned to the logged-in
     * team member, oldest-first (the day's running order). Joins the linked
     * customer (companyName/displayName) and the assigned technician's name so
     * the phone card needs no extra round-trips. Read-only; never touches
     * QuickBooks, Google Calendar, or the core CRM schema.
     */
    fieldToday: protectedProcedure
      .input(z.object({ now: z.string().datetime().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const memberId = resolveTeamMemberId(ctx.user);
        // Manus OAuth users have no field assignments → empty feed (not an error).
        if (memberId == null) return { memberId: null, appointments: [] as const };

        const dbi = await db.getDb();
        if (!dbi) return { memberId, appointments: [] as const };

        const now = input?.now ? new Date(input.now) : new Date();
        const { start, endExclusive } = dayRangeInTimeZone(now);

        const rows = await dbi
          .select({
            id: appointmentsTable.id,
            scheduledAt: appointmentsTable.scheduledAt,
            durationMinutes: appointmentsTable.durationMinutes,
            appointmentType: appointmentsTable.appointmentType,
            serviceType: appointmentsTable.serviceType,
            status: appointmentsTable.status,
            priority: appointmentsTable.priority,
            fullName: appointmentsTable.fullName,
            phone: appointmentsTable.phone,
            propertyAddress: appointmentsTable.propertyAddress,
            notes: appointmentsTable.notes,
            issueDescription: appointmentsTable.issueDescription,
            customerId: appointmentsTable.customerId,
            jobId: appointmentsTable.jobId,
            assignedToId: appointmentsTable.assignedToId,
            companyName: customersTable.companyName,
            customerDisplayName: customersTable.displayName,
            technicianName: teamMembersTable.name,
          })
          .from(appointmentsTable)
          .leftJoin(customersTable, dEq(appointmentsTable.customerId, customersTable.id))
          .leftJoin(teamMembersTable, dEq(appointmentsTable.assignedToId, teamMembersTable.id))
          .where(
            dAnd(
              dEq(appointmentsTable.assignedToId, memberId),
              dGte(appointmentsTable.scheduledAt, start),
              dLt(appointmentsTable.scheduledAt, endExclusive),
            ),
          )
          .orderBy(dAsc(appointmentsTable.scheduledAt));

        return { memberId, appointments: rows };
      }),

    /**
     * Field App (mobile) "My Jobs" dashboard feed — a technician's appointments
     * split into Overdue / Today / Upcoming / Completed Today (see
     * shared/fieldApp.ts → categorizeFieldJobs). Read-only; never touches
     * QuickBooks, Google Calendar, SMS, or the core CRM schema.
     *
     * Scoping & permissions:
     *   - A technician always sees only their own assigned work
     *     (resolveTeamMemberId(ctx.user)).
     *   - An admin (ctx.user.role === "admin") may preview another technician by
     *     passing `technicianId`. For non-admins `technicianId` is ignored, so a
     *     technician can never read another's board — enforced here on the server.
     *
     * Query is bounded to [today − 60d, today + 90d] so it stays a small,
     * index-friendly window; categorizeFieldJobs drops cancelled/unscheduled rows.
     */
    fieldJobs: protectedProcedure
      .input(
        z
          .object({
            now: z.string().datetime().optional(),
            technicianId: z.number().int().positive().optional(),
          })
          .optional(),
      )
      .query(async ({ input, ctx }) => {
        const callerMemberId = resolveTeamMemberId(ctx.user);
        const isAdmin = ctx.user?.role === "admin";

        // Admins may preview a chosen technician; everyone else is pinned to self.
        const viewingMemberId =
          isAdmin && input?.technicianId ? input.technicianId : callerMemberId;

        const emptySections = { overdue: [], today: [], upcoming: [], completedToday: [] } as const;

        // OAuth/admin with no team profile and no selection → nothing to show yet
        // (the client surfaces the technician picker for admins).
        if (viewingMemberId == null) {
          return {
            memberId: callerMemberId,
            viewingMemberId: null,
            isAdmin,
            technicianName: null,
            sections: emptySections,
          };
        }

        const dbi = await db.getDb();
        if (!dbi) {
          return {
            memberId: callerMemberId,
            viewingMemberId,
            isAdmin,
            technicianName: null,
            sections: emptySections,
          };
        }

        const now = input?.now ? new Date(input.now) : new Date();
        const { start, endExclusive } = dayRangeInTimeZone(now);
        const DAY = 24 * 60 * 60 * 1000;
        const windowStart = new Date(start.getTime() - 60 * DAY); // overdue lookback
        const windowEnd = new Date(endExclusive.getTime() + 90 * DAY); // upcoming lookahead

        const rows = await dbi
          .select({
            id: appointmentsTable.id,
            scheduledAt: appointmentsTable.scheduledAt,
            durationMinutes: appointmentsTable.durationMinutes,
            appointmentType: appointmentsTable.appointmentType,
            serviceType: appointmentsTable.serviceType,
            status: appointmentsTable.status,
            priority: appointmentsTable.priority,
            fullName: appointmentsTable.fullName,
            phone: appointmentsTable.phone,
            propertyAddress: appointmentsTable.propertyAddress,
            notes: appointmentsTable.notes,
            issueDescription: appointmentsTable.issueDescription,
            customerId: appointmentsTable.customerId,
            jobId: appointmentsTable.jobId,
            assignedToId: appointmentsTable.assignedToId,
            companyName: customersTable.companyName,
            customerDisplayName: customersTable.displayName,
            technicianName: teamMembersTable.name,
          })
          .from(appointmentsTable)
          .leftJoin(customersTable, dEq(appointmentsTable.customerId, customersTable.id))
          .leftJoin(teamMembersTable, dEq(appointmentsTable.assignedToId, teamMembersTable.id))
          .where(
            dAnd(
              dEq(appointmentsTable.assignedToId, viewingMemberId),
              dGte(appointmentsTable.scheduledAt, windowStart),
              dLt(appointmentsTable.scheduledAt, windowEnd),
            ),
          )
          .orderBy(dAsc(appointmentsTable.scheduledAt));

        // Resolve the viewed technician's name even when they have zero jobs
        // (so the admin preview banner can name them).
        const technicianName =
          rows.find(r => r.technicianName)?.technicianName ??
          (
            await dbi
              .select({ name: teamMembersTable.name })
              .from(teamMembersTable)
              .where(dEq(teamMembersTable.id, viewingMemberId))
              .limit(1)
          )[0]?.name ??
          null;

        return {
          memberId: callerMemberId,
          viewingMemberId,
          isAdmin,
          technicianName,
          sections: categorizeFieldJobs(rows, now),
        };
      }),
  }),

  // AI Scripts management router
  aiScripts: router({
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1),
          category: z.enum(["master", "residential", "commercial", "vrv_vrf", "objections", "custom"]),
          content: z.string().min(1),
          isActive: z.boolean().default(true),
        })
      )
      .mutation(async ({ input }) => {
        await db.createAiScript(input);
        return { success: true };
      }),

    getAll: protectedProcedure.query(async () => {
      return await db.getAllAiScripts();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAiScriptById(input.id);
      }),

    getByCategory: protectedProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => {
        return await db.getAiScriptsByCategory(input.category);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).optional(),
          category: z.enum(["master", "residential", "commercial", "vrv_vrf", "objections", "custom"]).optional(),
          content: z.string().min(1).optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await db.updateAiScript(id, updates);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAiScript(input.id);
        return { success: true };
      }),
  }),

  // Webhook endpoints for external services
  // PUBLIC by design: called by external services (Vapi, Telnyx) that cannot
  // hold a session. Payload validation is the auth boundary here.
  webhooks: router({

    // Vapi voice AI webhook
    vapi: publicProcedure
      .input(z.any())
      .mutation(async ({ input }) => {
        await handleVapiWebhook(input);
        return { success: true };
      }),

    // Vapi tool-calls webhook (Jessica's canonical tools: bookHVAC / rescheduleHVAC / getCallerInfo / sendReferralLink)
    // AuthN runs as middleware — BEFORE input parsing or any tool execution — so an
    // unauthenticated caller can never reach the dispatcher. Reuses VAPI_WEBHOOK_SECRET
    // via `Authorization: Bearer <secret>` (constant-time; fail-closed if unset).
    vapiTools: publicProcedure
      .use(async ({ ctx, next }) => {
        const auth = authenticateVapiToolCall(ctx.req?.headers?.authorization);
        if (!auth.ok) {
          if (auth.reason === "not_configured") {
            console.error(
              "[VapiTools] VAPI_WEBHOOK_SECRET not configured — refusing tool-calls webhook (fail-closed)",
            );
          }
          // Never reveal whether the failure was config vs. bad credential.
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized" });
        }
        return next();
      })
      .input(z.any())
      .mutation(async ({ input }) => {
        const result = await handleVapiToolCalls(input);
        return result;
      }),

    // AI VA inbound SMS webhook (Telnyx). Records the inbound text to the AI VA
    // conversation inbox and returns an acknowledgement reply.
    aiVaSmsInbound: publicProcedure
      .input(z.any())
      .mutation(async ({ input }) => {
        const response = await handleIncomingSms(input);
        return { response };
      }),
  }),

  // Marketing Autopilot — autonomous campaign engine
  autopilot: router({
    analyze: protectedProcedure.query(async () => {
      return await runCampaignAnalysis();
    }),

    // Refresh analysis on demand
    refresh: protectedProcedure.mutation(async () => {
      return await runCampaignAnalysis();
    }),
  }),
});

export type AppRouter = typeof appRouter;

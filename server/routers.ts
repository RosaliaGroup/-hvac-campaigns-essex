import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { handleVapiWebhook } from "./integrations/vapi";
import { handleIncomingSms } from "./integrations/twilio";
import { notifyOwner } from "./_core/notification";
import { googleAdsRouter } from "./routers/googleAds";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  googleAds: googleAdsRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
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
          captureType: z.enum(["exit_popup", "inline_form", "newsletter", "download_gate", "quick_quote", "scroll_popup_residential", "scroll_popup_commercial", "exit_popup_residential", "exit_popup_commercial", "lp_heat_pump", "lp_commercial_vrv", "lp_emergency", "lp_fb_residential", "lp_fb_commercial", "lp_rebate_guide", "lp_maintenance"]),
          pageUrl: z.string().optional(),
          message: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Validate that at least email or phone is provided
        if (!input.email && !input.phone) {
          throw new Error("Either email or phone is required");
        }

        await db.createLeadCapture(input);
        
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
        
        return { success: true };
      }),
    
    list: protectedProcedure
      .input(
        z.object({
          status: z.enum(["new", "contacted", "qualified", "booked", "lost"]).optional(),
          captureType: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().optional().default(100),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ input }) => {
        return await db.getAllLeadCaptures(input);
      }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["new", "contacted", "qualified", "booked", "lost"]),
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

    stats: protectedProcedure.query(async () => {
      return await db.getLeadCaptureStats();
    }),
  }),

  // AI Virtual Assistant router
  aiVa: router({
    saveCredentials: protectedProcedure
      .input(
        z.object({
          service: z.enum(["vapi", "twilio", "facebook", "google_business"] as const),
          credentials: z.record(z.string(), z.string()),
        })
      )
      .mutation(async ({ input }) => {
        // Store credentials securely (encrypted)
        const credentials = input.credentials as Record<string, string>;
        await db.saveAiVaCredentials(input.service, credentials);
        return { success: true };
      }),

    getCredentials: protectedProcedure
      .input(z.object({ service: z.enum(["vapi", "twilio", "facebook", "google_business"] as const) }))
      .query(async ({ input }) => {
        return await db.getAiVaCredentials(input.service);
      }),

    getAllCredentials: protectedProcedure
      .query(async () => {
        // Get all credentials for all services
        const services = ["vapi", "twilio", "facebook", "google_business"] as const;
        const allCredentials = await Promise.all(
          services.map(async (service) => {
            const creds = await db.getAiVaCredentials(service);
            return creds ? { service, credentials: creds } : null;
          })
        );
        // Filter out null values (services with no credentials)
        return allCredentials.filter(c => c !== null);
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
  webhooks: router({

    // Vapi voice AI webhook
    vapi: publicProcedure
      .input(z.any())
      .mutation(async ({ input }) => {
        await handleVapiWebhook(input);
        return { success: true };
      }),

    // Twilio SMS webhook
    twilio: publicProcedure
      .input(z.any())
      .mutation(async ({ input }) => {
        const response = await handleIncomingSms(input);
        return { response };
      }),
  }),
});

export type AppRouter = typeof appRouter;

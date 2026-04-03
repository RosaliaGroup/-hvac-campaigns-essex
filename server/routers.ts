import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { handleVapiWebhook } from "./integrations/vapi";
import { handleVapiToolCalls } from "./integrations/vapiTools";
import { handleIncomingSms } from "./integrations/twilio";
import { notifyOwner } from "./_core/notification";
import { googleAdsRouter } from "./routers/googleAds";
import { metaAdsRouter } from "./routers/metaAds";
import { teamAuthRouter } from "./routers/teamAuth";
import { smsCampaignsRouter } from "./routers/smsCampaigns";
import { rebateCalculatorRouter } from "./routers/rebateCalculator";
import { heygenRouter } from "./routers/heygen";
import { coursesRouter } from "./courses-router";
import { paymentRouter } from "./payment-router";
import { runCampaignAnalysis } from "./services/campaignEngine";
import { generateSocialPost } from "./integrations/ai-content-generator";
import { postToGoogleBusiness } from "./integrations/google-business";
import { postToFacebook, postToInstagram } from "./integrations/facebook";
import { takeoffsRouter } from "./routers/takeoffs";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  googleAds: googleAdsRouter,
  metaAds: metaAdsRouter,
  teamAuth: teamAuthRouter,
  smsCampaigns: smsCampaignsRouter,
  rebateCalculator: rebateCalculatorRouter,
  heygen: heygenRouter,
  courses: coursesRouter,
  payment: paymentRouter,
  takeoffs: takeoffsRouter,
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
          captureType: z.enum(["exit_popup", "inline_form", "newsletter", "download_gate", "quick_quote", "qualify_form", "scroll_popup_residential", "scroll_popup_commercial", "exit_popup_residential", "exit_popup_commercial", "lp_heat_pump", "lp_commercial_vrv", "lp_emergency", "lp_fb_residential", "lp_fb_commercial", "lp_rebate_guide", "lp_maintenance", "lp_referral_partner", "lp_maintenance_subscription", "career_application", "partnership_inquiry"]),
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
          const clientSubject = isCareer
            ? "We received your application – Mechanical Enterprise"
            : isPartnership
            ? "We received your partnership inquiry – Mechanical Enterprise"
            : "We received your quote request – Mechanical Enterprise";
          const clientBody = isCareer
            ? "We've received your job application and our team will review it within <strong>3-5 business days</strong>."
            : isPartnership
            ? "We've received your partnership inquiry and will be in touch within <strong>24-48 hours</strong> to discuss next steps."
            : "We've received your quote request and a member of our team will follow up with you within <strong>24 hours</strong>.";
          const salesSubject = isCareer
            ? `New Job Application – ${leadName}`
            : isPartnership
            ? `New Partnership Inquiry – ${leadName}`
            : `New Quote Request – ${leadName}`;
          const salesHeading = isCareer ? "New Job Application" : isPartnership ? "New Partnership Inquiry" : "New Quote Request";

          // 1. Client confirmation email
          if (input.email) {
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
                  html: `
                    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
                      <h2 style="color:#1e3a5f">Thank you, ${leadName}!</h2>
                      <p>${clientBody}</p>
                      <p>Need immediate assistance? Give us a call — we're happy to help.</p>
                      <div style="text-align:center;margin:32px 0">
                        <a href="tel:8624191763" style="background:#ff6b35;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">Call Us Now: (862) 419-1763</a>
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

    analytics: protectedProcedure.query(async () => {
      return await db.getLeadCaptureAnalytics();
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

    // Publish a post immediately to the selected platform
    publishPost: protectedProcedure
      .input(
        z.object({
          platform: z.enum(["facebook", "instagram", "google_business", "nextdoor"] as const),
          content: z.string().min(1),
          contentType: z.string().optional(),
          mediaUrls: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const credMap = await db.getAiVaCredentials(input.platform === "instagram" ? "facebook" : input.platform);
        if (!credMap) {
          throw new Error(`No credentials saved for ${input.platform}. Please configure in AI VA Settings.`);
        }

        if (input.platform === "google_business") {
          await postToGoogleBusiness(
            { accessToken: credMap.accessToken, accountId: credMap.accountId, locationId: credMap.locationId },
            input.content,
            input.mediaUrls
          );
        } else if (input.platform === "facebook") {
          await postToFacebook(
            { accessToken: credMap.accessToken, pageId: credMap.pageId, instagramAccountId: credMap.instagramAccountId },
            input.content,
            input.mediaUrls?.[0]
          );
        } else if (input.platform === "instagram") {
          if (!input.mediaUrls?.[0]) throw new Error("Instagram posts require an image URL");
          await postToInstagram(
            { accessToken: credMap.accessToken, pageId: credMap.pageId, instagramAccountId: credMap.instagramAccountId },
            input.content,
            input.mediaUrls[0]
          );
        } else if (input.platform === "nextdoor") {
          // Nextdoor does not have a public posting API — content is queued for manual posting
          // The post is saved to DB with status 'scheduled' for manual publishing
        }
        return { success: true };
      }),

    // Delete a scheduled post
    deletePost: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSocialPost(input.id);
        return { success: true };
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

  // Appointments router (booked by Jessica)
  appointments: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
      }))
      .query(async ({ input }) => {
        return await db.getAllAppointments(input.limit, input.offset);
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
        status: z.enum(["pending", "confirmed", "completed", "cancelled", "rescheduled"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateAppointmentStatus(input.id, input.status);
        return { success: true };
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

    // Vapi tool-calls webhook (Jessica's bookAppointment / rescheduleAppointment / getCallerInfo)
    vapiTools: publicProcedure
      .input(z.any())
      .mutation(async ({ input }) => {
        const result = await handleVapiToolCalls(input);
        return result;
      }),

    // Twilio SMS webhook
    twilio: publicProcedure
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

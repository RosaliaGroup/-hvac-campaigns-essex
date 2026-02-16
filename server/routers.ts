import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
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
          captureType: z.enum(["exit_popup", "inline_form", "newsletter", "download_gate", "quick_quote"]),
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
    
    list: protectedProcedure.query(async () => {
      return await db.getAllLeadCaptures();
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;

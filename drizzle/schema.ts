import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Leads table for tracking marketing campaign inquiries
 */
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contact: varchar("contact", { length: 255 }).notNull(),
  contactType: mysqlEnum("contactType", ["phone", "email"]).notNull(),
  source: varchar("source", { length: 255 }).notNull(),
  service: varchar("service", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["new", "contacted", "quoted", "won", "lost"]).default("new").notNull(),
  notes: text("notes"),
  // Lead scoring fields
  score: int("score").default(0).notNull(),
  priority: mysqlEnum("priority", ["hot", "warm", "cold"]).default("cold").notNull(),
  lastInteractionAt: timestamp("lastInteractionAt"),
  interactionCount: int("interactionCount").default(0).notNull(),
  scoreBreakdown: text("scoreBreakdown"), // JSON: {calls: 20, sms: 15, social: 5, ...}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

/**
 * Lead captures table for tracking website visitor contact information
 */
export const leadCaptures = mysqlTable("leadCaptures", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  firstName: varchar("firstName", { length: 255 }),
  lastName: varchar("lastName", { length: 255 }),
  name: varchar("name", { length: 255 }),
  captureType: mysqlEnum("captureType", ["exit_popup", "inline_form", "newsletter", "download_gate", "quick_quote", "scroll_popup_residential", "scroll_popup_commercial", "exit_popup_residential", "exit_popup_commercial", "lp_heat_pump", "lp_commercial_vrv", "lp_emergency", "lp_fb_residential", "lp_fb_commercial", "lp_rebate_guide", "lp_maintenance", "lp_referral_partner", "lp_maintenance_subscription"]).notNull(),
  pageUrl: varchar("pageUrl", { length: 500 }),
  message: text("message"),
  status: mysqlEnum("status", ["new", "contacted", "qualified", "booked", "lost"]).default("new").notNull(),
  notes: text("notes"),
  assignedTo: varchar("assignedTo", { length: 255 }),
  followUpAt: timestamp("followUpAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LeadCapture = typeof leadCaptures.$inferSelect;
export type InsertLeadCapture = typeof leadCaptures.$inferInsert;

/**
 * Email drip campaign templates
 */
export const dripCampaignTemplates = mysqlTable("dripCampaignTemplates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  dayNumber: int("dayNumber").notNull(), // Day 1, Day 3, Day 7, etc.
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  isActive: int("isActive").default(1).notNull(), // 1 = active, 0 = inactive
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DripCampaignTemplate = typeof dripCampaignTemplates.$inferSelect;
export type InsertDripCampaignTemplate = typeof dripCampaignTemplates.$inferInsert;

/**
 * Email drip campaign schedule tracking
 */
export const dripCampaignSchedule = mysqlTable("dripCampaignSchedule", {
  id: int("id").autoincrement().primaryKey(),
  leadCaptureId: int("leadCaptureId").notNull(),
  templateId: int("templateId").notNull(),
  scheduledFor: timestamp("scheduledFor").notNull(),
  sentAt: timestamp("sentAt"),
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DripCampaignSchedule = typeof dripCampaignSchedule.$inferSelect;
export type InsertDripCampaignSchedule = typeof dripCampaignSchedule.$inferInsert;

/**
 * AI VA Credentials - Secure storage for API keys
 */
export const aiVaCredentials = mysqlTable("aiVaCredentials", {
  id: int("id").autoincrement().primaryKey(),
  service: varchar("service", { length: 50 }).notNull(), // 'vapi', 'twilio', 'facebook', 'google_business'
  credentialKey: varchar("credentialKey", { length: 100 }).notNull(),
  credentialValue: text("credentialValue").notNull(), // encrypted
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiVaCredential = typeof aiVaCredentials.$inferSelect;
export type InsertAiVaCredential = typeof aiVaCredentials.$inferInsert;

/**
 * Call Logs - Vapi voice call records
 */
export const callLogs = mysqlTable("callLogs", {
  id: int("id").autoincrement().primaryKey(),
  callId: varchar("callId", { length: 255 }).unique(),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
  duration: int("duration"), // seconds
  status: varchar("status", { length: 50 }),
  transcript: text("transcript"),
  recordingUrl: text("recordingUrl"),
  leadId: int("leadId"),
  leadQuality: mysqlEnum("leadQuality", ["hot", "warm", "cold"]),
  serviceType: varchar("serviceType", { length: 255 }),
  budget: varchar("budget", { length: 100 }),
  timeline: varchar("timeline", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = typeof callLogs.$inferInsert;

/**
 * SMS Conversations - Twilio text message records
 */
export const smsConversations = mysqlTable("smsConversations", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: varchar("conversationId", { length: 255 }),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  message: text("message").notNull(),
  leadId: int("leadId"),
  status: varchar("status", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SmsConversation = typeof smsConversations.$inferSelect;
export type InsertSmsConversation = typeof smsConversations.$inferInsert;

/**
 * Social Posts - Automated social media content
 */
export const socialPosts = mysqlTable("socialPosts", {
  id: int("id").autoincrement().primaryKey(),
  platform: varchar("platform", { length: 50 }).notNull(), // 'facebook', 'instagram', 'google_business', 'linkedin'
  content: text("content").notNull(),
  mediaUrls: text("mediaUrls"), // JSON array
  contentType: varchar("contentType", { length: 50 }), // 'hvac_tip', 'rebate_alert', 'seasonal_advice', etc.
  scheduledAt: timestamp("scheduledAt"),
  postedAt: timestamp("postedAt"),
  postId: varchar("postId", { length: 255 }),
  engagement: text("engagement"), // JSON: {likes, comments, shares}
  status: mysqlEnum("status", ["draft", "scheduled", "posted", "failed"]).default("draft").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;

/**
 * Social Interactions - Comments and messages from social media
 */
export const socialInteractions = mysqlTable("socialInteractions", {
  id: int("id").autoincrement().primaryKey(),
  platform: varchar("platform", { length: 50 }).notNull(),
  interactionType: mysqlEnum("interactionType", ["comment", "message", "review"]).notNull(),
  postId: int("postId"),
  externalId: varchar("externalId", { length: 255 }), // Platform's ID for the interaction
  authorName: varchar("authorName", { length: 255 }),
  content: text("content").notNull(),
  aiResponse: text("aiResponse"),
  respondedAt: timestamp("respondedAt"),
  leadId: int("leadId"),
  sentiment: mysqlEnum("sentiment", ["positive", "neutral", "negative"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SocialInteraction = typeof socialInteractions.$inferSelect;
export type InsertSocialInteraction = typeof socialInteractions.$inferInsert;

/**
 * AI VA Analytics - Daily performance metrics
 */
export const aiVaAnalytics = mysqlTable("aiVaAnalytics", {
  id: int("id").autoincrement().primaryKey(),
  date: timestamp("date").notNull(),
  callsInbound: int("callsInbound").default(0),
  callsOutbound: int("callsOutbound").default(0),
  smsInbound: int("smsInbound").default(0),
  smsOutbound: int("smsOutbound").default(0),
  socialPosts: int("socialPosts").default(0),
  socialInteractions: int("socialInteractions").default(0),
  leadsGenerated: int("leadsGenerated").default(0),
  leadsQualified: int("leadsQualified").default(0),
  hotLeads: int("hotLeads").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiVaAnalytic = typeof aiVaAnalytics.$inferSelect;
export type InsertAiVaAnalytic = typeof aiVaAnalytics.$inferInsert;
/**
 * AI Scripts - Custom Vapi assistant scripts for different scenarios
 */
export const aiScripts = mysqlTable("aiScripts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["master", "residential", "commercial", "vrv_vrf", "objections", "custom"]).notNull(),
  content: text("content").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiScript = typeof aiScripts.$inferSelect;
export type InsertAiScript = typeof aiScripts.$inferInsert;

/**
 * Appointments — booked by Jessica (Vapi AI assistant) via bookAppointment / rescheduleAppointment tools
 */
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  // Caller info
  fullName: varchar("fullName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  email: varchar("email", { length: 320 }),
  // Property
  propertyAddress: text("propertyAddress"),
  propertyType: mysqlEnum("propertyType", ["residential", "commercial"]).default("residential"),
  // Appointment details
  appointmentType: mysqlEnum("appointmentType", ["free_consultation", "technician_dispatch", "maintenance_plan", "commercial_assessment"]).notNull(),
  preferredDate: varchar("preferredDate", { length: 100 }).notNull(),
  preferredTime: varchar("preferredTime", { length: 100 }).notNull(),
  issueDescription: text("issueDescription"),
  // Status
  status: mysqlEnum("status", ["pending", "confirmed", "completed", "cancelled", "rescheduled"]).default("pending").notNull(),
  notes: text("notes"),
  // Source tracking
  vapiCallId: varchar("vapiCallId", { length: 255 }),
  bookedBy: varchar("bookedBy", { length: 100 }).default("jessica"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

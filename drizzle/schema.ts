import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";

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
  /** Comma-separated list of video interest keys selected by the user */
  videoInterests: text("videoInterests"),
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
  // Customer conversion linkage (Phase 1)
  customerId: int("customerId"),
  convertedAt: timestamp("convertedAt"),
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
  captureType: mysqlEnum("captureType", ["exit_popup", "inline_form", "newsletter", "download_gate", "quick_quote", "qualify_form", "scroll_popup_residential", "scroll_popup_commercial", "exit_popup_residential", "exit_popup_commercial", "lp_heat_pump", "lp_commercial_vrv", "lp_emergency", "lp_fb_residential", "lp_fb_commercial", "lp_rebate_guide", "lp_maintenance", "lp_referral_partner", "lp_maintenance_subscription", "career_application", "partnership_inquiry", "pseg_checklist_download", "meta_lead_ad"]).notNull(),
  pageUrl: varchar("pageUrl", { length: 500 }),
  message: text("message"),
  // Lead pipeline stage. Additive: new stages + retained legacy (qualified/booked)
  // so pre-migration rows stay valid. Keep in sync with shared/leadPipeline.ts.
  status: mysqlEnum("status", [
    "new", "contacted", "assessment_scheduled", "assessment_completed",
    "proposal_sent", "follow_up", "won", "lost",
    "qualified", "booked", // legacy — mapped to new stages on display
  ]).default("new").notNull(),
  notes: text("notes"),
  assignedTo: varchar("assignedTo", { length: 255 }),
  followUpAt: timestamp("followUpAt"),
  // Customer conversion linkage (Phase 1)
  customerId: int("customerId"),
  convertedAt: timestamp("convertedAt"),
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
  // Customer linkage (Phase 1)
  customerId: int("customerId"),
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
  // New HVAC appointment types + legacy values retained so existing rows stay valid.
  // Keep in sync with shared/appointmentTypes.ts APPOINTMENT_TYPE_ENUM.
  appointmentType: mysqlEnum("appointmentType", [
    "assessment", "estimate", "service_call", "installation", "maintenance",
    "warranty", "follow_up", "inspection", "sales_visit", "other",
    "free_consultation", "technician_dispatch", "maintenance_plan", "commercial_assessment",
  ]).notNull(),
  /** Second dropdown (equipment/job): mini_split_installation, heat_pump, … (see shared/appointmentTypes.ts). */
  serviceType: varchar("serviceType", { length: 100 }),
  preferredDate: varchar("preferredDate", { length: 100 }).notNull(),
  preferredTime: varchar("preferredTime", { length: 100 }).notNull(),
  /**
   * Real datetime for the appointment (Phase 1 upgrade). preferredDate/preferredTime
   * varchars are KEPT for Vapi/Jessica compatibility; scheduledAt is the queryable truth.
   */
  scheduledAt: timestamp("scheduledAt"),
  durationMinutes: int("durationMinutes").default(60).notNull(),
  /** Team member (teamMembers.id) assigned to run this appointment */
  assignedToId: int("assignedToId"),
  // ── Job classification (Task 4.5 — appointment-level only, NOT work orders) ──
  /** What kind of work this visit is for. Nullable: legacy + Jessica rows may not specify. */
  jobType: mysqlEnum("jobType", [
    "service_call", "diagnostic", "repair", "maintenance", "installation",
    "replacement", "estimate", "commercial_hvac", "residential_hvac",
    "boiler", "furnace", "ac", "heat_pump", "mini_split", "rooftop_unit",
    "refrigeration", "other",
  ]),
  priority: mysqlEnum("priority", ["normal", "urgent", "emergency"]).default("normal").notNull(),
  /** Where this booking came from */
  source: mysqlEnum("source", ["website", "phone", "referral", "partner", "repeat_customer", "other"]),
  issueDescription: text("issueDescription"),
  // Status — "arrived" appended for the Field App (additive: existing rows/indexes unchanged).
  status: mysqlEnum("status", ["pending", "confirmed", "completed", "cancelled", "rescheduled", "arrived"]).default("pending").notNull(),
  notes: text("notes"),
  // Source tracking
  vapiCallId: varchar("vapiCallId", { length: 255 }),
  bookedBy: varchar("bookedBy", { length: 100 }).default("jessica"),
  // Customer linkage (Phase 1 — nullable, backfilled over time)
  customerId: int("customerId"),
  propertyId: int("propertyId"),
  /** Job this visit belongs to (Phase 2 — Job 1→N Appointments) */
  jobId: int("jobId"),
  // ── Google Calendar + invites (Task 8) ──────────────────────────────────────
  /** Google Calendar event id once this appointment is synced (null = not synced). */
  googleCalendarEventId: varchar("googleCalendarEventId", { length: 1024 }),
  /** Calendar the event was written to (usually "primary"). */
  googleCalendarId: varchar("googleCalendarId", { length: 320 }),
  /** Result of the last Google Calendar sync attempt. */
  googleSyncStatus: mysqlEnum("googleSyncStatus", ["not_synced", "synced", "error"]).default("not_synced").notNull(),
  googleSyncError: varchar("googleSyncError", { length: 500 }),
  /** Overall invite state across all attendees (native Google invites or ICS email fallback). */
  inviteStatus: mysqlEnum("inviteStatus", ["none", "pending", "sent", "partial", "failed"]).default("none").notNull(),
  /** Minutes before start for a Google reminder; null = none. 15/30/60/120/1440. */
  reminderMinutes: int("reminderMinutes"),
  /** Whether a Google Meet link should be attached to the event. */
  googleMeetRequested: boolean("googleMeetRequested").default(false).notNull(),
  /** Meet URL captured from the created event. */
  googleMeetUrl: varchar("googleMeetUrl", { length: 512 }),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

/**
 * Appointment attendees (Task 8) — internal coworkers, the customer, and
 * external guests invited to an appointment. One row per invited email.
 */
export const appointmentAttendees = mysqlTable(
  "appointmentAttendees",
  {
    id: int("id").autoincrement().primaryKey(),
    appointmentId: int("appointmentId").notNull(),
    /** teamMembers.id when role="team_member"/"organizer"; null for customer/guest. */
    teamMemberId: int("teamMemberId"),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 255 }),
    role: mysqlEnum("role", ["organizer", "team_member", "customer", "guest"]).notNull(),
    /** Invite lifecycle: pending → sent (Google/ICS) → accepted/declined/tentative, or failed. */
    inviteStatus: mysqlEnum("inviteStatus", ["pending", "sent", "accepted", "declined", "tentative", "failed"])
      .default("pending")
      .notNull(),
    respondedAt: timestamp("respondedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    appointmentIdx: index("appointmentAttendees_appointmentId_idx").on(table.appointmentId),
  }),
);
export type AppointmentAttendee = typeof appointmentAttendees.$inferSelect;
export type InsertAppointmentAttendee = typeof appointmentAttendees.$inferInsert;

/**
 * Google Calendar OAuth connection (Task 8). Mirrors quickbooksConnections:
 * a single active connection; access/refresh tokens AES-256-GCM encrypted at
 * rest, NEVER logged or returned to the client.
 */
export const googleCalendarConnections = mysqlTable("googleCalendarConnections", {
  id: int("id").autoincrement().primaryKey(),
  /** Google account this connection authenticates as. */
  googleAccountEmail: varchar("googleAccountEmail", { length: 320 }).notNull().unique(),
  /** Target calendar events are written to (default "primary"). */
  googleCalendarId: varchar("googleCalendarId", { length: 320 }).default("primary").notNull(),
  /** AES-256-GCM ciphertext (iv:tag:data hex). NEVER logged, NEVER sent to client. */
  accessTokenEncrypted: text("accessTokenEncrypted").notNull(),
  /** Google refresh tokens do NOT rotate on refresh; kept for the life of the grant. */
  refreshTokenEncrypted: text("refreshTokenEncrypted").notNull(),
  scope: text("scope"),
  /** When the current access token expires (~1h from issue). */
  expiresAt: timestamp("expiresAt").notNull(),
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
  lastRefreshAt: timestamp("lastRefreshAt"),
  lastSyncAt: timestamp("lastSyncAt"),
  status: mysqlEnum("status", ["connected", "expired", "revoked", "error"]).default("connected").notNull(),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GoogleCalendarConnection = typeof googleCalendarConnections.$inferSelect;
export type InsertGoogleCalendarConnection = typeof googleCalendarConnections.$inferInsert;

/**
 * Team members table for email/password dashboard access.
 * Separate from Manus OAuth users — allows owner to invite staff.
 */
export const teamMembers = mysqlTable("teamMembers", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: text("passwordHash"),
  role: mysqlEnum("role", ["admin", "member", "viewer"]).default("member").notNull(),
  status: mysqlEnum("status", ["invited", "active", "suspended"]).default("invited").notNull(),
  inviteToken: varchar("inviteToken", { length: 128 }),
  inviteExpiresAt: timestamp("inviteExpiresAt"),
  resetToken: varchar("resetToken", { length: 128 }),
  resetExpiresAt: timestamp("resetExpiresAt"),
  invitedBy: varchar("invitedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn"),
});
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

/**
 * SMS Campaign Contacts — imported from Excel, used for TextBelt drip campaigns
 */
export const smsContacts = mysqlTable("smsContacts", {
  id: int("id").autoincrement().primaryKey(),
  firstName: varchar("firstName", { length: 255 }).notNull(),
  lastName: varchar("lastName", { length: 255 }),
  phone: varchar("phone", { length: 50 }).notNull(),
  email: varchar("email", { length: 320 }),
  zip: varchar("zip", { length: 20 }),
  segment: mysqlEnum("segment", ["A", "B", "C"]).default("A").notNull(),
  leadStatus: varchar("leadStatus", { length: 100 }),
  smsTag: varchar("smsTag", { length: 255 }),
  optedOut: boolean("optedOut").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SmsContact = typeof smsContacts.$inferSelect;
export type InsertSmsContact = typeof smsContacts.$inferInsert;

/**
 * SMS Campaigns — 3-message drip sequence definitions
 */
export const smsCampaigns = mysqlTable("smsCampaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  message1: text("message1").notNull(), // Day 1
  message2: text("message2").notNull(), // Day 4
  message3: text("message3").notNull(), // Day 10
  status: mysqlEnum("status", ["draft", "active", "paused", "completed"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SmsCampaign = typeof smsCampaigns.$inferSelect;
export type InsertSmsCampaign = typeof smsCampaigns.$inferInsert;

/**
 * SMS Sends — log of every text sent to a contact
 */
export const smsSends = mysqlTable("smsSends", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  campaignId: int("campaignId"),
  messageNum: int("messageNum").notNull(), // 1, 2, or 3
  messageText: text("messageText").notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  status: mysqlEnum("status", ["sent", "failed", "pending"]).default("pending").notNull(),
  textBeltId: varchar("textBeltId", { length: 255 }),
  errorMessage: text("errorMessage"),
  quotaRemaining: int("quotaRemaining"),
  // ── Final delivery tracking (Task 6.5) ─────────────────────
  // "status" above = API acceptance ("sent" = accepted by Telnyx).
  // deliveryStatus = the FINAL carrier outcome, set by the Telnyx
  // delivery-status webhook. NULL = pending / pre-feature rows.
  deliveryStatus: mysqlEnum("deliveryStatus", [
    "accepted", "sent", "delivered", "delivery_failed", "rejected", "carrier_filtered",
  ]),
  deliveryErrorCode: varchar("deliveryErrorCode", { length: 16 }),
  deliveryErrorMessage: varchar("deliveryErrorMessage", { length: 500 }),
  deliveredAt: timestamp("deliveredAt"),
  deliveryUpdatedAt: timestamp("deliveryUpdatedAt"),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});
export type SmsSend = typeof smsSends.$inferSelect;
export type InsertSmsSend = typeof smsSends.$inferInsert;

/**
 * Scheduled SMS Sends — queue for auto Day 4 / Day 10 drip messages
 */
export const scheduledSends = mysqlTable("scheduledSends", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  campaignId: int("campaignId"),
  messageNum: int("messageNum").notNull(), // 1, 2, or 3
  messageText: text("messageText").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed", "cancelled"]).default("pending").notNull(),
  smsSendId: int("smsSendId"), // FK to smsSends once processed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ScheduledSend = typeof scheduledSends.$inferSelect;
export type InsertScheduledSend = typeof scheduledSends.$inferInsert;

/**
 * SMS Inbox Messages — inbound replies from contacts (2-way SMS)
 * Stores all replies received via webhook, including STOP and regular messages
 */
export const smsInboxMessages = mysqlTable("smsInboxMessages", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId"), // FK to smsContacts (null if unknown number)
  // Best-effort links to other entities matched by phone on inbound (no new
  // contacts are ever created from a reply — see services/smsWebhook.ts).
  customerId: int("customerId"), // FK to customers (null if not matched)
  leadId: int("leadId"), // FK to leads (null if not matched)
  phone: varchar("phone", { length: 50 }).notNull(), // E.164 format
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  message: text("message").notNull(),
  isOptOut: boolean("isOptOut").default(false).notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  // For outbound replies sent from the dashboard
  sentByName: varchar("sentByName", { length: 255 }), // team member who replied
  textBeltId: varchar("textBeltId", { length: 255 }), // legacy name; stores Telnyx message id
  // Telnyx inbound message id — traceability + a secondary idempotency signal.
  providerMessageId: varchar("providerMessageId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SmsInboxMessage = typeof smsInboxMessages.$inferSelect;
export type InsertSmsInboxMessage = typeof smsInboxMessages.$inferInsert;

/**
 * SMS Webhook Events — idempotency ledger for inbound + delivery-status
 * webhooks. Telnyx stamps each delivery with a unique top-level `data.id`;
 * Telnyx (and carriers) can redeliver the same event. We record the event id
 * on first receipt and short-circuit any duplicate so opt-outs, inbox rows,
 * and delivery updates are applied at most once.
 */
export const smsWebhookEvents = mysqlTable("smsWebhookEvents", {
  // Telnyx event id (data.id) — natural primary key for dedup.
  eventId: varchar("eventId", { length: 255 }).primaryKey(),
  eventType: varchar("eventType", { length: 100 }),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
});
export type SmsWebhookEvent = typeof smsWebhookEvents.$inferSelect;
export type InsertSmsWebhookEvent = typeof smsWebhookEvents.$inferInsert;

/**
 * Rebate Calculator Submissions
 * Stores property info, calculated rebates, and assessment order requests
 */
export const rebateCalculations = mysqlTable("rebateCalculations", {
  id: int("id").autoincrement().primaryKey(),
  // Customer linkage (Phase 1)
  customerId: int("customerId"),
  // Contact info
  firstName: varchar("firstName", { length: 255 }).notNull(),
  lastName: varchar("lastName", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  // Property info
  address: varchar("address", { length: 500 }).notNull(),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 50 }),
  zip: varchar("zip", { length: 20 }),
  propertyType: mysqlEnum("propertyType", ["single_family", "multi_family", "condo", "townhouse"]).default("single_family"),
  squareFootage: int("squareFootage"),
  bedrooms: int("bedrooms"),
  bathrooms: int("bathrooms"),
  stories: int("stories"),
  currentSystem: mysqlEnum("currentSystem", ["gas_furnace", "oil_furnace", "electric_baseboard", "central_ac", "heat_pump", "window_ac", "none"]),
  systemAge: int("systemAge"), // years
  // Calculated rebates (stored as cents to avoid float issues)
  psegRebateCents: int("psegRebateCents"),
  federalTaxCreditCents: int("federalTaxCreditCents"),
  totalRebateCents: int("totalRebateCents"),
  // Selected option
  selectedOption: mysqlEnum("selectedOption", ["high_efficiency", "standard"]),
  selectedPaymentTier: mysqlEnum("selectedPaymentTier", ["full_finance", "deposit_12pct", "full_payment"]),
  // Project cost estimates (cents)
  projectCostCents: int("projectCostCents"),
  outOfPocketCents: int("outOfPocketCents"),
  // Assessment order
  assessmentRequested: boolean("assessmentRequested").default(false).notNull(),
  assessmentStatus: mysqlEnum("assessmentStatus", ["pending", "scheduled", "completed", "cancelled"]).default("pending"),
  assessmentNotes: text("assessmentNotes"),
  // Raw property data from address lookup (JSON)
  propertyDataJson: text("propertyDataJson"),
  // Solar interest and preferred contact
  solarInterest: mysqlEnum("solarInterest", ["yes", "no", "maybe"]),
  preferredContact: mysqlEnum("preferredContact", ["call", "text", "email"]),
  // Admin
  status: mysqlEnum("status", ["new", "contacted", "scheduled", "won", "lost"]).default("new"),
  assignedTo: varchar("assignedTo", { length: 255 }),
  internalNotes: text("internalNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type RebateCalculation = typeof rebateCalculations.$inferSelect;
export type InsertRebateCalculation = typeof rebateCalculations.$inferInsert;

/**
 * Personalized HeyGen video generation jobs.
 * Tracks each video request, its status, and the final URL once complete.
 */
export const personalizedVideos = mysqlTable("personalizedVideos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** HeyGen video_id returned from the generate endpoint */
  heygenVideoId: varchar("heygenVideoId", { length: 128 }).notNull(),
  /** Topic of the video: rebates | financing | solar | assessment */
  topic: mysqlEnum("topic", ["rebates", "financing", "solar", "assessment"]).notNull(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  /** Generation status */
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  /** Final video URL once completed */
  videoUrl: text("videoUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PersonalizedVideo = typeof personalizedVideos.$inferSelect;
export type InsertPersonalizedVideo = typeof personalizedVideos.$inferInsert;

/**
 * Calculator Registrations — homeowners register before accessing the Rebate Calculator.
 * A unique token is emailed and texted to them; clicking the link pre-populates the tool.
 */
export const calculatorRegistrations = mysqlTable("calculatorRegistrations", {
  id: int("id").autoincrement().primaryKey(),
  // Personal details collected at registration
  firstName: varchar("firstName", { length: 255 }).notNull(),
  lastName: varchar("lastName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 50 }).default("NJ"),
  zip: varchar("zip", { length: 20 }),
  // Unique access token sent via SMS + email
  token: varchar("token", { length: 128 }).notNull().unique(),
  tokenExpiresAt: timestamp("tokenExpiresAt").notNull(),
  // Tracking
  smsSent: boolean("smsSent").default(false).notNull(),
  emailSent: boolean("emailSent").default(false).notNull(),
  calculatorStarted: boolean("calculatorStarted").default(false).notNull(),
  calculatorCompleted: boolean("calculatorCompleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CalculatorRegistration = typeof calculatorRegistrations.$inferSelect;
export type InsertCalculatorRegistration = typeof calculatorRegistrations.$inferInsert;


/**
 * Courses — HVAC training courses available for enrollment
 */
export const courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  category: varchar("category", { length: 100 }).notNull(), // 'epa_608', 'nate', 'fundamentals', 'advanced', 'specialty'
  difficulty: mysqlEnum("difficulty", ["beginner", "intermediate", "advanced"]).notNull(),
  duration_hours: int("duration_hours").notNull(),
  price_per_course: int("price_per_course").notNull(), // in cents
  certification_type: varchar("certification_type", { length: 255 }).notNull(),
  instructor_name: varchar("instructor_name", { length: 255 }).notNull(),
  instructor_bio: text("instructor_bio"),
  instructor_image_url: text("instructor_image_url"),
  rating: decimal("rating", { precision: 3, scale: 1 }).default("4.5"),
  students_enrolled: int("students_enrolled").default(0),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

/**
 * Course Lessons — individual lessons/modules within a course
 */
export const courseLessons = mysqlTable("courseLessons", {
  id: int("id").autoincrement().primaryKey(),
  course_id: int("course_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  lesson_number: int("lesson_number").notNull(), // 1, 2, 3, etc.
  duration_minutes: int("duration_minutes").notNull(),
  video_url: text("video_url"), // Vimeo or YouTube URL
  video_duration: int("video_duration"), // in seconds
  content_html: text("content_html"), // Rich text lesson content
  learning_objectives: text("learning_objectives"), // JSON array
  materials_url: text("materials_url"), // PDF or downloadable resources
  is_locked: boolean("is_locked").default(false).notNull(), // Can be locked until previous lesson completed
  order: int("order").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CourseLesson = typeof courseLessons.$inferSelect;
export type InsertCourseLesson = typeof courseLessons.$inferInsert;

/**
 * Course Enrollments — tracks which students are enrolled in which courses
 */
export const courseEnrollments = mysqlTable("courseEnrollments", {
  id: int("id").autoincrement().primaryKey(),
  user_id: int("user_id").notNull(),
  course_id: int("course_id").notNull(),
  enrollment_type: mysqlEnum("enrollment_type", ["one_time", "subscription"]).notNull(),
  stripe_payment_intent_id: varchar("stripe_payment_intent_id", { length: 255 }),
  stripe_subscription_id: varchar("stripe_subscription_id", { length: 255 }),
  status: mysqlEnum("status", ["active", "completed", "cancelled", "refunded"]).default("active").notNull(),
  progress_percentage: int("progress_percentage").default(0).notNull(),
  lessons_completed: int("lessons_completed").default(0).notNull(),
  exam_score: int("exam_score"), // Final exam score (0-100)
  exam_passed: boolean("exam_passed").default(false).notNull(),
  certificate_issued: boolean("certificate_issued").default(false).notNull(),
  certificate_url: text("certificate_url"),
  certificate_issued_at: timestamp("certificate_issued_at"),
  started_at: timestamp("started_at").defaultNow().notNull(),
  completed_at: timestamp("completed_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CourseEnrollment = typeof courseEnrollments.$inferSelect;
export type InsertCourseEnrollment = typeof courseEnrollments.$inferInsert;

/**
 * Student Progress — tracks progress through individual lessons
 */
export const studentProgress = mysqlTable("studentProgress", {
  id: int("id").autoincrement().primaryKey(),
  enrollment_id: int("enrollment_id").notNull(),
  lesson_id: int("lesson_id").notNull(),
  video_watched_seconds: int("video_watched_seconds").default(0).notNull(),
  video_duration_seconds: int("video_duration_seconds").notNull(),
  is_completed: boolean("is_completed").default(false).notNull(),
  completed_at: timestamp("completed_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type StudentProgress = typeof studentProgress.$inferSelect;
export type InsertStudentProgress = typeof studentProgress.$inferInsert;

/**
 * Quiz Questions — questions for practice quizzes and final exams
 */
export const quizQuestions = mysqlTable("quizQuestions", {
  id: int("id").autoincrement().primaryKey(),
  course_id: int("course_id").notNull(),
  question_text: text("question_text").notNull(),
  question_type: mysqlEnum("question_type", ["multiple_choice", "true_false", "fill_in_blank"]).notNull(),
  options: text("options"), // JSON array of options for multiple choice
  correct_answer: text("correct_answer").notNull(),
  explanation: text("explanation"), // Explanation shown after answering
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).default("medium").notNull(),
  is_exam_question: boolean("is_exam_question").default(false).notNull(), // true = appears on final exam
  order: int("order").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type InsertQuizQuestion = typeof quizQuestions.$inferInsert;

/**
 * Quiz Attempts — tracks student quiz/exam attempts and scores
 */
export const quizAttempts = mysqlTable("quizAttempts", {
  id: int("id").autoincrement().primaryKey(),
  enrollment_id: int("enrollment_id").notNull(),
  course_id: int("course_id").notNull(),
  is_final_exam: boolean("is_final_exam").default(false).notNull(),
  score: int("score").notNull(), // 0-100
  total_questions: int("total_questions").notNull(),
  correct_answers: int("correct_answers").notNull(),
  passed: boolean("passed").default(false).notNull(), // true if score >= passing_score
  time_spent_seconds: int("time_spent_seconds"), // How long they spent on the quiz
  started_at: timestamp("started_at").notNull(),
  completed_at: timestamp("completed_at").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type InsertQuizAttempt = typeof quizAttempts.$inferInsert;

/**
 * Quiz Responses — individual question answers during a quiz attempt
 */
export const quizResponses = mysqlTable("quizResponses", {
  id: int("id").autoincrement().primaryKey(),
  attempt_id: int("attempt_id").notNull(),
  question_id: int("question_id").notNull(),
  student_answer: text("student_answer").notNull(),
  is_correct: boolean("is_correct").notNull(),
  time_spent_seconds: int("time_spent_seconds"), // Time spent on this question
  created_at: timestamp("created_at").defaultNow().notNull(),
});
export type QuizResponse = typeof quizResponses.$inferSelect;
export type InsertQuizResponse = typeof quizResponses.$inferInsert;

/**
 * Certificates — issued certificates for completed courses
 */
export const certificates = mysqlTable("certificates", {
  id: int("id").autoincrement().primaryKey(),
  enrollment_id: int("enrollment_id").notNull(),
  user_id: int("user_id").notNull(),
  course_id: int("course_id").notNull(),
  certificate_number: varchar("certificate_number", { length: 100 }).notNull().unique(), // Unique cert ID
  student_name: varchar("student_name", { length: 255 }).notNull(),
  course_title: varchar("course_title", { length: 255 }).notNull(),
  certification_type: varchar("certification_type", { length: 255 }).notNull(),
  issue_date: timestamp("issue_date").defaultNow().notNull(),
  expiration_date: timestamp("expiration_date"), // null = no expiration
  pdf_url: text("pdf_url"),
  verification_token: varchar("verification_token", { length: 128 }).notNull().unique(),
  is_verified: boolean("is_verified").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});
export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = typeof certificates.$inferInsert;

/**
 * Subscription Plans — monthly subscription options
 */
export const subscriptionPlans = mysqlTable("subscriptionPlans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // 'Starter', 'Professional', 'Premium'
  description: text("description"),
  price_per_month: int("price_per_month").notNull(), // in cents
  max_courses: int("max_courses").notNull(), // -1 = unlimited
  stripe_price_id: varchar("stripe_price_id", { length: 255 }).notNull(),
  features: text("features"), // JSON array
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

/**
 * User Subscriptions — tracks active subscriptions
 */
export const userSubscriptions = mysqlTable("userSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  user_id: int("user_id").notNull(),
  plan_id: int("plan_id").notNull(),
  stripe_subscription_id: varchar("stripe_subscription_id", { length: 255 }).notNull().unique(),
  status: mysqlEnum("status", ["active", "past_due", "cancelled", "paused"]).default("active").notNull(),
  current_period_start: timestamp("current_period_start").notNull(),
  current_period_end: timestamp("current_period_end").notNull(),
  cancelled_at: timestamp("cancelled_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

// ── Take-Off & Estimating ─────────────────────────────────────────────────

export const takeoffProjects = mysqlTable("takeoff_projects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  discipline: varchar("discipline", { length: 100 }).default("HVAC"),
  status: mysqlEnum("status", ["draft", "complete"]).default("draft").notNull(),
  notes: text("notes"),
  createdBy: varchar("createdBy", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TakeoffProject = typeof takeoffProjects.$inferSelect;
export type InsertTakeoffProject = typeof takeoffProjects.$inferInsert;

export const takeoffItems = mysqlTable("takeoff_items", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  description: text("description"),
  tag: varchar("tag", { length: 100 }),
  qty: decimal("qty", { precision: 12, scale: 2 }).default("1"),
  unit: varchar("unit", { length: 20 }).default("EA"),
  vendor: varchar("vendor", { length: 255 }),
  model: varchar("model", { length: 255 }),
  specs: text("specs"),
  source: varchar("source", { length: 255 }),
  confidence: int("confidence").default(0),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }).default("0"),
  notes: text("notes"),
});
export type TakeoffItem = typeof takeoffItems.$inferSelect;
export type InsertTakeoffItem = typeof takeoffItems.$inferInsert;

export const takeoffFindings = mysqlTable("takeoff_findings", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  type: varchar("type", { length: 20 }).default("info"),
  title: varchar("title", { length: 500 }),
  body: text("body"),
  source: varchar("source", { length: 255 }),
});
export type TakeoffFinding = typeof takeoffFindings.$inferSelect;
export type InsertTakeoffFinding = typeof takeoffFindings.$inferInsert;

export const takeoffVeSuggestions = mysqlTable("takeoff_ve_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  veType: varchar("veType", { length: 30 }).default("substitution"),
  itemDescription: text("itemDescription"),
  currentSpec: text("currentSpec"),
  alternativeSpec: text("alternativeSpec"),
  vendor: varchar("vendor", { length: 255 }),
  model: varchar("model", { length: 255 }),
  estimatedSavings: decimal("estimatedSavings", { precision: 12, scale: 2 }).default("0"),
  savingsPercent: decimal("savingsPercent", { precision: 5, scale: 1 }).default("0"),
  tradeOffs: text("tradeOffs"),
  codeCompliant: boolean("codeCompliant").default(true),
  affectedItems: text("affectedItems"),
  implementationNotes: text("implementationNotes"),
  status: mysqlEnum("status", ["pending", "applied", "rejected"]).default("pending").notNull(),
});
export type TakeoffVeSuggestion = typeof takeoffVeSuggestions.$inferSelect;
export type InsertTakeoffVeSuggestion = typeof takeoffVeSuggestions.$inferInsert;

export const takeoffFiles = mysqlTable("takeoff_files", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  fileSize: int("fileSize"),
  pages: int("pages"),
  analyzedAt: timestamp("analyzedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TakeoffFile = typeof takeoffFiles.$inferSelect;
export type InsertTakeoffFile = typeof takeoffFiles.$inferInsert;

/**
 * Customers — the canonical person/company entity for operations.
 * Leads and captures convert into customers; appointments, calls, and
 * rebate calculations link here. QuickBooks fields are prepared for a
 * later Phase 2 integration and MUST NOT be wired to any API yet.
 */
export const customers = mysqlTable(
  "customers",
  {
    id: int("id").autoincrement().primaryKey(),
    type: mysqlEnum("type", ["residential", "commercial"]).default("residential").notNull(),
    firstName: varchar("firstName", { length: 255 }),
    lastName: varchar("lastName", { length: 255 }),
    companyName: varchar("companyName", { length: 255 }),
    /** Computed on write: companyName, or "firstName lastName". Always present for display/search. */
    displayName: varchar("displayName", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 50 }),
    altPhone: varchar("altPhone", { length: 50 }),
    status: mysqlEnum("status", ["active", "inactive", "archived"]).default("active").notNull(),
    /** Marketing source carried over from the originating lead/capture */
    source: varchar("source", { length: 255 }),
    notes: text("notes"),
    /** Team member responsible for this customer (teamMembers.id) */
    assignedToId: int("assignedToId"),
    // ── QuickBooks-ready fields (Phase 2 — display only for now) ──
    quickbooksCustomerId: varchar("quickbooksCustomerId", { length: 64 }).unique(),
    quickbooksSyncStatus: mysqlEnum("quickbooksSyncStatus", ["not_synced", "pending", "synced", "error"])
      .default("not_synced")
      .notNull(),
    quickbooksSyncedAt: timestamp("quickbooksSyncedAt"),
    quickbooksSyncError: text("quickbooksSyncError"),
    /**
     * QBO Customer.MetaData.LastUpdatedTime of the QBO record version we last
     * APPLIED. Semantics = "which QBO version's data is reflected here" (drives
     * the freshness/"is the QBO record newer?" guard). It is NOT "last time we
     * checked QBO" — that is quickbooksCustomerCheckedAt.
     */
    quickbooksCustomerUpdatedAt: timestamp("quickbooksCustomerUpdatedAt"),
    /**
     * Last time a direct QBO Customer fetch was successfully retrieved AND
     * evaluated for this row — set on every successful refresh even when no
     * field changed. Lets us prove a customer was reconciled without relying on
     * a changed estimate. Distinct from quickbooksCustomerUpdatedAt (applied
     * version). Null = never directly refreshed.
     */
    quickbooksCustomerCheckedAt: timestamp("quickbooksCustomerCheckedAt"),
    /** True when a QBO sync found a field value conflicting with existing CRM data (see customerSyncConflicts). */
    hasQboConflicts: boolean("hasQboConflicts").default(false).notNull(),
    // ── Billing address (mapped from QBO Customer.BillAddr; service address lives in `properties`) ──
    billingLine1: varchar("billingLine1", { length: 255 }),
    billingLine2: varchar("billingLine2", { length: 255 }),
    billingCity: varchar("billingCity", { length: 120 }),
    billingState: varchar("billingState", { length: 10 }),
    billingZip: varchar("billingZip", { length: 20 }),
    // ── Provenance ──
    convertedFromLeadId: int("convertedFromLeadId"),
    convertedFromCaptureId: int("convertedFromCaptureId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    phoneIdx: index("customers_phone_idx").on(table.phone),
    emailIdx: index("customers_email_idx").on(table.email),
    displayNameIdx: index("customers_displayName_idx").on(table.displayName),
  }),
);
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * Properties — service locations belonging to a customer.
 * A customer can have many properties (home, rental units, commercial sites).
 */
export const properties = mysqlTable(
  "properties",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    /** Human label, e.g. "Home", "Warehouse", "Unit 4B" */
    label: varchar("label", { length: 255 }),
    addressLine1: varchar("addressLine1", { length: 255 }).notNull(),
    addressLine2: varchar("addressLine2", { length: 255 }),
    city: varchar("city", { length: 120 }),
    state: varchar("state", { length: 10 }).default("NJ"),
    zip: varchar("zip", { length: 20 }),
    propertyType: mysqlEnum("propertyType", ["residential", "commercial"]).default("residential").notNull(),
    squareFeet: int("squareFeet"),
    /** Matches rebate-calculator vocabulary, e.g. "gas_furnace", "oil_boiler" */
    existingSystem: varchar("existingSystem", { length: 255 }),
    systemNotes: text("systemNotes"),
    isPrimary: boolean("isPrimary").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    customerIdx: index("properties_customerId_idx").on(table.customerId),
  }),
);
export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

/**
 * Jobs — the OPERATIONAL system of record (Phase 2, Task 6).
 * Architecture: Customer → Property → Job → many Appointments.
 * A Job owns the work; appointments are visits under it; line items are the
 * raw material for the future QuickBooks estimate. QuickBooks fields below
 * are PREPARED ONLY — no sync logic exists yet and none may be added in Task 6.
 */
export const jobs = mysqlTable(
  "jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Human-facing number, e.g. "ME-2026-0042". Assigned right after insert (derived from id — race-free). */
    jobNumber: varchar("jobNumber", { length: 32 }).notNull().default(""),
    customerId: int("customerId").notNull(),
    propertyId: int("propertyId"),
    /**
     * The Opportunity this Job was converted from (Phase A: Opportunity → Job).
     * Nullable: jobs created via other paths (appointment, manual) have none.
     * One opportunity may produce MANY jobs; the standard "Convert to Job"
     * action is idempotent and returns the first (primary) converted job.
     * No DB-level FK — this codebase enforces relations in application code
     * (matching every other *Id column); integrity is validated in
     * opportunityToJob.ts before any write.
     */
    opportunityId: int("opportunityId"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    jobType: mysqlEnum("jobType", [
      "service_call", "diagnostic", "repair", "maintenance", "installation",
      "replacement", "estimate", "commercial_hvac", "residential_hvac",
      "boiler", "furnace", "ac", "heat_pump", "mini_split", "rooftop_unit",
      "refrigeration", "other",
    ]),
    priority: mysqlEnum("priority", ["normal", "urgent", "emergency"]).default("normal").notNull(),
    status: mysqlEnum("status", [
      "new", "scheduled", "in_progress", "waiting_parts", "estimate_sent",
      "approved", "completed", "invoice_sent", "paid", "closed", "cancelled",
    ]).default("new").notNull(),
    /** Technician / team member responsible (teamMembers.id) */
    assignedToId: int("assignedToId"),
    equipmentServiced: text("equipmentServiced"),
    internalNotes: text("internalNotes"),
    /** Notes safe to show the customer (distinct from internalNotes). */
    customerVisibleNotes: text("customerVisibleNotes"),
    /** Warranty classification for the work. Nullable = not a warranty job / unclassified. */
    warrantyStatus: mysqlEnum("warrantyStatus", ["none", "manufacturer", "labor", "extended", "warranty_call"]),
    /** Free-text summary written when the job is completed. */
    completionSummary: text("completionSummary"),
    /** The appointment this job originated from (Job created from an appointment). Nullable. */
    originatingAppointmentId: int("originatingAppointmentId"),
    /** Team member who created the job (teamMembers.id). Nullable for historical/system rows. */
    createdById: int("createdById"),
    // ── Scheduling / actuals (nullable; additive) ──
    scheduledStartAt: timestamp("scheduledStartAt"),
    scheduledEndAt: timestamp("scheduledEndAt"),
    actualArrivalAt: timestamp("actualArrivalAt"),
    actualCompletionAt: timestamp("actualCompletionAt"),
    /** Set automatically when status first reaches "completed" */
    completedAt: timestamp("completedAt"),
    /** Soft-delete timestamp. Null = active; non-null = archived (restore by clearing). */
    archivedAt: timestamp("archivedAt"),
    // ── QuickBooks-ready fields (Phase 2 later tasks — display only, NO sync logic) ──
    quickbooksEstimateId: varchar("quickbooksEstimateId", { length: 64 }),
    quickbooksInvoiceId: varchar("quickbooksInvoiceId", { length: 64 }),
    quickbooksSyncStatus: mysqlEnum("quickbooksSyncStatus", ["not_synced", "pending", "synced", "error"])
      .default("not_synced")
      .notNull(),
    quickbooksSyncedAt: timestamp("quickbooksSyncedAt"),
    quickbooksSyncError: text("quickbooksSyncError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    customerIdx: index("jobs_customerId_idx").on(table.customerId),
    statusIdx: index("jobs_status_idx").on(table.status),
    jobNumberIdx: index("jobs_jobNumber_idx").on(table.jobNumber),
    opportunityIdx: index("jobs_opportunityId_idx").on(table.opportunityId),
    archivedIdx: index("jobs_archivedAt_idx").on(table.archivedAt),
  }),
);
export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

/**
 * Job line items — labor/parts/services on a job.
 * These become QuickBooks estimate lines in a later task; keep amounts exact.
 */
export const jobLineItems = mysqlTable(
  "jobLineItems",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull(),
    type: mysqlEnum("type", ["labor", "part", "service", "equipment", "other"]).default("labor").notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1").notNull(),
    unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).default("0").notNull(),
    /** quantity × unitPrice, maintained on every write (source of truth for totals) */
    total: decimal("total", { precision: 12, scale: 2 }).default("0").notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    jobIdx: index("jobLineItems_jobId_idx").on(table.jobId),
  }),
);
export type JobLineItem = typeof jobLineItems.$inferSelect;
export type InsertJobLineItem = typeof jobLineItems.$inferInsert;

/**
 * Job labor entries — operational time logged against a job by a technician.
 * Normalized (one row per entry), NOT stored as JSON on the job. Operational
 * only: no payroll, no billing export, no QuickBooks item sync.
 */
export const jobLaborEntries = mysqlTable(
  "jobLaborEntries",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull(),
    /** teamMembers.id who performed the work. Nullable = unassigned/backfilled. */
    technicianId: int("technicianId"),
    /** Calendar date the work happened (YYYY-MM-DD). */
    workDate: timestamp("workDate"),
    startTime: timestamp("startTime"),
    endTime: timestamp("endTime"),
    /** Duration in minutes. Stored explicitly so partial/manual entries don't require start+end. */
    durationMinutes: int("durationMinutes"),
    description: varchar("description", { length: 500 }).notNull(),
    /** Whether this labor is billable to the customer (display/estimating only). */
    billable: boolean("billable").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    jobIdx: index("jobLaborEntries_jobId_idx").on(table.jobId),
  }),
);
export type JobLaborEntry = typeof jobLaborEntries.$inferSelect;
export type InsertJobLaborEntry = typeof jobLaborEntries.$inferInsert;

/**
 * Job material / part line items used on a job. Normalized child table.
 * Operational only — NO inventory, purchasing, warehouse, vendor ordering, or
 * QuickBooks item synchronization. unitCost is internal; unitPrice is customer-facing.
 */
export const jobPartsItems = mysqlTable(
  "jobPartsItems",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull(),
    itemName: varchar("itemName", { length: 255 }).notNull(),
    description: varchar("description", { length: 500 }),
    quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1").notNull(),
    unit: varchar("unit", { length: 32 }),
    /** Internal cost (what we pay). Display/margin only; never synced. */
    unitCost: decimal("unitCost", { precision: 10, scale: 2 }).default("0").notNull(),
    /** Customer-facing price. */
    unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).default("0").notNull(),
    billable: boolean("billable").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    jobIdx: index("jobPartsItems_jobId_idx").on(table.jobId),
  }),
);
export type JobPartsItem = typeof jobPartsItems.$inferSelect;
export type InsertJobPartsItem = typeof jobPartsItems.$inferInsert;

/**
 * Additional technicians assigned to a job (beyond the primary jobs.assignedToId).
 * One row per extra technician; the primary assignee is NOT duplicated here.
 */
export const jobTechnicians = mysqlTable(
  "jobTechnicians",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull(),
    technicianId: int("technicianId").notNull(),
    /** Optional role on this job, e.g. "helper", "lead". */
    role: varchar("role", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    jobIdx: index("jobTechnicians_jobId_idx").on(table.jobId),
    /** A technician appears at most once per job. */
    jobTechUnique: index("jobTechnicians_job_tech_unique").on(table.jobId, table.technicianId),
  }),
);
export type JobTechnician = typeof jobTechnicians.$inferSelect;
export type InsertJobTechnician = typeof jobTechnicians.$inferInsert;

/**
 * Timestamped notes on a job (multiple). The single-value internalNotes /
 * customerVisibleNotes fields on the job stay for quick access; this table is
 * the running log. visibility controls whether a note is customer-safe.
 */
export const jobNotes = mysqlTable(
  "jobNotes",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull(),
    body: text("body").notNull(),
    visibility: mysqlEnum("visibility", ["internal", "customer"]).default("internal").notNull(),
    /** teamMembers.id who wrote the note. Nullable for system notes. */
    authorId: int("authorId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    jobIdx: index("jobNotes_jobId_idx").on(table.jobId),
  }),
);
export type JobNote = typeof jobNotes.$inferSelect;
export type InsertJobNote = typeof jobNotes.$inferInsert;

/**
 * Attachments / photos on a job. Stores a reference (URL/path) plus metadata —
 * the binary itself lives wherever the app already stores uploads.
 */
export const jobAttachments = mysqlTable(
  "jobAttachments",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull(),
    kind: mysqlEnum("kind", ["photo", "document", "other"]).default("photo").notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    /** URL or storage path/key to the file. */
    url: varchar("url", { length: 1024 }).notNull(),
    mimeType: varchar("mimeType", { length: 128 }),
    sizeBytes: int("sizeBytes"),
    /** teamMembers.id who uploaded. Nullable. */
    uploadedById: int("uploadedById"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    jobIdx: index("jobAttachments_jobId_idx").on(table.jobId),
  }),
);
export type JobAttachment = typeof jobAttachments.$inferSelect;
export type InsertJobAttachment = typeof jobAttachments.$inferInsert;

/**
 * Job status history — one row per status transition, for the audit trail on
 * the job detail. Written whenever the job status changes.
 */
export const jobStatusHistory = mysqlTable(
  "jobStatusHistory",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull(),
    /** Previous status; null for the initial/creation entry. */
    fromStatus: varchar("fromStatus", { length: 32 }),
    toStatus: varchar("toStatus", { length: 32 }).notNull(),
    note: varchar("note", { length: 500 }),
    /** teamMembers.id who made the change. Nullable for system transitions. */
    changedById: int("changedById"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    jobIdx: index("jobStatusHistory_jobId_idx").on(table.jobId),
  }),
);
export type JobStatusHistory = typeof jobStatusHistory.$inferSelect;
export type InsertJobStatusHistory = typeof jobStatusHistory.$inferInsert;

/**
 * QuickBooks Online connection (Phase 2, Task 7 — Accounting Integration).
 * Stores the OAuth token pair for one Intuit company (realm). Tokens are
 * AES-256-GCM encrypted at rest (see server/_core/crypto.ts) and NEVER
 * returned to the client. Single-connection semantics in the UI (one realm),
 * but the table supports multiple realms via the unique realmId.
 */
export const quickbooksConnections = mysqlTable(
  "quickbooksConnections",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Intuit company/realm id — the tenant this connection is scoped to. */
    realmId: varchar("realmId", { length: 64 }).notNull().unique(),
    companyName: varchar("companyName", { length: 255 }),
    /** AES-256-GCM ciphertext (iv:tag:data hex). NEVER logged, NEVER sent to client. */
    accessTokenEncrypted: text("accessTokenEncrypted").notNull(),
    refreshTokenEncrypted: text("refreshTokenEncrypted").notNull(),
    /** When the current access token expires (~1h from issue). */
    expiresAt: timestamp("expiresAt").notNull(),
    /** When the current refresh token expires (~100 days; rotates on each refresh). */
    refreshExpiresAt: timestamp("refreshExpiresAt"),
    connectedAt: timestamp("connectedAt").defaultNow().notNull(),
    lastRefreshAt: timestamp("lastRefreshAt"),
    lastSyncAt: timestamp("lastSyncAt"),
    /**
     * Incremental sales-document sync cursor: the max QBO
     * MetaData.LastUpdatedTime processed so far. Null = never synced (the next
     * run does the 60-day backfill). Advanced ONLY after a batch fully succeeds.
     */
    salesDocCursor: timestamp("salesDocCursor"),
    /** When the sales-document sync last completed (success or attempt). */
    salesDocLastSyncAt: timestamp("salesDocLastSyncAt"),
    status: mysqlEnum("status", ["connected", "expired", "revoked", "error"]).default("connected").notNull(),
    lastError: text("lastError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
);
export type QuickbooksConnection = typeof quickbooksConnections.$inferSelect;
export type InsertQuickbooksConnection = typeof quickbooksConnections.$inferInsert;

/**
 * QuickBooks sync log — one row per push/pull attempt, for the audit trail
 * and the recent-activity list on the Integrations page.
 */
export const quickbooksSyncLogs = mysqlTable(
  "quickbooksSyncLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    entityType: mysqlEnum("entityType", ["customer", "estimate", "invoice", "payment"]).notNull(),
    /** Local entity id (e.g. customers.id) this log refers to. */
    entityId: int("entityId"),
    direction: mysqlEnum("direction", ["push", "pull"]).notNull(),
    realmId: varchar("realmId", { length: 64 }),
    success: boolean("success").notNull(),
    durationMs: int("durationMs"),
    /** QuickBooks entity id involved (if any). */
    qbId: varchar("qbId", { length: 64 }),
    errorCode: varchar("errorCode", { length: 64 }),
    errorMessage: text("errorMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    entityIdx: index("quickbooksSyncLogs_entity_idx").on(table.entityType, table.entityId),
    createdIdx: index("quickbooksSyncLogs_createdAt_idx").on(table.createdAt),
  }),
);
export type QuickbooksSyncLog = typeof quickbooksSyncLogs.$inferSelect;
export type InsertQuickbooksSyncLog = typeof quickbooksSyncLogs.$inferInsert;

/**
 * Opportunities — the sales-pipeline record surfaced in the Opportunity Center.
 * Distinct from `jobs` (operational/work execution): an opportunity tracks a
 * deal from proposal → won/lost. For QuickBooks-sourced deals there is one
 * opportunity per sales document; QuickBooks stays the source of truth and we
 * only mirror in (never push edits out).
 */
export const opportunities = mysqlTable(
  "opportunities",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    /** Where the opportunity originated, e.g. "quickbooks". */
    source: varchar("source", { length: 64 }).default("quickbooks").notNull(),
    stage: mysqlEnum("stage", ["new", "proposal_sent", "pending", "won", "lost"]).default("new").notNull(),
    /**
     * CRM Opportunity Value (editable). Defaults to the backing QBO document's
     * totalAmount via sync, but is the field a salesperson may override.
     * The read-only QuickBooks Amount lives on quickbooksSalesDocuments.totalAmount.
     */
    amount: decimal("amount", { precision: 12, scale: 2 }).default("0").notNull(),
    /** Win probability 0–100. weightedValue = amount × probability/100. */
    probability: int("probability"),
    /** True once a human edits the value — sync then stops overwriting `amount`. */
    amountOverridden: boolean("amountOverridden").default(false).notNull(),
    /** True once a human moves the stage — sync then stops overwriting `stage`. */
    stageOverridden: boolean("stageOverridden").default(false).notNull(),
    /**
     * Derived Residential/Commercial/Change-Order category, persisted at sync
     * (via deriveWorkCategory) so it is server-side filterable/sortable. Null
     * until first computed; UI falls back to on-the-fly derivation.
     */
    workCategory: mysqlEnum("workCategory", ["residential", "commercial", "change_order"]),
    /** Reason captured when marked Won. */
    closeReason: text("closeReason"),
    /** Reason captured when marked Lost. */
    lossReason: text("lossReason"),
    /** Short human label for the next follow-up step, shown on the dashboard. */
    nextAction: varchar("nextAction", { length: 255 }),
    nextActionDueAt: timestamp("nextActionDueAt"),
    /** The primary QuickBooks sales document backing this opportunity (quickbooksSalesDocuments.id). */
    quickbooksSalesDocumentId: int("quickbooksSalesDocumentId"),
    /**
     * Dedicated project reference parsed out of a composite QuickBooks customer
     * DisplayName (e.g. "PN#132"). Kept OFF the customer identity so a project
     * code never contaminates a Contact name. Null for non-project deals.
     * Interim home until a dedicated Projects module exists.
     */
    projectReference: varchar("projectReference", { length: 64 }),
    /** Sales owner of the deal. Kept as the legacy name for compatibility. */
    assignedToId: int("assignedToId"),
    closedAt: timestamp("closedAt"),

    // --- Commercial Opportunities (Phase 1, migration 0042). All additive/nullable. ---
    /**
     * Workspace discriminator. Legacy QuickBooks-synced deals stay
     * "qbo_residential" (default) and keep using the `stage` enum + salesDocSync.
     * "commercial" (and future kinds) use the configurable `stageId` pipeline.
     */
    recordType: mysqlEnum("recordType", [
      "qbo_residential",
      "commercial",
      "residential",
      "maintenance",
      "service_contract",
    ])
      .default("qbo_residential")
      .notNull(),
    /** Configurable pipeline stage (opportunityStages.id) — used by non-QBO records. */
    stageId: int("stageId"),
    /** Coarse open/won/lost classification for commercial records (derived from stage). */
    status: mysqlEnum("status", ["open", "awarded", "lost", "on_hold", "cancelled"]),
    /** Human-facing identifier, e.g. "OPP-2026-0042"; generated from id on create. */
    opportunityNumber: varchar("opportunityNumber", { length: 32 }),
    description: text("description"),
    opportunityType: mysqlEnum("opportunityType", [
      "commercial",
      "residential",
      "public_work",
      "decarbonization",
      "direct_replacement",
      "new_construction",
      "service_contract",
      "preventive_maintenance",
      "other",
    ]),
    priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]),
    /** Primary contact — a customers.id (customers IS the person/company entity). */
    primaryContactId: int("primaryContactId"),
    /** Job/site property (properties.id). Opportunities previously reached this via the customer. */
    propertyId: int("propertyId"),
    estimatorId: int("estimatorId"),
    projectManagerId: int("projectManagerId"),
    /** Internal cost estimate. `amount` remains the (sell) value; margin = amount − cost. */
    estimatedCost: decimal("estimatedCost", { precision: 12, scale: 2 }),
    /** Optional override of the derived gross margin (amount − estimatedCost). */
    estimatedGrossMargin: decimal("estimatedGrossMargin", { precision: 12, scale: 2 }),
    bidDueAt: timestamp("bidDueAt"),
    siteVisitAt: timestamp("siteVisitAt"),
    proposalDueAt: timestamp("proposalDueAt"),
    proposalSentAt: timestamp("proposalSentAt"),
    followUpAt: timestamp("followUpAt"),
    expectedCloseAt: timestamp("expectedCloseAt"),
    awardedAt: timestamp("awardedAt"),
    lostAt: timestamp("lostAt"),
    /** Free label for the channel used to communicate on this deal (Teams, email, etc.). */
    communicationPlatform: varchar("communicationPlatform", { length: 64 }),
    /** External system reference (GC bid portal id, Procore, etc.). */
    externalReference: varchar("externalReference", { length: 128 }),
    createdBy: int("createdBy"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    customerIdx: index("opportunities_customerId_idx").on(table.customerId),
    stageIdx: index("opportunities_stage_idx").on(table.stage),
    projectRefIdx: index("opportunities_projectReference_idx").on(table.projectReference),
    recordTypeIdx: index("opportunities_recordType_idx").on(table.recordType),
    stageIdIdx: index("opportunities_stageId_idx").on(table.stageId),
    opportunityNumberIdx: index("opportunities_opportunityNumber_idx").on(table.opportunityNumber),
    propertyIdx: index("opportunities_propertyId_idx").on(table.propertyId),
    assignedRecordTypeIdx: index("opportunities_assignedTo_recordType_idx").on(table.assignedToId, table.recordType),
  }),
);
export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = typeof opportunities.$inferInsert;

/**
 * QuickBooks Sales Documents — local mirror of QBO Estimates/Proposals.
 * QuickBooks is the source of truth; rows here exist for dashboard visibility
 * and follow-up only. Keyed by `quickbooksId` (unique) — the idempotency anchor
 * that guarantees re-syncing the same estimate never creates a duplicate.
 * `docType` reserves "invoice" for a later task; only "estimate" is synced now.
 */
export const quickbooksSalesDocuments = mysqlTable(
  "quickbooksSalesDocuments",
  {
    id: int("id").autoincrement().primaryKey(),
    realmId: varchar("realmId", { length: 64 }),
    /** QBO Estimate.Id — unique per realm; the sync idempotency key. */
    quickbooksId: varchar("quickbooksId", { length: 64 }).notNull().unique(),
    docType: mysqlEnum("docType", ["estimate", "invoice"]).default("estimate").notNull(),
    docNumber: varchar("docNumber", { length: 64 }),
    /** QBO CustomerRef value — used to resolve/auto-create the local contact. */
    quickbooksCustomerId: varchar("quickbooksCustomerId", { length: 64 }),
    /** Resolved local contact (customers.id); null only if resolution failed. */
    customerId: int("customerId"),
    /** The opportunity this document backs (opportunities.id). */
    opportunityId: int("opportunityId"),
    /** Normalized from QBO TxnStatus (+ expiry derivation). */
    status: mysqlEnum("status", ["pending", "accepted", "closed", "rejected", "expired"]).default("pending").notNull(),
    totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).default("0").notNull(),
    /** QBO TxnDate — the document's issue date. */
    txnDate: timestamp("txnDate"),
    /** Derived from QBO EmailStatus = EmailSent; null when never sent. */
    sentAt: timestamp("sentAt"),
    /** QBO ExpirationDate, if present. */
    expiresAt: timestamp("expiresAt"),
    /** Public/shareable link if QuickBooks provides one (often absent for estimates). */
    documentLink: text("documentLink"),
    /** QBO MetaData.LastUpdatedTime — drives "is this newer?" and the sync cursor. */
    quickbooksUpdatedAt: timestamp("quickbooksUpdatedAt"),
    /** Full QBO payload snapshot for audit/debugging. */
    raw: json("raw"),
    lastSyncedAt: timestamp("lastSyncedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    qbCustomerIdx: index("qbSalesDocs_qbCustomerId_idx").on(table.quickbooksCustomerId),
    statusIdx: index("qbSalesDocs_status_idx").on(table.status),
    customerIdx: index("qbSalesDocs_customerId_idx").on(table.customerId),
    opportunityIdx: index("qbSalesDocs_opportunityId_idx").on(table.opportunityId),
  }),
);
export type QuickbooksSalesDocument = typeof quickbooksSalesDocuments.$inferSelect;
export type InsertQuickbooksSalesDocument = typeof quickbooksSalesDocuments.$inferInsert;

/**
 * Opportunity events — append-only audit/activity log for an opportunity
 * (customer auto-created, document synced, status changed, task created, …).
 * `type` is a free varchar so new event kinds don't require a migration.
 */
export const opportunityEvents = mysqlTable(
  "opportunityEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    opportunityId: int("opportunityId").notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    message: text("message"),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    opportunityIdx: index("opportunityEvents_opportunityId_idx").on(table.opportunityId),
  }),
);
export type OpportunityEvent = typeof opportunityEvents.$inferSelect;
export type InsertOpportunityEvent = typeof opportunityEvents.$inferInsert;

/**
 * Opportunity tasks — lightweight follow-up actions for a sent/pending deal:
 * a same-day call, plus email/text touches on a 3-day close loop.
 * - "call" tasks are worked by a human (never auto-dispatched).
 * - "email"/"text" tasks are dispatched by processDueFollowups when due.
 * - "text" tasks are created with status "gated" until 10DLC is approved
 *   (SMS_FOLLOWUPS_ENABLED=true), so no SMS goes out prematurely.
 */
export const opportunityTasks = mysqlTable(
  "opportunityTasks",
  {
    id: int("id").autoincrement().primaryKey(),
    opportunityId: int("opportunityId").notNull(),
    customerId: int("customerId"),
    type: mysqlEnum("type", ["call", "email", "text"]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    /** Message body for email/text dispatch. */
    body: text("body"),
    dueAt: timestamp("dueAt").notNull(),
    status: mysqlEnum("status", ["open", "done", "cancelled", "snoozed", "gated"]).default("open").notNull(),
    assignedToId: int("assignedToId"),
    /** Step in the 3-day close loop: 0 = same-day, 1 = day-1, 3 = day-3. */
    loopStep: int("loopStep").default(0).notNull(),
    dispatchedAt: timestamp("dispatchedAt"),
    lastError: text("lastError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    opportunityIdx: index("opportunityTasks_opportunityId_idx").on(table.opportunityId),
    dueIdx: index("opportunityTasks_status_dueAt_idx").on(table.status, table.dueAt),
  }),
);
export type OpportunityTask = typeof opportunityTasks.$inferSelect;
export type InsertOpportunityTask = typeof opportunityTasks.$inferInsert;

/**
 * Configurable opportunity pipeline (migration 0042). Rows define the stages a
 * commercial (or other non-QBO) opportunity moves through. Seeded with the 16
 * approved defaults for `pipelineKey = "commercial"`; administrators may add,
 * rename, reorder, or deactivate stages. `stageKey` is the stable internal key
 * (never displayed from the label alone); `classification` drives won/lost/open
 * behavior; `isSystem` protects seeded defaults from deletion.
 */
export const opportunityStages = mysqlTable(
  "opportunityStages",
  {
    id: int("id").autoincrement().primaryKey(),
    pipelineKey: varchar("pipelineKey", { length: 48 }).default("commercial").notNull(),
    stageKey: varchar("stageKey", { length: 48 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    /** Default win probability 0–100 applied when an opp enters this stage. */
    defaultProbability: int("defaultProbability"),
    classification: mysqlEnum("classification", ["open", "won", "lost"]).default("open").notNull(),
    isSystem: boolean("isSystem").default(false).notNull(),
    color: varchar("color", { length: 24 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    pipelineOrderIdx: index("opportunityStages_pipeline_order_idx").on(table.pipelineKey, table.sortOrder),
    pipelineStageKeyUnique: unique("opportunityStages_pipeline_stageKey_unique").on(table.pipelineKey, table.stageKey),
  }),
);
export type OpportunityStage = typeof opportunityStages.$inferSelect;
export type InsertOpportunityStage = typeof opportunityStages.$inferInsert;

/**
 * Multi-select project categories for an opportunity (migration 0043).
 * Normalized (not a JSON blob) so it is server-side filterable. Distinct from
 * pipeline stages and from opportunityType. `category` is a stable key validated
 * against shared/commercialPipeline.ts PROJECT_CATEGORY keys.
 */
export const opportunityProjectCategories = mysqlTable(
  "opportunityProjectCategories",
  {
    id: int("id").autoincrement().primaryKey(),
    opportunityId: int("opportunityId").notNull(),
    category: varchar("category", { length: 48 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    opportunityIdx: index("opportunityProjectCategories_opportunityId_idx").on(table.opportunityId),
    oppCategoryUnique: unique("opportunityProjectCategories_opp_category_unique").on(
      table.opportunityId,
      table.category,
    ),
  }),
);
export type OpportunityProjectCategory = typeof opportunityProjectCategories.$inferSelect;
export type InsertOpportunityProjectCategory = typeof opportunityProjectCategories.$inferInsert;

/**
 * Additional opportunity team members (migration 0043) beyond the owner /
 * estimator / project-manager columns on `opportunities`. `role` is a free label
 * (sales_owner, estimator, project_manager, member, …).
 */
export const opportunityMembers = mysqlTable(
  "opportunityMembers",
  {
    id: int("id").autoincrement().primaryKey(),
    opportunityId: int("opportunityId").notNull(),
    teamMemberId: int("teamMemberId").notNull(),
    role: varchar("role", { length: 48 }).default("member").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    opportunityIdx: index("opportunityMembers_opportunityId_idx").on(table.opportunityId),
    oppMemberRoleUnique: unique("opportunityMembers_opp_member_role_unique").on(
      table.opportunityId,
      table.teamMemberId,
      table.role,
    ),
  }),
);
export type OpportunityMember = typeof opportunityMembers.$inferSelect;
export type InsertOpportunityMember = typeof opportunityMembers.$inferInsert;

/**
 * Reusable checklist templates (migration 0043). A template is instantiated onto
 * an opportunity, copying its items into opportunityChecklistItems. Checklists
 * only confirm PROCESS completion — never store structured customer/project data.
 */
export const opportunityChecklistTemplates = mysqlTable("opportunityChecklistTemplates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  isSystem: boolean("isSystem").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OpportunityChecklistTemplate = typeof opportunityChecklistTemplates.$inferSelect;
export type InsertOpportunityChecklistTemplate = typeof opportunityChecklistTemplates.$inferInsert;

export const opportunityChecklistTemplateItems = mysqlTable(
  "opportunityChecklistTemplateItems",
  {
    id: int("id").autoincrement().primaryKey(),
    templateId: int("templateId").notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    /** When true, this item must be complete before Convert-to-Job is allowed. */
    requiredForConversion: boolean("requiredForConversion").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    templateIdx: index("opportunityChecklistTemplateItems_templateId_idx").on(table.templateId),
  }),
);
export type OpportunityChecklistTemplateItem = typeof opportunityChecklistTemplateItems.$inferSelect;
export type InsertOpportunityChecklistTemplateItem = typeof opportunityChecklistTemplateItems.$inferInsert;

/**
 * Per-opportunity checklist item instances (migration 0043). Support
 * complete/incomplete, assignee, due date, completion timestamp, completed-by,
 * and optional notes. `requiredForConversion` is copied from the template item
 * and consulted by the Convert-to-Job validation.
 */
export const opportunityChecklistItems = mysqlTable(
  "opportunityChecklistItems",
  {
    id: int("id").autoincrement().primaryKey(),
    opportunityId: int("opportunityId").notNull(),
    /** Provenance: the template item this was copied from (null for ad-hoc items). */
    templateItemId: int("templateItemId"),
    label: varchar("label", { length: 255 }).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    isComplete: boolean("isComplete").default(false).notNull(),
    requiredForConversion: boolean("requiredForConversion").default(false).notNull(),
    assigneeId: int("assigneeId"),
    dueAt: timestamp("dueAt"),
    completedAt: timestamp("completedAt"),
    completedById: int("completedById"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    opportunityIdx: index("opportunityChecklistItems_opportunityId_idx").on(table.opportunityId),
  }),
);
export type OpportunityChecklistItem = typeof opportunityChecklistItems.$inferSelect;
export type InsertOpportunityChecklistItem = typeof opportunityChecklistItems.$inferInsert;

/**
 * Opportunity comments (migration 0043) — human discussion, distinct from the
 * append-only `opportunityEvents` activity timeline. Edit/delete are soft
 * (editedAt/deletedAt) and gated by existing permissions in the router.
 */
export const opportunityComments = mysqlTable(
  "opportunityComments",
  {
    id: int("id").autoincrement().primaryKey(),
    opportunityId: int("opportunityId").notNull(),
    authorId: int("authorId"),
    body: text("body").notNull(),
    editedAt: timestamp("editedAt"),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    opportunityIdx: index("opportunityComments_opportunityId_idx").on(table.opportunityId),
  }),
);
export type OpportunityComment = typeof opportunityComments.$inferSelect;
export type InsertOpportunityComment = typeof opportunityComments.$inferInsert;

/**
 * Opportunity documents/attachments (migration 0043). Metadata-only, mirroring
 * jobAttachments: the binary lives elsewhere; only a URL/link is stored. `kind`
 * distinguishes an uploaded file from an external link — the clean extension
 * point for Google Drive later. `category` is one of the 18 expanded categories.
 */
export const opportunityDocuments = mysqlTable(
  "opportunityDocuments",
  {
    id: int("id").autoincrement().primaryKey(),
    opportunityId: int("opportunityId").notNull(),
    category: mysqlEnum("category", [
      "photos",
      "drone_photos",
      "videos",
      "drawings",
      "plans",
      "scope",
      "proposal",
      "estimate",
      "contract",
      "permit",
      "equipment",
      "specifications",
      "submittals",
      "rfis",
      "change_orders",
      "closeout",
      "warranty",
      "miscellaneous",
    ])
      .default("miscellaneous")
      .notNull(),
    kind: mysqlEnum("kind", ["file", "link"]).default("file").notNull(),
    fileName: varchar("fileName", { length: 255 }),
    url: varchar("url", { length: 1024 }).notNull(),
    mimeType: varchar("mimeType", { length: 128 }),
    sizeBytes: int("sizeBytes"),
    uploadedById: int("uploadedById"),
    notes: varchar("notes", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    opportunityIdx: index("opportunityDocuments_opportunityId_idx").on(table.opportunityId),
    oppCategoryIdx: index("opportunityDocuments_opp_category_idx").on(table.opportunityId, table.category),
  }),
);
export type OpportunityDocument = typeof opportunityDocuments.$inferSelect;
export type InsertOpportunityDocument = typeof opportunityDocuments.$inferInsert;

/**
 * Customer sync conflicts — append-only, human-reviewable log of how each
 * incoming QuickBooks Customer field was reconciled against existing CRM data.
 * QBO sync NEVER silently overwrites CRM data: it fills only empty fields and
 * records disagreements here.
 *
 * conflictType:
 *   - "missing"             CRM field was empty → filled from QBO (informational).
 *   - "different"           CRM and QBO both had values and they differ.
 *   - "overwrite_prevented" CRM value was kept over a differing QBO value (needs review).
 * resolution (null until acted on):
 *   - "keep_crm" | "use_qbo" | "merged".
 *
 * Dedupe: the sync writer keeps at most ONE open row per
 * (customerId, fieldName, qboValue) so repeated polls don't pile up duplicate
 * unresolved conflicts. Resolving sets status + resolution + resolvedBy/At (auditable).
 */
export const customerSyncConflicts = mysqlTable(
  "customerSyncConflicts",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    quickbooksCustomerId: varchar("quickbooksCustomerId", { length: 64 }),
    /** CRM column name, e.g. "email", "phone", "companyName". */
    fieldName: varchar("fieldName", { length: 64 }).notNull(),
    conflictType: mysqlEnum("conflictType", ["missing", "different", "overwrite_prevented"]).notNull(),
    /** Existing CRM value at the time of sync. */
    crmValue: text("crmValue"),
    /** Incoming QuickBooks value. */
    qboValue: text("qboValue"),
    status: mysqlEnum("status", ["open", "resolved", "ignored"]).default("open").notNull(),
    resolution: mysqlEnum("resolution", ["keep_crm", "use_qbo", "merged"]),
    notes: text("notes"),
    resolvedById: int("resolvedById"),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    customerIdx: index("customerSyncConflicts_customerId_idx").on(table.customerId),
    statusIdx: index("customerSyncConflicts_status_idx").on(table.status),
    /** Supports the "one open conflict per customer+field" dedupe lookup. */
    lookupIdx: index("customerSyncConflicts_customer_field_status_idx").on(
      table.customerId,
      table.fieldName,
      table.status,
    ),
  }),
);
export type CustomerSyncConflict = typeof customerSyncConflicts.$inferSelect;
export type InsertCustomerSyncConflict = typeof customerSyncConflicts.$inferInsert;

/**
 * QBO composite-customer repair audit log — one row per field-level change made
 * by the reviewed repair (or the standalone refresh apply path). Append-only.
 * Durable before→after record enabling rollback-by-run-id. No sensitive
 * financial data; emails/phones are NOT written here (they are never changed by
 * repair). `beforeValue`/`afterValue` hold the specific field's values only.
 */
export const qboRepairAuditLog = mysqlTable(
  "qboRepairAuditLog",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Unique per repair/refresh invocation — the rollback key. */
    runId: varchar("runId", { length: 64 }).notNull(),
    /** "repair" | "refresh" | "rollback". */
    kind: varchar("kind", { length: 24 }).notNull(),
    actor: varchar("actor", { length: 128 }),
    parserVersion: varchar("parserVersion", { length: 32 }),
    manifestHash: varchar("manifestHash", { length: 128 }),
    customerId: int("customerId").notNull(),
    quickbooksCustomerId: varchar("quickbooksCustomerId", { length: 64 }),
    /** Field changed, e.g. "displayName" | "firstName" | "projectReference" | "property.created". */
    fieldName: varchar("fieldName", { length: 64 }).notNull(),
    beforeValue: text("beforeValue"),
    afterValue: text("afterValue"),
    /** For property.created rows: the new properties.id. */
    createdPropertyId: int("createdPropertyId"),
    /** For project-reference rows: the opportunities.id updated. */
    opportunityId: int("opportunityId"),
    /** "applied" | "skipped" | "conflict" | "rolled_back". */
    result: varchar("result", { length: 24 }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    runIdx: index("qboRepairAuditLog_runId_idx").on(table.runId),
    customerIdx: index("qboRepairAuditLog_customerId_idx").on(table.customerId),
  }),
);
export type QboRepairAuditLog = typeof qboRepairAuditLog.$inferSelect;
export type InsertQboRepairAuditLog = typeof qboRepairAuditLog.$inferInsert;

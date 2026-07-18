import { boolean, decimal, index, int, json, mediumtext, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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
  // ── Marketing attribution (SEO/revenue attribution workstream, migration 0046) ──
  // All nullable and captured at submit time from the page's URL/referrer. First-touch
  // only: written once at creation, never overwritten. `channel` is derived
  // deterministically from gclid/UTM/referrer and defaults to "unknown" — it is NEVER
  // guessed as "organic". These feed revenue-by-page / revenue-by-source reporting.
  /** normalizePath(pageUrl) at capture — the join key to seoPages.page. */
  firstTouchLandingPath: varchar("firstTouchLandingPath", { length: 512 }),
  utmSource: varchar("utmSource", { length: 255 }),
  utmMedium: varchar("utmMedium", { length: 255 }),
  utmCampaign: varchar("utmCampaign", { length: 255 }),
  utmTerm: varchar("utmTerm", { length: 255 }),
  utmContent: varchar("utmContent", { length: 255 }),
  /** Google Ads click id — presence alone forces channel = "paid". */
  gclid: varchar("gclid", { length: 255 }),
  /** Host of document.referrer as sent by the client (e.g. "google.com"). */
  referrerHost: varchar("referrerHost", { length: 255 }),
  /** Deterministic classification; defaults to "unknown" so nothing is silently credited to organic. */
  channel: mysqlEnum("channel", ["organic", "paid", "direct", "referral", "social", "email", "unknown"]).default("unknown").notNull(),
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
  service: varchar("service", { length: 50 }).notNull(), // 'vapi', 'facebook', 'google_business'
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
 * SMS Conversations - AI VA inbound/outbound text message records (Telnyx)
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
  // ── Contact details (added 0047; all nullable so existing rows keep working) ──
  /** Given name. `name` above stays the canonical display name for assignments. */
  firstName: varchar("firstName", { length: 120 }),
  /** Family name. */
  lastName: varchar("lastName", { length: 120 }),
  /** Mobile phone, stored formatted as "(555) 123-4567". */
  mobilePhone: varchar("mobilePhone", { length: 32 }),
  streetAddress: varchar("streetAddress", { length: 255 }),
  city: varchar("city", { length: 120 }),
  /** Two-letter US state code (e.g. "NJ"). */
  state: varchar("state", { length: 2 }),
  /** 5-digit or ZIP+4 (e.g. "07001" or "07001-1234"). */
  zipCode: varchar("zipCode", { length: 10 }),
  emergencyContactName: varchar("emergencyContactName", { length: 255 }),
  emergencyContactRelationship: varchar("emergencyContactRelationship", { length: 120 }),
  emergencyContactPhone: varchar("emergencyContactPhone", { length: 32 }),
  preferredContactMethod: mysqlEnum("preferredContactMethod", ["phone", "text", "email"]),
  /** Free-form language name, e.g. "English", "Spanish". */
  preferredLanguage: varchar("preferredLanguage", { length: 64 }),
  /** Profile photo as a resized base64 data URL (image/jpeg). Client caps the size. */
  profilePhoto: mediumtext("profilePhoto"),
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
  phone: varchar("phone", { length: 50 }).notNull(), // external party number, E.164 (conversation identity)
  // Stored last-10 digits, maintained at write time. Indexed conversation key
  // that replaces repeated RIGHT(REGEXP_REPLACE(...)) scans. Nullable only for
  // pre-backfill legacy rows — queries keep a REGEXP fallback for those.
  phoneLast10: varchar("phoneLast10", { length: 10 }),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  message: text("message").notNull(),
  isOptOut: boolean("isOptOut").default(false).notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  // For outbound replies sent from the dashboard
  sentByName: varchar("sentByName", { length: 255 }), // team member who replied
  textBeltId: varchar("textBeltId", { length: 255 }), // legacy name; stores Telnyx message id (webhook match key)
  // Telnyx message id — traceability + a secondary idempotency signal. Set for
  // both inbound (received id) and outbound (sent id).
  providerMessageId: varchar("providerMessageId", { length: 255 }),
  // ── Outbound-message tracking (SMS Inbox outbound logging) ─────────────────
  // Populated so the Inbox shows the messages Mechanical sent, from/to which
  // number, via which provider, and their delivery outcome.
  fromNumber: varchar("fromNumber", { length: 50 }), // sender: Mechanical for outbound, customer for inbound
  toNumber: varchar("toNumber", { length: 50 }),     // recipient: customer for outbound, Mechanical for inbound
  provider: varchar("provider", { length: 30 }),     // "telnyx"
  source: varchar("source", { length: 50 }),         // inbox_reply|campaign|scheduled|appointment|rebate|other
  // API-acceptance → final carrier outcome, updated by the Telnyx delivery
  // webhook. NULL = inbound row or pre-feature outbound row.
  deliveryStatus: mysqlEnum("deliveryStatus", [
    "queued", "accepted", "sent", "delivered", "delivery_failed", "rejected", "carrier_filtered", "failed",
  ]),
  deliveryErrorCode: varchar("deliveryErrorCode", { length: 16 }),
  sentAt: timestamp("sentAt"), // when Telnyx accepted the outbound send
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  phoneLast10Idx: index("smsInboxMessages_phoneLast10_idx").on(table.phoneLast10),
  phoneIdx: index("smsInboxMessages_phone_idx").on(table.phone),
  textBeltIdx: index("smsInboxMessages_textBeltId_idx").on(table.textBeltId),
}));
export type SmsInboxMessage = typeof smsInboxMessages.$inferSelect;
export type InsertSmsInboxMessage = typeof smsInboxMessages.$inferInsert;

/**
 * SMS Conversation ↔ CRM links (Phase 2). One row per phone conversation
 * (keyed by phoneLast10), storing the CONFIRMED CRM entity a conversation is
 * linked to plus a remembered property selection. Links are only written on
 * explicit user action — ambiguous matches are never auto-linked and existing
 * links are never overwritten without confirmation. Appointment/job/estimate/
 * invoice are derived from the linked customer at read time (not stored here).
 */
export const smsConversationLinks = mysqlTable("smsConversationLinks", {
  id: int("id").autoincrement().primaryKey(),
  phoneLast10: varchar("phoneLast10", { length: 10 }).notNull(), // conversation identity
  customerId: int("customerId"),        // → customers.id (the primary "who")
  leadId: int("leadId"),                // → leads.id
  leadCaptureId: int("leadCaptureId"),  // → leadCaptures.id (richer web lead)
  propertyId: int("propertyId"),        // → properties.id (remembered selection)
  linkedByName: varchar("linkedByName", { length: 255 }), // who confirmed the link
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  phoneLast10Idx: uniqueIndex("smsConversationLinks_phoneLast10_uq").on(table.phoneLast10),
}));
export type SmsConversationLink = typeof smsConversationLinks.$inferSelect;
export type InsertSmsConversationLink = typeof smsConversationLinks.$inferInsert;

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
    /**
     * Technician field lifecycle for the service call, SEPARATE from `status`
     * (office pipeline) and from `appointments.status` (dispatch). Managed only
     * by the field work-order screen; see shared/workStatus.ts. Audit trail in
     * `jobWorkStatusEvents`.
     */
    technicianWorkStatus: mysqlEnum("technicianWorkStatus", [
      "assigned", "accepted", "en_route", "arrived", "working", "waiting_parts", "completed",
    ]).default("assigned").notNull(),
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
    /** Optional single photo attached to this note (jobAttachments.id). */
    attachmentId: int("attachmentId"),
    /** True once the note has been edited after creation (drives the "Edited" badge). */
    edited: boolean("edited").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
    /** Job-photo category (PR #40). Only meaningful for kind = "photo". */
    category: mysqlEnum("category", ["before", "during", "after", "general"]).default("general").notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    /**
     * External URL/storage path when the binary lives outside the DB (legacy /
     * office attachments). NULL for field photos, whose bytes live in
     * jobAttachmentBlobs and are served only through the authorized endpoint.
     */
    url: varchar("url", { length: 1024 }),
    mimeType: varchar("mimeType", { length: 128 }),
    sizeBytes: int("sizeBytes"),
    /** teamMembers.id who uploaded. Nullable. */
    uploadedById: int("uploadedById"),
    /** Optional link to the note this photo is attached to (jobNotes.id). */
    noteId: int("noteId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    jobIdx: index("jobAttachments_jobId_idx").on(table.jobId),
  }),
);
export type JobAttachment = typeof jobAttachments.$inferSelect;
export type InsertJobAttachment = typeof jobAttachments.$inferInsert;

/**
 * Binary store for field-uploaded job photos, kept in a SEPARATE table from the
 * jobAttachments metadata so list/gallery queries never pull image bytes (avoids
 * bloating the hot path). One row per attachment; the compressed image is stored
 * as a base64 data payload and served only via the access-controlled endpoint
 * (jobs.fieldGetPhoto), never by a guessable public URL. This blob column is the
 * seam where object storage (server/storage.ts) would slot in at scale — the
 * metadata table and the authorized retrieval API stay identical.
 */
export const jobAttachmentBlobs = mysqlTable(
  "jobAttachmentBlobs",
  {
    id: int("id").autoincrement().primaryKey(),
    attachmentId: int("attachmentId").notNull().unique(),
    /** Base64 (no data: prefix) of the compressed image. */
    data: mediumtext("data").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    attachmentIdx: index("jobAttachmentBlobs_attachmentId_idx").on(table.attachmentId),
  }),
);
export type JobAttachmentBlob = typeof jobAttachmentBlobs.$inferSelect;
export type InsertJobAttachmentBlob = typeof jobAttachmentBlobs.$inferInsert;

/**
 * Technician time tracking (PR #41) — append-only log of clock events on a job.
 * Totals (travel/labor/pause/elapsed) are derived from these via
 * shared/jobTime.ts; kept separate from jobWorkStatusEvents (the status lifecycle).
 */
export const jobTimeEvents = mysqlTable(
  "jobTimeEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull(),
    eventType: mysqlEnum("eventType", ["travel_start", "arrived", "work_start", "pause", "resume", "work_finish"]).notNull(),
    occurredAt: timestamp("occurredAt").defaultNow().notNull(),
    /** teamMembers.id who triggered it. */
    createdById: int("createdById"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ jobIdx: index("jobTimeEvents_jobId_idx").on(table.jobId) }),
);
export type JobTimeEvent = typeof jobTimeEvents.$inferSelect;
export type InsertJobTimeEvent = typeof jobTimeEvents.$inferInsert;

/**
 * Parts/materials a technician records as used on a job (PR #41). Field-only —
 * NO cost/price/QuickBooks (distinct from the office jobPartsItems). Editable
 * until completion; admins may override after.
 */
export const jobFieldParts = mysqlTable(
  "jobFieldParts",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull(),
    partNumber: varchar("partNumber", { length: 120 }),
    description: varchar("description", { length: 500 }).notNull(),
    quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1").notNull(),
    unit: varchar("unit", { length: 32 }),
    notes: varchar("notes", { length: 500 }),
    createdById: int("createdById"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ jobIdx: index("jobFieldParts_jobId_idx").on(table.jobId) }),
);
export type JobFieldPart = typeof jobFieldParts.$inferSelect;
export type InsertJobFieldPart = typeof jobFieldParts.$inferInsert;

/**
 * Customer signature captured on completion (PR #41). One per job. Stored as a
 * base64 PNG data payload; read-only after completion; admins may view.
 */
export const jobSignatures = mysqlTable(
  "jobSignatures",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull().unique(),
    /** Base64 (no data: prefix) of the signature PNG. */
    data: mediumtext("data").notNull(),
    /** teamMembers.id of the technician who captured it. */
    technicianId: int("technicianId"),
    signedAt: timestamp("signedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ jobIdx: index("jobSignatures_jobId_idx").on(table.jobId) }),
);
export type JobSignature = typeof jobSignatures.$inferSelect;
export type InsertJobSignature = typeof jobSignatures.$inferInsert;

/**
 * Structured completion snapshot (PR #41). One per job — stamped when a job is
 * completed, with the computed time totals and which requirements were met.
 * The full completion summary is assembled by joining the child tables at read.
 */
export const jobCompletions = mysqlTable(
  "jobCompletions",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull().unique(),
    completedById: int("completedById"),
    completedAt: timestamp("completedAt").defaultNow().notNull(),
    noteMode: mysqlEnum("noteMode", ["note", "no_note"]).default("note").notNull(),
    hadSignature: boolean("hadSignature").default(false).notNull(),
    travelMs: int("travelMs").default(0).notNull(),
    laborMs: int("laborMs").default(0).notNull(),
    pauseMs: int("pauseMs").default(0).notNull(),
    elapsedMs: int("elapsedMs").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ jobIdx: index("jobCompletions_jobId_idx").on(table.jobId) }),
);
export type JobCompletion = typeof jobCompletions.$inferSelect;
export type InsertJobCompletion = typeof jobCompletions.$inferInsert;

/**
 * Company-wide settings (PR #41). Single-row (id=1). Currently just whether a
 * customer signature is required to complete a job. Additive/extensible.
 */
export const companySettings = mysqlTable("companySettings", {
  id: int("id").autoincrement().primaryKey(),
  requireCompletionSignature: boolean("requireCompletionSignature").default(false).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = typeof companySettings.$inferInsert;

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
 * Technician work-status events — audit trail for the field lifecycle on a work
 * order (jobs.technicianWorkStatus). One row per transition, recording the
 * previous status, new status, who changed it, and when. Kept separate from
 * `jobStatusHistory` (office pipeline) so the two lifecycles never interfere.
 */
export const jobWorkStatusEvents = mysqlTable(
  "jobWorkStatusEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull(),
    /** Previous technician work status; null for the initial entry. */
    fromStatus: varchar("fromStatus", { length: 32 }),
    toStatus: varchar("toStatus", { length: 32 }).notNull(),
    /** teamMembers.id who made the change. Nullable for system/admin rows. */
    changedById: int("changedById"),
    /** Denormalized display name of who changed it (technician/admin), for the timeline. */
    changedByName: varchar("changedByName", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    jobIdx: index("jobWorkStatusEvents_jobId_idx").on(table.jobId),
  }),
);
export type JobWorkStatusEvent = typeof jobWorkStatusEvents.$inferSelect;
export type InsertJobWorkStatusEvent = typeof jobWorkStatusEvents.$inferInsert;

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
    /**
     * Independent incremental cursor for the INVOICE pull (QBO
     * MetaData.LastUpdatedTime of the newest invoice processed). Kept separate
     * from salesDocCursor so invoice sync never resets/advances the estimate
     * cursor. Null until the first invoice run does its bounded backfill.
     */
    invoiceCursor: timestamp("invoiceCursor"),
    /** When the invoice sync last completed (success or attempt). */
    invoiceLastSyncAt: timestamp("invoiceLastSyncAt"),
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
    /**
     * Explicit, auditable link to the web lead that generated this deal
     * (leadCaptures.id). Null for QBO-origin / walk-in / phone deals — which is
     * MOST of them. Attribution reporting credits a landing page/channel only
     * when this is set, or when a temporal+customer match rule holds; it never
     * spreads a customer's lifetime QBO revenue across pages. (Migration 0046.)
     */
    sourceLeadCaptureId: int("sourceLeadCaptureId"),
    assignedToId: int("assignedToId"),
    closedAt: timestamp("closedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    customerIdx: index("opportunities_customerId_idx").on(table.customerId),
    stageIdx: index("opportunities_stage_idx").on(table.stage),
    projectRefIdx: index("opportunities_projectReference_idx").on(table.projectReference),
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
    /**
     * QBO document Id. NOT globally unique on its own — QBO Estimate and Invoice
     * ids can coincide — so identity is the composite (realmId, docType,
     * quickbooksId) enforced by the unique index below.
     */
    quickbooksId: varchar("quickbooksId", { length: 64 }).notNull(),
    docType: mysqlEnum("docType", ["estimate", "invoice"]).default("estimate").notNull(),
    docNumber: varchar("docNumber", { length: 64 }),
    /** QBO CustomerRef value — used to resolve/auto-create the local contact. */
    quickbooksCustomerId: varchar("quickbooksCustomerId", { length: 64 }),
    /** Resolved local contact (customers.id); null only if resolution failed. */
    customerId: int("customerId"),
    /** The opportunity this document backs (opportunities.id). */
    opportunityId: int("opportunityId"),
    /**
     * Normalized document status. Estimate statuses: pending/accepted/closed/
     * rejected/expired. Invoice statuses (additive): paid/partial/unpaid/void.
     */
    status: mysqlEnum("status", [
      "pending", "accepted", "closed", "rejected", "expired",
      "paid", "partial", "unpaid", "void",
    ]).default("pending").notNull(),
    totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).default("0").notNull(),
    /** QBO TxnDate — the document's issue date. */
    txnDate: timestamp("txnDate"),
    /** Derived from QBO EmailStatus = EmailSent; null when never sent. */
    sentAt: timestamp("sentAt"),
    /** QBO ExpirationDate (estimates), if present. */
    expiresAt: timestamp("expiresAt"),
    // ── Invoice-specific fields (nullable; estimates leave these null). Read-only QBO ingestion. ──
    /** QBO Invoice.DueDate. */
    dueDate: timestamp("dueDate"),
    /** QBO Invoice.Balance — unpaid amount (total − payments). Null for estimates. */
    balance: decimal("balance", { precision: 12, scale: 2 }),
    /** QBO CurrencyRef.value (e.g. "USD"). */
    currency: varchar("currency", { length: 8 }),
    /**
     * When the doc's CustomerRef is a QBO sub-customer / job, the parent
     * customer's QBO ref — captured so Customer 360 can reconcile documents
     * filed under a child project back to the parent CRM customer.
     */
    quickbooksParentRef: varchar("quickbooksParentRef", { length: 64 }),
    /** True when the QBO document is voided (kept for audit; excluded from revenue/balance). */
    voided: boolean("voided").default(false).notNull(),
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
    docTypeIdx: index("qbSalesDocs_docType_idx").on(table.docType),
    parentRefIdx: index("qbSalesDocs_parentRef_idx").on(table.quickbooksParentRef),
    /** Durable document identity — an estimate and an invoice may share a QBO id. */
    docIdentityUq: uniqueIndex("qbSalesDocs_realm_docType_qboId_uq").on(table.realmId, table.docType, table.quickbooksId),
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

/* ── SEO Intelligence (Phase 3: Search Console cache) ─────────────────────
 * These three tables are the ON-DISK CACHE the SEO dashboard reads from. A sync
 * (POST /api/seo/sync) pulls the last 90 days from Google Search Console and
 * upserts here; the dashboard never calls Google directly. GSC-sourced columns
 * are overwritten on every sync; the operational columns (`status`, `problems`)
 * are owned by the team/AI and preserved across syncs.
 */
export const seoPages = mysqlTable(
  "seoPages",
  {
    id: int("id").autoincrement().primaryKey(),
    /** The Search Console property, e.g. "https://mechanicalenterprise.com/" or "sc-domain:…". */
    siteUrl: varchar("siteUrl", { length: 512 }).notNull(),
    /** Path only, e.g. "/hvac-newark-nj". */
    page: varchar("page", { length: 1024 }).notNull(),
    /** Fully-qualified URL. */
    url: varchar("url", { length: 1024 }).notNull(),
    /** sha256(siteUrl + "\n" + page) — the upsert key (varchars are too long to index directly). */
    pageHash: varchar("pageHash", { length: 64 }).notNull(),
    // ── Google Search Console metrics (current 90-day window) ──
    clicks: int("clicks").default(0).notNull(),
    impressions: int("impressions").default(0).notNull(),
    /** Click-through rate as a fraction (0.021 === 2.1%). */
    ctr: decimal("ctr", { precision: 8, scale: 6 }).default("0").notNull(),
    /** Average Google position (lower is better). */
    position: decimal("position", { precision: 6, scale: 2 }).default("0").notNull(),
    /** Same metrics for the previous 90-day window — powers "declining clicks" + deltas. */
    previousClicks: int("previousClicks").default(0).notNull(),
    previousImpressions: int("previousImpressions").default(0).notNull(),
    // ── Coverage / indexing (URL Inspection, best-effort) ──
    indexStatus: mysqlEnum("indexStatus", [
      "indexed",
      "crawled_not_indexed",
      "discovered_not_indexed",
      "excluded",
    ]).default("indexed").notNull(),
    lastIndexedAt: timestamp("lastIndexedAt"),
    searchConsoleIssue: varchar("searchConsoleIssue", { length: 512 }),
    // ── On-page (nullable; populated by the AI sprint's page reader) ──
    title: varchar("title", { length: 512 }),
    metaDescription: varchar("metaDescription", { length: 1024 }),
    h1: varchar("h1", { length: 512 }),
    // ── Derived at sync time ──
    priority: mysqlEnum("priority", ["high", "medium", "low"]).default("low").notNull(),
    category: mysqlEnum("category", ["commercial", "residential", "blog", "city_page", "other"]).default("other").notNull(),
    issue: varchar("issue", { length: 512 }),
    // ── Operational state (owned by team/AI; preserved across syncs) ──
    status: mysqlEnum("status", [
      "needs_review",
      "queued",
      "optimizing",
      "waiting_review",
      "approved",
      "published",
      "waiting_for_indexing",
      "ranking_improved",
    ]).default("needs_review").notNull(),
    /** SeoProblem[] (see @shared/seo). */
    problems: json("problems"),
    lastSyncedAt: timestamp("lastSyncedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    pageHashIdx: uniqueIndex("seoPages_pageHash_uq").on(table.pageHash),
    siteIdx: index("seoPages_site_idx").on(table.siteUrl),
    priorityIdx: index("seoPages_priority_idx").on(table.priority),
  }),
);
export type SeoPageRow = typeof seoPages.$inferSelect;
export type InsertSeoPage = typeof seoPages.$inferInsert;

export const seoQueries = mysqlTable(
  "seoQueries",
  {
    id: int("id").autoincrement().primaryKey(),
    siteUrl: varchar("siteUrl", { length: 512 }).notNull(),
    /** Search query / keyword. */
    query: varchar("query", { length: 512 }).notNull(),
    /** Landing page path for the query, when synced with the page dimension. */
    page: varchar("page", { length: 1024 }),
    clicks: int("clicks").default(0).notNull(),
    impressions: int("impressions").default(0).notNull(),
    ctr: decimal("ctr", { precision: 8, scale: 6 }).default("0").notNull(),
    position: decimal("position", { precision: 6, scale: 2 }).default("0").notNull(),
    syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  },
  table => ({
    siteIdx: index("seoQueries_site_idx").on(table.siteUrl),
  }),
);
export type SeoQueryRow = typeof seoQueries.$inferSelect;
export type InsertSeoQuery = typeof seoQueries.$inferInsert;

export const seoSyncHistory = mysqlTable(
  "seoSyncHistory",
  {
    id: int("id").autoincrement().primaryKey(),
    siteUrl: varchar("siteUrl", { length: 512 }).notNull(),
    status: mysqlEnum("status", ["running", "success", "error"]).default("running").notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
    /** Window pulled from Search Console (ISO dates). */
    rangeStart: varchar("rangeStart", { length: 32 }),
    rangeEnd: varchar("rangeEnd", { length: 32 }),
    pagesSynced: int("pagesSynced").default(0).notNull(),
    queriesSynced: int("queriesSynced").default(0).notNull(),
    /** How the sync was triggered: "manual" | "scheduled" | "api". */
    trigger: varchar("trigger", { length: 32 }).default("manual").notNull(),
    error: text("error"),
  },
  table => ({
    siteIdx: index("seoSyncHistory_site_idx").on(table.siteUrl),
    startedIdx: index("seoSyncHistory_startedAt_idx").on(table.startedAt),
  }),
);
export type SeoSyncHistoryRow = typeof seoSyncHistory.$inferSelect;
export type InsertSeoSyncHistory = typeof seoSyncHistory.$inferInsert;

/**
 * AI SEO Optimization drafts (PR #23). One editable draft record per page —
 * the AI-generated title / meta / H1 / FAQ / internal links / schema / content
 * expansion. These are DRAFTS ONLY: nothing here is published to the live site.
 * Written by the mock AI optimization service; preserved across Search Console
 * syncs (the sync never touches this table).
 */
export const seoAiDrafts = mysqlTable(
  "seoAiDrafts",
  {
    id: int("id").autoincrement().primaryKey(),
    /** seoPages.id this draft optimizes (1:1). */
    pageId: int("pageId").notNull(),
    siteUrl: varchar("siteUrl", { length: 512 }).notNull(),
    // ── AI-generated fields (all nullable until generated) ──
    generatedTitle: text("generatedTitle"),
    generatedMetaDescription: text("generatedMetaDescription"),
    generatedH1: text("generatedH1"),
    /** AiFaqItem[] (see @shared/seo). */
    faq: json("faq"),
    /** AiInternalLink[] (see @shared/seo). */
    internalLinks: json("internalLinks"),
    /** schema.org JSON-LD object. */
    schema: json("schema"),
    contentExpansion: text("contentExpansion"),
    /** Which AI provider/model produced this draft (mock today). */
    model: varchar("model", { length: 64 }).default("mock-v1").notNull(),
    /** Draft lifecycle — never "published" (publishing is out of scope). */
    status: mysqlEnum("status", ["draft", "edited", "approved"]).default("draft").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    pageIdx: uniqueIndex("seoAiDrafts_pageId_uq").on(table.pageId),
    siteIdx: index("seoAiDrafts_site_idx").on(table.siteUrl),
  }),
);
export type SeoAiDraftRow = typeof seoAiDrafts.$inferSelect;
export type InsertSeoAiDraft = typeof seoAiDrafts.$inferInsert;

/* ── GA4 Analytics ──────────────────────────────────────────────────────── */

/**
 * GA4 daily metrics cache — one row per unique acquisition slice for a day:
 * (property, date, source, medium, campaign, landingPage, channelGroup). The
 * Marketing → Analytics dashboard reads ONLY from this cache; it never calls the
 * Google Analytics Data API on the request path (mirrors seoPages / the Search
 * Console cache). A daily sync upserts these rows from a single GA4 runReport.
 *
 * This table is additive and self-contained: no existing table is modified, and
 * it shares nothing with the SEO (0044/0045) or Revenue-Attribution (0046)
 * tables or the Google Ads integration.
 */
export const ga4DailyMetrics = mysqlTable(
  "ga4DailyMetrics",
  {
    id: int("id").autoincrement().primaryKey(),
    /** GA4 numeric property id (e.g. "480827123"). */
    propertyId: varchar("propertyId", { length: 32 }).notNull(),
    /** GA4 `date` dimension, normalised to YYYY-MM-DD. */
    date: varchar("date", { length: 10 }).notNull(),
    // ── Acquisition dimensions (session-scoped) ──
    /** `sessionSource`, e.g. "google", "(direct)", "newsletter". */
    source: varchar("source", { length: 255 }).notNull().default(""),
    /** `sessionMedium`, e.g. "organic", "cpc", "referral", "(none)". */
    medium: varchar("medium", { length: 255 }).notNull().default(""),
    /** `sessionCampaignName`, e.g. "(organic)", "spring-promo". */
    campaign: varchar("campaign", { length: 512 }).notNull().default(""),
    /** `landingPage` path (query string stripped by GA4). */
    landingPage: varchar("landingPage", { length: 1024 }).notNull().default(""),
    /** `sessionDefaultChannelGroup` (Organic Search, Paid Search, Direct, …). */
    channelGroup: varchar("channelGroup", { length: 64 }).notNull().default(""),
    /** Coarse Organic-vs-Paid-vs-Other bucket derived at sync time (see @shared/ga4). */
    trafficType: mysqlEnum("trafficType", ["organic", "paid", "other"]).notNull().default("other"),
    // ── Metrics ──
    /** `screenPageViews`. */
    pageViews: int("pageViews").notNull().default(0),
    /** `sessions`. */
    sessions: int("sessions").notNull().default(0),
    /** `totalUsers`. */
    users: int("users").notNull().default(0),
    /** `conversions` (may be fractional for attributed conversions). */
    conversions: decimal("conversions", { precision: 18, scale: 4 }).notNull().default("0"),
    /** `eventCount`. */
    events: int("events").notNull().default(0),
    /** sha256 of (propertyId + date + source + medium + campaign + landingPage + channelGroup) — the upsert key. */
    rowHash: varchar("rowHash", { length: 64 }).notNull(),
    syncedAt: timestamp("syncedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    rowHashIdx: uniqueIndex("ga4DailyMetrics_rowHash_uq").on(table.rowHash),
    propertyDateIdx: index("ga4DailyMetrics_property_date_idx").on(table.propertyId, table.date),
    dateIdx: index("ga4DailyMetrics_date_idx").on(table.date),
    campaignIdx: index("ga4DailyMetrics_campaign_idx").on(table.campaign),
    mediumIdx: index("ga4DailyMetrics_medium_idx").on(table.medium),
  }),
);
export type Ga4DailyMetricRow = typeof ga4DailyMetrics.$inferSelect;
export type InsertGa4DailyMetric = typeof ga4DailyMetrics.$inferInsert;

/**
 * GA4 sync audit trail (mirrors seoSyncHistory). One row per sync attempt, so a
 * crash still leaves a record and the dashboard can surface freshness/staleness.
 */
export const ga4SyncHistory = mysqlTable(
  "ga4SyncHistory",
  {
    id: int("id").autoincrement().primaryKey(),
    propertyId: varchar("propertyId", { length: 32 }).notNull(),
    status: mysqlEnum("status", ["running", "success", "error"]).default("running").notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
    /** Window pulled from GA4 (ISO dates). */
    rangeStart: varchar("rangeStart", { length: 32 }),
    rangeEnd: varchar("rangeEnd", { length: 32 }),
    rowsSynced: int("rowsSynced").notNull().default(0),
    /** How the sync was triggered: "manual" | "scheduled" | "api". */
    trigger: varchar("trigger", { length: 32 }).default("manual").notNull(),
    error: text("error"),
  },
  table => ({
    propertyIdx: index("ga4SyncHistory_property_idx").on(table.propertyId),
    startedIdx: index("ga4SyncHistory_startedAt_idx").on(table.startedAt),
  }),
);
export type Ga4SyncHistoryRow = typeof ga4SyncHistory.$inferSelect;
export type InsertGa4SyncHistory = typeof ga4SyncHistory.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER PORTAL (self-contained module — customer-facing surface)
//
// A distinct auth realm from team members: portal accounts belong to an
// existing `customers` row and authenticate with their own `portal_session`
// cookie (openId prefix "portal:<id>"). All tables below are OWNED by the
// portal module; the portal also READS existing tables (customers, properties,
// quickbooksSalesDocuments, appointments, jobs, jobStatusHistory) but never
// alters their schema. Links are app-enforced int columns (no DB FKs), matching
// the rest of this file.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Portal accounts — a customer's login identity for the self-service portal.
 * One (at most) per customer. Separate from team members / OAuth users.
 */
export const portalAccounts = mysqlTable(
  "portalAccounts",
  {
    id: int("id").autoincrement().primaryKey(),
    /** The customer this login belongs to (customers.id). One account per customer. */
    customerId: int("customerId").notNull(),
    /** Login email — normalized lowercase. Unique across portal accounts. */
    email: varchar("email", { length: 320 }).notNull().unique(),
    /** bcrypt hash (cost 12). Null until the customer sets a password (magic-link-only accounts). */
    passwordHash: varchar("passwordHash", { length: 255 }),
    /** Display name shown in the portal chrome. */
    name: varchar("name", { length: 255 }),
    status: mysqlEnum("status", ["invited", "active", "suspended"]).default("active").notNull(),
    /** Single-use token for magic-link login OR password reset (hex). */
    loginToken: varchar("loginToken", { length: 128 }),
    loginTokenExpiresAt: timestamp("loginTokenExpiresAt"),
    lastLoginAt: timestamp("lastLoginAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    customerIdx: index("portalAccounts_customerId_idx").on(table.customerId),
    loginTokenIdx: index("portalAccounts_loginToken_idx").on(table.loginToken),
  }),
);
export type PortalAccount = typeof portalAccounts.$inferSelect;
export type InsertPortalAccount = typeof portalAccounts.$inferInsert;

/**
 * Portal payments — a payment made (or attempted) by a customer against an
 * invoice (quickbooksSalesDocuments row with docType="invoice"). This is the
 * portal's own ledger; QBO invoice sync is owned elsewhere and untouched.
 */
export const portalPayments = mysqlTable(
  "portalPayments",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    /** The invoice being paid (quickbooksSalesDocuments.id). Nullable for account credits. */
    invoiceId: int("invoiceId"),
    /** Denormalized invoice display number for receipts even if the doc is re-synced. */
    invoiceNumber: varchar("invoiceNumber", { length: 64 }),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 8 }).default("USD").notNull(),
    method: mysqlEnum("method", ["card", "ach", "cash", "check", "other"]).default("card").notNull(),
    status: mysqlEnum("status", ["pending", "succeeded", "failed", "refunded"]).default("pending").notNull(),
    /** Stripe Checkout Session id used to initiate + confirm the payment. */
    stripeSessionId: varchar("stripeSessionId", { length: 255 }),
    stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
    paidAt: timestamp("paidAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    customerIdx: index("portalPayments_customerId_idx").on(table.customerId),
    invoiceIdx: index("portalPayments_invoiceId_idx").on(table.invoiceId),
    sessionIdx: index("portalPayments_stripeSessionId_idx").on(table.stripeSessionId),
  }),
);
export type PortalPayment = typeof portalPayments.$inferSelect;
export type InsertPortalPayment = typeof portalPayments.$inferInsert;

/**
 * Customer equipment — installed HVAC units/assets at a customer site.
 * (No such table existed; equipment was only free-text on properties/jobs.)
 */
export const customerEquipment = mysqlTable(
  "customerEquipment",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    /** Which service location the unit is installed at (properties.id). Optional. */
    propertyId: int("propertyId"),
    /** e.g. "Furnace", "AC Condenser", "Heat Pump", "Boiler", "Mini-Split". */
    category: varchar("category", { length: 100 }),
    make: varchar("make", { length: 120 }),
    model: varchar("model", { length: 120 }),
    serialNumber: varchar("serialNumber", { length: 120 }),
    /** Where in the building the unit lives ("Basement", "Roof", "Unit 2B"). */
    location: varchar("location", { length: 255 }),
    installedAt: timestamp("installedAt"),
    /** True once retired/removed — kept for history. */
    status: mysqlEnum("status", ["active", "retired"]).default("active").notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    customerIdx: index("customerEquipment_customerId_idx").on(table.customerId),
    propertyIdx: index("customerEquipment_propertyId_idx").on(table.propertyId),
  }),
);
export type CustomerEquipment = typeof customerEquipment.$inferSelect;
export type InsertCustomerEquipment = typeof customerEquipment.$inferInsert;

/**
 * Equipment warranties — coverage records, optionally tied to a specific unit.
 */
export const equipmentWarranties = mysqlTable(
  "equipmentWarranties",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    /** The covered unit (customerEquipment.id). Nullable for whole-home/labor warranties. */
    equipmentId: int("equipmentId"),
    /** "manufacturer" | "labor" | "extended" | "parts" | "home". */
    type: mysqlEnum("type", ["manufacturer", "labor", "extended", "parts", "home"]).default("manufacturer").notNull(),
    provider: varchar("provider", { length: 255 }),
    policyNumber: varchar("policyNumber", { length: 120 }),
    coverage: text("coverage"),
    startsAt: timestamp("startsAt"),
    expiresAt: timestamp("expiresAt"),
    status: mysqlEnum("status", ["active", "expired", "void"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    customerIdx: index("equipmentWarranties_customerId_idx").on(table.customerId),
    equipmentIdx: index("equipmentWarranties_equipmentId_idx").on(table.equipmentId),
  }),
);
export type EquipmentWarranty = typeof equipmentWarranties.$inferSelect;
export type InsertEquipmentWarranty = typeof equipmentWarranties.$inferInsert;

/**
 * Maintenance agreements — service contracts / plans a customer holds.
 * (The existing subscription* tables are e-learning commerce, not HVAC plans.)
 */
export const maintenanceAgreements = mysqlTable(
  "maintenanceAgreements",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    /** Plan display name, e.g. "Comfort Club — Silver". */
    planName: varchar("planName", { length: 255 }).notNull(),
    tier: varchar("tier", { length: 100 }),
    status: mysqlEnum("status", ["active", "pending", "expired", "cancelled"]).default("active").notNull(),
    billingFrequency: mysqlEnum("billingFrequency", ["monthly", "quarterly", "annual", "one_time"]).default("annual").notNull(),
    price: decimal("price", { precision: 12, scale: 2 }),
    visitsPerYear: int("visitsPerYear"),
    startsAt: timestamp("startsAt"),
    renewsAt: timestamp("renewsAt"),
    nextServiceAt: timestamp("nextServiceAt"),
    coverage: text("coverage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    customerIdx: index("maintenanceAgreements_customerId_idx").on(table.customerId),
  }),
);
export type MaintenanceAgreement = typeof maintenanceAgreements.$inferSelect;
export type InsertMaintenanceAgreement = typeof maintenanceAgreements.$inferInsert;

/**
 * Customer documents — files a customer can view/download (or upload) in the
 * portal: proposals, permits, warranties, invoices PDFs, inspection reports.
 * Bytes live in the Forge storage proxy (server/storage.ts); we store the key/url.
 */
export const customerDocuments = mysqlTable(
  "customerDocuments",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    category: mysqlEnum("category", [
      "proposal",
      "invoice",
      "permit",
      "warranty",
      "contract",
      "report",
      "photo",
      "other",
    ]).default("other").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    fileName: varchar("fileName", { length: 255 }),
    /** Resolved/stored URL from the storage proxy. */
    url: varchar("url", { length: 1024 }),
    /** Relative storage key for re-resolving a fresh download URL. */
    storageKey: varchar("storageKey", { length: 512 }),
    mimeType: varchar("mimeType", { length: 127 }),
    sizeBytes: int("sizeBytes"),
    /** "customer" (self-uploaded) | "staff" (shared by the company). */
    uploadedBy: mysqlEnum("uploadedBy", ["customer", "staff"]).default("staff").notNull(),
    /** Staff can stage a doc hidden from the customer until ready. */
    visibleToCustomer: boolean("visibleToCustomer").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    customerIdx: index("customerDocuments_customerId_idx").on(table.customerId),
    categoryIdx: index("customerDocuments_category_idx").on(table.category),
  }),
);
export type CustomerDocument = typeof customerDocuments.$inferSelect;
export type InsertCustomerDocument = typeof customerDocuments.$inferInsert;

/**
 * Portal message threads — in-app messaging between a customer and the company.
 * Independent of SMS/Telnyx (owned elsewhere) to keep the portal self-contained.
 */
export const portalMessageThreads = mysqlTable(
  "portalMessageThreads",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
    /** Denormalized for inbox sorting without a join. */
    lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
    /** Unread counts per side, maintained on write. */
    customerUnread: int("customerUnread").default(0).notNull(),
    staffUnread: int("staffUnread").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    customerIdx: index("portalMessageThreads_customerId_idx").on(table.customerId),
    lastMessageIdx: index("portalMessageThreads_lastMessageAt_idx").on(table.lastMessageAt),
  }),
);
export type PortalMessageThread = typeof portalMessageThreads.$inferSelect;
export type InsertPortalMessageThread = typeof portalMessageThreads.$inferInsert;

/** Portal messages — individual messages within a thread. */
export const portalMessages = mysqlTable(
  "portalMessages",
  {
    id: int("id").autoincrement().primaryKey(),
    threadId: int("threadId").notNull(),
    customerId: int("customerId").notNull(),
    /** Who wrote it. "customer" = the portal user; "staff" = the company. */
    sender: mysqlEnum("sender", ["customer", "staff"]).notNull(),
    /** For staff messages, the teamMembers.id author (optional). */
    authorId: int("authorId"),
    body: text("body").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    threadIdx: index("portalMessages_threadId_idx").on(table.threadId),
    customerIdx: index("portalMessages_customerId_idx").on(table.customerId),
  }),
);
export type PortalMessage = typeof portalMessages.$inferSelect;
export type InsertPortalMessage = typeof portalMessages.$inferInsert;

/* ── Google Business Profile (Local SEO) ────────────────────────────────────
 * Read-only cache of a Google Business Profile location: rating/review counts,
 * the daily performance time series (calls / directions / website clicks /
 * search & maps views), reviews, photos and local posts. Populated by the daily
 * `runGbpSync` (server/services/gbp/sync.ts) from the Business Profile APIs; the
 * admin-only Local SEO dashboard reads ONLY from these tables, never from Google
 * on the request path (mirrors the SEO Intelligence / Search Console design).
 */
export const gbpLocations = mysqlTable("gbpLocations", {
  id: int("id").autoincrement().primaryKey(),
  /** Google Business Profile account id (numeric, from the resource name). */
  accountId: varchar("accountId", { length: 128 }).notNull(),
  /** Location id (numeric/opaque, from the resource name). */
  locationId: varchar("locationId", { length: 128 }).notNull(),
  /** Full resource name "accounts/{account}/locations/{location}" — the upsert key. */
  locationName: varchar("locationName", { length: 256 }).notNull().unique(),
  title: varchar("title", { length: 512 }),
  storefrontAddress: varchar("storefrontAddress", { length: 512 }),
  primaryPhone: varchar("primaryPhone", { length: 64 }),
  websiteUrl: varchar("websiteUrl", { length: 512 }),
  /** Current average star rating (0–5). */
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0").notNull(),
  totalReviews: int("totalReviews").default(0).notNull(),
  totalPhotos: int("totalPhotos").default(0).notNull(),
  totalPosts: int("totalPosts").default(0).notNull(),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GbpLocationRow = typeof gbpLocations.$inferSelect;
export type InsertGbpLocation = typeof gbpLocations.$inferInsert;

export const gbpDailyMetrics = mysqlTable(
  "gbpDailyMetrics",
  {
    id: int("id").autoincrement().primaryKey(),
    locationName: varchar("locationName", { length: 256 }).notNull(),
    /** ISO date "YYYY-MM-DD" for this datapoint. */
    date: varchar("date", { length: 10 }).notNull(),
    /** sha256(locationName + "\n" + date) — the upsert key. */
    metricHash: varchar("metricHash", { length: 64 }).notNull(),
    /** "Call" button clicks. */
    callClicks: int("callClicks").default(0).notNull(),
    /** Driving-direction requests. */
    directionRequests: int("directionRequests").default(0).notNull(),
    /** Website link clicks. */
    websiteClicks: int("websiteClicks").default(0).notNull(),
    /** Business impressions on Google Search (mobile + desktop). */
    searchViews: int("searchViews").default(0).notNull(),
    /** Business impressions on Google Maps (mobile + desktop). */
    mapsViews: int("mapsViews").default(0).notNull(),
    /** Rating snapshot for the day — powers the rating trend. */
    rating: decimal("rating", { precision: 3, scale: 2 }).default("0").notNull(),
    /** Review-count snapshot for the day. */
    reviewCount: int("reviewCount").default(0).notNull(),
    syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  },
  table => ({
    metricHashIdx: uniqueIndex("gbpDailyMetrics_metricHash_uq").on(table.metricHash),
    locIdx: index("gbpDailyMetrics_loc_idx").on(table.locationName),
    dateIdx: index("gbpDailyMetrics_date_idx").on(table.date),
  }),
);
export type GbpDailyMetricRow = typeof gbpDailyMetrics.$inferSelect;
export type InsertGbpDailyMetric = typeof gbpDailyMetrics.$inferInsert;

export const gbpReviews = mysqlTable(
  "gbpReviews",
  {
    id: int("id").autoincrement().primaryKey(),
    locationName: varchar("locationName", { length: 256 }).notNull(),
    /** Full review resource name. */
    reviewName: text("reviewName").notNull(),
    /** sha256(reviewName) — the upsert key (resource name is too long to index). */
    reviewHash: varchar("reviewHash", { length: 64 }).notNull(),
    reviewerName: varchar("reviewerName", { length: 256 }),
    /** Star rating 1–5 (0 when unspecified). */
    starRating: int("starRating").default(0).notNull(),
    comment: text("comment"),
    createTime: timestamp("createTime"),
    updateTime: timestamp("updateTime"),
    /** Business owner's reply, when present. */
    replyComment: text("replyComment"),
    replyTime: timestamp("replyTime"),
    syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  },
  table => ({
    reviewHashIdx: uniqueIndex("gbpReviews_reviewHash_uq").on(table.reviewHash),
    locIdx: index("gbpReviews_loc_idx").on(table.locationName),
    createIdx: index("gbpReviews_createTime_idx").on(table.createTime),
  }),
);
export type GbpReviewRow = typeof gbpReviews.$inferSelect;
export type InsertGbpReview = typeof gbpReviews.$inferInsert;

export const gbpPhotos = mysqlTable(
  "gbpPhotos",
  {
    id: int("id").autoincrement().primaryKey(),
    locationName: varchar("locationName", { length: 256 }).notNull(),
    mediaName: text("mediaName").notNull(),
    /** sha256(mediaName) — the upsert key. */
    mediaHash: varchar("mediaHash", { length: 64 }).notNull(),
    /** Location association category (e.g. PROFILE, COVER, ADDITIONAL). */
    category: varchar("category", { length: 64 }),
    googleUrl: text("googleUrl"),
    /** View count from the media item's insights — powers "photo performance". */
    viewCount: int("viewCount").default(0).notNull(),
    createTime: timestamp("createTime"),
    syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  },
  table => ({
    mediaHashIdx: uniqueIndex("gbpPhotos_mediaHash_uq").on(table.mediaHash),
    locIdx: index("gbpPhotos_loc_idx").on(table.locationName),
  }),
);
export type GbpPhotoRow = typeof gbpPhotos.$inferSelect;
export type InsertGbpPhoto = typeof gbpPhotos.$inferInsert;

export const gbpPosts = mysqlTable(
  "gbpPosts",
  {
    id: int("id").autoincrement().primaryKey(),
    locationName: varchar("locationName", { length: 256 }).notNull(),
    postName: text("postName").notNull(),
    /** sha256(postName) — the upsert key. */
    postHash: varchar("postHash", { length: 64 }).notNull(),
    summary: text("summary"),
    topicType: varchar("topicType", { length: 64 }),
    state: varchar("state", { length: 64 }),
    searchUrl: text("searchUrl"),
    createTime: timestamp("createTime"),
    updateTime: timestamp("updateTime"),
    syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  },
  table => ({
    postHashIdx: uniqueIndex("gbpPosts_postHash_uq").on(table.postHash),
    locIdx: index("gbpPosts_loc_idx").on(table.locationName),
  }),
);
export type GbpPostRow = typeof gbpPosts.$inferSelect;
export type InsertGbpPost = typeof gbpPosts.$inferInsert;

export const gbpSyncHistory = mysqlTable(
  "gbpSyncHistory",
  {
    id: int("id").autoincrement().primaryKey(),
    locationName: varchar("locationName", { length: 256 }).notNull(),
    status: mysqlEnum("status", ["running", "success", "error"]).default("running").notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
    /** Performance window pulled (ISO dates). */
    rangeStart: varchar("rangeStart", { length: 32 }),
    rangeEnd: varchar("rangeEnd", { length: 32 }),
    reviewsSynced: int("reviewsSynced").default(0).notNull(),
    metricsSynced: int("metricsSynced").default(0).notNull(),
    photosSynced: int("photosSynced").default(0).notNull(),
    postsSynced: int("postsSynced").default(0).notNull(),
    /** How the sync was triggered: "manual" | "scheduled" | "api". */
    trigger: varchar("trigger", { length: 32 }).default("manual").notNull(),
    error: text("error"),
  },
  table => ({
    locIdx: index("gbpSyncHistory_loc_idx").on(table.locationName),
    startedIdx: index("gbpSyncHistory_startedAt_idx").on(table.startedAt),
  }),
);
export type GbpSyncHistoryRow = typeof gbpSyncHistory.$inferSelect;
export type InsertGbpSyncHistory = typeof gbpSyncHistory.$inferInsert;

import { boolean, decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  phone: varchar("phone", { length: 50 }).notNull(), // E.164 format
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  message: text("message").notNull(),
  isOptOut: boolean("isOptOut").default(false).notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  // For outbound replies sent from the dashboard
  sentByName: varchar("sentByName", { length: 255 }), // team member who replied
  textBeltId: varchar("textBeltId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SmsInboxMessage = typeof smsInboxMessages.$inferSelect;
export type InsertSmsInboxMessage = typeof smsInboxMessages.$inferInsert;

/**
 * Rebate Calculator Submissions
 * Stores property info, calculated rebates, and assessment order requests
 */
export const rebateCalculations = mysqlTable("rebateCalculations", {
  id: int("id").autoincrement().primaryKey(),
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

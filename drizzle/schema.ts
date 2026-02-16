import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  captureType: mysqlEnum("captureType", ["exit_popup", "inline_form", "newsletter", "download_gate", "quick_quote"]).notNull(),
  pageUrl: varchar("pageUrl", { length: 500 }),
  message: text("message"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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

// TODO: Add your tables here
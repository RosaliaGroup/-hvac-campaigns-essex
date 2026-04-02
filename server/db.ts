import { eq, desc, sql, and, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, leads, InsertLead, leadCaptures, InsertLeadCapture,
  aiVaCredentials, InsertAiVaCredential, callLogs, InsertCallLog,
  smsConversations, InsertSmsConversation, socialPosts, InsertSocialPost,
  socialInteractions, InsertSocialInteraction, aiVaAnalytics, InsertAiVaAnalytic,
  aiScripts, InsertAiScript,
  appointments, InsertAppointment,
  teamMembers
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function saveUserVideoInterests(userId: number, interests: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ videoInterests: interests }).where(eq(users.id, userId));
}

/**
 * Lead management functions
 */
export async function createLead(lead: InsertLead) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(leads).values(lead);
  return result;
}

export async function getAllLeads() {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(leads).orderBy(desc(leads.createdAt));
}

export async function updateLeadStatus(leadId: number, status: "new" | "contacted" | "quoted" | "won" | "lost") {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(leads).set({ status }).where(eq(leads.id, leadId));
}

/**
 * Lead capture management functions
 */
export async function createLeadCapture(capture: InsertLeadCapture) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(leadCaptures).values(capture);
  return result;
}

export async function getAllLeadCaptures(filters?: {
  status?: "new" | "contacted" | "qualified" | "booked" | "lost";
  captureType?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const conditions = [];
  if (filters?.status) {
    conditions.push(eq(leadCaptures.status, filters.status));
  }
  if (filters?.captureType) {
    conditions.push(sql`${leadCaptures.captureType} = ${filters.captureType}`);
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        like(leadCaptures.email, searchTerm),
        like(leadCaptures.firstName, searchTerm),
        like(leadCaptures.lastName, searchTerm),
        like(leadCaptures.phone, searchTerm)
      )
    );
  }

  let query = db.select().from(leadCaptures);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return await query
    .orderBy(desc(leadCaptures.createdAt))
    .limit(filters?.limit ?? 100)
    .offset(filters?.offset ?? 0);
}

export async function updateLeadCaptureStatus(id: number, status: "new" | "contacted" | "qualified" | "booked" | "lost") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(leadCaptures).set({ status, updatedAt: new Date() }).where(eq(leadCaptures.id, id));
}

export async function updateLeadCaptureNotes(id: number, notes: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(leadCaptures).set({ notes, updatedAt: new Date() }).where(eq(leadCaptures.id, id));
}

export async function getLeadCaptureStats() {
  const db = await getDb();
  if (!db) {
    return { total: 0, new: 0, contacted: 0, qualified: 0, booked: 0, lost: 0, bySource: {} };
  }

  const all = await db.select().from(leadCaptures).orderBy(desc(leadCaptures.createdAt));
  const bySource: Record<string, number> = {};
  all.forEach(l => {
    bySource[l.captureType] = (bySource[l.captureType] || 0) + 1;
  });

  return {
    total: all.length,
    new: all.filter(l => l.status === 'new').length,
    contacted: all.filter(l => l.status === 'contacted').length,
    qualified: all.filter(l => l.status === 'qualified').length,
    booked: all.filter(l => l.status === 'booked').length,
    lost: all.filter(l => l.status === 'lost').length,
    bySource,
    recentLeads: all.slice(0, 5),
  };
}

export async function getLeadCaptureAnalytics() {
  const db = await getDb();
  if (!db) {
    return { today: 0, thisWeek: 0, thisMonth: 0, allTime: 0, dailyCounts: [], bySource: {} };
  }

  const all = await db.select().from(leadCaptures).orderBy(desc(leadCaptures.createdAt));

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const today = all.filter(l => new Date(l.createdAt) >= startOfDay).length;
  const thisWeek = all.filter(l => new Date(l.createdAt) >= startOfWeek).length;
  const thisMonth = all.filter(l => new Date(l.createdAt) >= startOfMonth).length;

  // Daily counts for last 30 days
  const dailyMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(startOfDay);
    d.setDate(d.getDate() - i);
    dailyMap[d.toISOString().slice(0, 10)] = 0;
  }
  all.forEach(l => {
    const key = new Date(l.createdAt).toISOString().slice(0, 10);
    if (key in dailyMap) dailyMap[key]++;
  });
  const dailyCounts = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

  const bySource: Record<string, number> = {};
  all.forEach(l => {
    bySource[l.captureType] = (bySource[l.captureType] || 0) + 1;
  });

  return {
    today,
    thisWeek,
    thisMonth,
    allTime: all.length,
    dailyCounts,
    bySource,
    recentLeads: all.slice(0, 20),
  };
}

/**
 * AI VA Credentials management
 */
export async function saveAiVaCredentials(service: string, credentials: Record<string, string>) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Delete existing credentials for this service
  await db.delete(aiVaCredentials).where(eq(aiVaCredentials.service, service));

  // Insert new credentials
  const credentialEntries: InsertAiVaCredential[] = Object.entries(credentials).map(([key, value]) => ({
    service,
    credentialKey: key,
    credentialValue: value, // TODO: Encrypt this value before storing
    isActive: 1,
  }));

  await db.insert(aiVaCredentials).values(credentialEntries);
}

export async function getAiVaCredentials(service: string) {
  const db = await getDb();
  if (!db) {
    return {};
  }

  const results = await db
    .select()
    .from(aiVaCredentials)
    .where(eq(aiVaCredentials.service, service));

  // Convert array to object
  const credentials: Record<string, string> = {};
  results.forEach((row) => {
    credentials[row.credentialKey] = row.credentialValue; // TODO: Decrypt this value
  });

  return credentials;
}

/**
 * Call Logs management
 */
export async function createCallLog(log: InsertCallLog) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.insert(callLogs).values(log);
}

export async function getCallLogs(limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db
    .select()
    .from(callLogs)
    .orderBy(desc(callLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * SMS Conversations management
 */
export async function createSmsConversation(sms: InsertSmsConversation) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.insert(smsConversations).values(sms);
}

export async function getSmsConversations(limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db
    .select()
    .from(smsConversations)
    .orderBy(desc(smsConversations.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Social Posts management
 */
export async function createSocialPost(post: InsertSocialPost) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.insert(socialPosts).values(post);
}

export async function getSocialPosts(status?: "draft" | "scheduled" | "posted" | "failed", limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  let query = db.select().from(socialPosts);
  
  if (status) {
    query = query.where(eq(socialPosts.status, status)) as any;
  }

  return await query
    .orderBy(desc(socialPosts.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Social Interactions management
 */
export async function createSocialInteraction(interaction: InsertSocialInteraction) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.insert(socialInteractions).values(interaction);
}

/**
 * AI VA Analytics
 */
export async function getAiVaAnalytics(startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db
    .select()
    .from(aiVaAnalytics)
    .where(sql`${aiVaAnalytics.date} BETWEEN ${startDate} AND ${endDate}`)
    .orderBy(desc(aiVaAnalytics.date));
}

export async function createOrUpdateAnalytics(date: string, metrics: Partial<InsertAiVaAnalytic>) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Try to update existing record
  const existing = await db
    .select()
    .from(aiVaAnalytics)
    .where(sql`DATE(${aiVaAnalytics.date}) = ${date}`)
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(aiVaAnalytics)
      .set(metrics)
      .where(eq(aiVaAnalytics.id, existing[0].id));
  } else {
    await db.insert(aiVaAnalytics).values({
      date: new Date(date),
      ...metrics,
    } as InsertAiVaAnalytic);
  }
}

/**
 * Lead Scoring functions
 */
export async function updateLeadScore(
  leadId: number, 
  score: number, 
  priority: 'hot' | 'warm' | 'cold',
  scoreBreakdown: string,
  interactionCount: number
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db
    .update(leads)
    .set({
      score,
      priority,
      scoreBreakdown,
      interactionCount,
      lastInteractionAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));
}

export async function getLeadsByPriority(priority?: 'hot' | 'warm' | 'cold', limit: number = 50) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  let query = db.select().from(leads);
  
  if (priority) {
    query = query.where(eq(leads.priority, priority)) as any;
  }

  return await query
    .orderBy(desc(leads.score), desc(leads.lastInteractionAt))
    .limit(limit);
}

export async function getLeadScoreHistory(leadId: number) {
  const db = await getDb();
  if (!db) {
    return null;
  }

  return await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
}

export async function getLeadInteractionData(leadId: number) {
  const db = await getDb();
  if (!db) {
    return null;
  }

  // Get call data
  const callData = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.leadId, leadId));

  // Get SMS data
  const smsData = await db
    .select()
    .from(smsConversations)
    .where(eq(smsConversations.leadId, leadId));

  // Get social data
  const socialData = await db
    .select()
    .from(socialInteractions)
    .where(eq(socialInteractions.leadId, leadId));

  return {
    calls: callData,
    sms: smsData,
    social: socialData,
  };
}

export async function getTopLeads(limit: number = 10) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db
    .select()
    .from(leads)
    .orderBy(desc(leads.score))
    .limit(limit);
}

export async function getLeadScoreStats() {
  const db = await getDb();
  if (!db) {
    return {
      totalLeads: 0,
      hotLeads: 0,
      warmLeads: 0,
      coldLeads: 0,
      avgScore: 0,
    };
  }

  const allLeads = await db.select().from(leads);
  
  return {
    totalLeads: allLeads.length,
    hotLeads: allLeads.filter(l => l.priority === 'hot').length,
    warmLeads: allLeads.filter(l => l.priority === 'warm').length,
    coldLeads: allLeads.filter(l => l.priority === 'cold').length,
    avgScore: allLeads.length > 0 
      ? Math.round(allLeads.reduce((sum, l) => sum + l.score, 0) / allLeads.length)
      : 0,
  };
}

// ========== AI Scripts Management ==========

export async function createAiScript(script: InsertAiScript) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(aiScripts).values(script);
  return result;
}

export async function getAllAiScripts() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(aiScripts).orderBy(desc(aiScripts.createdAt));
}

export async function getAiScriptById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const [script] = await db.select().from(aiScripts).where(eq(aiScripts.id, id));
  return script || null;
}

export async function getAiScriptsByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(aiScripts).where(sql`${aiScripts.category} = ${category}`);
}

export async function updateAiScript(id: number, updates: Partial<InsertAiScript>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(aiScripts).set(updates).where(eq(aiScripts.id, id));
}

export async function deleteAiScript(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(aiScripts).where(eq(aiScripts.id, id));
}

// ─── Appointments (booked by Jessica via Vapi) ───────────────────────────────

export async function createAppointment(data: InsertAppointment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(appointments).values(data);
  return result;
}

export async function getAllAppointments(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(appointments).orderBy(desc(appointments.createdAt)).limit(limit).offset(offset);
}

export async function getAppointmentByPhone(phone: string) {
  const db = await getDb();
  if (!db) return null;
  const [appt] = await db.select().from(appointments)
    .where(eq(appointments.phone, phone))
    .orderBy(desc(appointments.createdAt))
    .limit(1);
  return appt || null;
}

export async function updateAppointmentStatus(id: number, status: "pending" | "confirmed" | "completed" | "cancelled" | "rescheduled") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(appointments).set({ status }).where(eq(appointments.id, id));
}

export async function rescheduleAppointment(phone: string, newDate: string, newTime: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Find most recent pending appointment for this phone
  const [appt] = await db.select().from(appointments)
    .where(and(eq(appointments.phone, phone), eq(appointments.status, "pending")))
    .orderBy(desc(appointments.createdAt))
    .limit(1);
  if (!appt) return null;
  await db.update(appointments)
    .set({ preferredDate: newDate, preferredTime: newTime, status: "rescheduled" })
    .where(eq(appointments.id, appt.id));
  return appt;
}

export async function getAppointmentStats() {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, confirmed: 0, thisWeek: 0 };
  const all = await db.select().from(appointments);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Sunday
  weekStart.setHours(0, 0, 0, 0);
  const thisWeek = all.filter(a => new Date(a.createdAt) >= weekStart).length;
  return {
    total: all.length,
    pending: all.filter(a => a.status === "pending").length,
    confirmed: all.filter(a => a.status === "confirmed").length,
    thisWeek,
  };
}

export async function getWeeklyAppointmentCounts(weeksBack = 8) {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(appointments).orderBy(desc(appointments.createdAt));
  const weeks: { week: string; count: number; goal: number }[] = [];
  const now = new Date();
  for (let i = weeksBack - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const count = all.filter(a => {
      const d = new Date(a.createdAt);
      return d >= weekStart && d < weekEnd;
    }).length;
    weeks.push({
      week: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count,
      goal: 20,
    });
  }
  return weeks;
}

export async function deleteSocialPost(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(socialPosts).where(eq(socialPosts.id, id));
}

export async function updateSocialPostStatus(id: number, status: "draft" | "scheduled" | "posted" | "failed", errorMessage?: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(socialPosts).set({ status, errorMessage: errorMessage || null }).where(eq(socialPosts.id, id));
}

// ─── Team Members ────────────────────────────────────────────────────────────

export async function getTeamMemberByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(teamMembers).where(eq(teamMembers.email, email.toLowerCase())).limit(1);
  return rows[0] ?? null;
}

export async function getTeamMemberByInviteToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(teamMembers).where(eq(teamMembers.inviteToken, token)).limit(1);
  return rows[0] ?? null;
}

export async function getTeamMemberByResetToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(teamMembers).where(eq(teamMembers.resetToken, token)).limit(1);
  return rows[0] ?? null;
}

export async function createTeamMember(data: {
  email: string;
  name: string;
  role: "admin" | "member" | "viewer";
  inviteToken: string;
  inviteExpiresAt: Date;
  invitedBy: string;
}) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(teamMembers).values({
    email: data.email.toLowerCase(),
    name: data.name,
    role: data.role,
    status: "invited",
    inviteToken: data.inviteToken,
    inviteExpiresAt: data.inviteExpiresAt,
    invitedBy: data.invitedBy,
  });
  return getTeamMemberByEmail(data.email);
}

export async function activateTeamMember(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(teamMembers).set({
    passwordHash,
    status: "active",
    inviteToken: null,
    inviteExpiresAt: null,
  }).where(eq(teamMembers.id, id));
}

export async function setTeamMemberResetToken(id: number, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) return;
  await db.update(teamMembers).set({ resetToken: token, resetExpiresAt: expiresAt }).where(eq(teamMembers.id, id));
}

export async function resetTeamMemberPassword(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(teamMembers).set({
    passwordHash,
    resetToken: null,
    resetExpiresAt: null,
    status: "active",
  }).where(eq(teamMembers.id, id));
}

export async function updateTeamMemberLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(teamMembers).set({ lastSignedIn: new Date() }).where(eq(teamMembers.id, id));
}

export async function listTeamMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teamMembers).orderBy(desc(teamMembers.createdAt));
}

export async function deleteTeamMember(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(teamMembers).where(eq(teamMembers.id, id));
}

export async function updateTeamMemberStatus(id: number, status: "active" | "suspended") {
  const db = await getDb();
  if (!db) return;
  await db.update(teamMembers).set({ status }).where(eq(teamMembers.id, id));
}

export async function getTeamMemberById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(teamMembers).where(eq(teamMembers.id, id)).limit(1);
  return rows[0] ?? null;
}

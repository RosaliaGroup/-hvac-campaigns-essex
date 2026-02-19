import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, leads, InsertLead, leadCaptures, InsertLeadCapture,
  aiVaCredentials, InsertAiVaCredential, callLogs, InsertCallLog,
  smsConversations, InsertSmsConversation, socialPosts, InsertSocialPost,
  socialInteractions, InsertSocialInteraction, aiVaAnalytics, InsertAiVaAnalytic,
  aiScripts, InsertAiScript
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

export async function getAllLeadCaptures() {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(leadCaptures).orderBy(desc(leadCaptures.createdAt));
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

/**
 * Meta Lead Gen Webhook — receives real-time lead notifications from Facebook Instant Forms
 *
 * When a user submits an Instant Form on Facebook, Meta sends a webhook notification
 * with the leadgen_id. We then fetch the full lead data (name, email, phone) from the
 * Leads API and save it to the leadCaptures table.
 *
 * Setup in Meta App Dashboard:
 *   1. Webhooks → Page → Subscribe to "leadgen" field
 *   2. Callback URL: https://mechanicalenterprise.com/api/meta/leadgen
 *   3. Verify Token: set META_WEBHOOK_VERIFY_TOKEN env var
 *
 * Required permissions: leads_retrieval, pages_manage_metadata
 */
import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { leadCaptures } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { enqueueLeadCustomerSync } from "./leadCustomerAutoSync";
import { enrollSpeedToLead } from "./growth/speedToLead";

const SALES_ALERT_EMAIL = "sales@mechanicalenterprise.com";
const STANDARD_FIELDS = new Set(["full_name", "first_name", "last_name", "email", "phone_number"]);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Human-readable "Question: answer" lines for every non-contact field on the form. */
export function formatExtraFields(fields: MetaLeadField[]): string[] {
  return fields
    .filter((f) => !STANDARD_FIELDS.has(f.name))
    .map((f) => `${f.name.replace(/_/g, " ").replace(/\?$/, "")}: ${(f.values ?? []).join(", ")}`);
}

/** Email the sales inbox about a new Facebook lead (same Resend path as website leads). */
async function sendSalesAlert(lead: { name: string; email?: string; phone?: string; extra: string[]; leadId: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[MetaLeadWebhook] RESEND_API_KEY missing — sales alert email skipped");
    return;
  }
  const rows: Array<[string, string]> = [
    ["Name", lead.name || "—"],
    ["Phone", lead.phone ?? "—"],
    ["Email", lead.email ?? "—"],
    ...lead.extra.map((line): [string, string] => {
      const i = line.indexOf(": ");
      return i > 0 ? [line.slice(0, i), line.slice(i + 2)] : [line, ""];
    }),
    ["Source", "Facebook Instant Form"],
  ];
  const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
    <h2 style="color:#1e3a5f;margin-top:0">New Facebook Lead</h2>
    <p>Follow up as soon as possible — the lead is saved in the website CRM (Leads).</p>
    <table style="width:100%;border-collapse:collapse">${rows
      .map(([k, v]) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;width:40%">${escapeHtml(k)}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(v)}</td></tr>`)
      .join("")}</table>
    <p style="color:#888;font-size:12px">Meta lead ID ${escapeHtml(lead.leadId)}</p>
  </div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Mechanical Enterprise <noreply@mechanicalenterprise.com>",
      to: [SALES_ALERT_EMAIL],
      subject: `New Facebook Lead – ${lead.name || lead.phone || "Homeowner"}`,
      html,
    }),
  });
  if (!res.ok) console.error("[MetaLeadWebhook] Sales alert email failed:", res.status, await res.text().catch(() => ""));
}

const META_API_VERSION = "v25.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "me_leadgen_verify";

interface MetaLeadField {
  name: string;
  values: string[];
}

interface MetaLeadData {
  id: string;
  created_time: string;
  field_data: MetaLeadField[];
}

function extractField(fields: MetaLeadField[], name: string): string | undefined {
  const field = fields.find((f) => f.name === name);
  return field?.values?.[0];
}

async function fetchLeadData(leadId: string, accessToken: string): Promise<MetaLeadData> {
  const url = `${META_BASE}/${leadId}?access_token=${encodeURIComponent(accessToken)}&fields=id,created_time,field_data`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) {
    throw new Error(`Meta Leads API error: ${json.error.message}`);
  }
  return json as MetaLeadData;
}

async function getPageAccessToken(pageId: string, userToken: string): Promise<string> {
  const url = `${META_BASE}/${pageId}?fields=access_token&access_token=${encodeURIComponent(userToken)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) {
    throw new Error(`Failed to get page token: ${json.error.message}`);
  }
  return json.access_token;
}

export function registerMetaLeadWebhookRoutes(app: Express): void {
  /**
   * GET /api/meta/leadgen — Meta webhook verification (hub.challenge handshake)
   */
  app.get("/api/meta/leadgen", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"] as string | undefined;
    const token = req.query["hub.verify_token"] as string | undefined;
    const challenge = req.query["hub.challenge"] as string | undefined;

    console.log("[MetaLeadWebhook] Verification request:", { mode, token: token ? "***" : "missing", challenge });

    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      console.log("[MetaLeadWebhook] Verification successful — returning challenge");
      return res.status(200).type("text/plain").send(challenge);
    }
    console.warn("[MetaLeadWebhook] Verification failed — mode:", mode, "token match:", token === VERIFY_TOKEN);
    return res.status(403).type("text/plain").send("Forbidden");
  });

  /**
   * POST /api/meta/leadgen — Meta lead gen webhook notifications
   *
   * Payload shape:
   * {
   *   object: "page",
   *   entry: [{
   *     id: "PAGE_ID",
   *     time: 1234567890,
   *     changes: [{
   *       field: "leadgen",
   *       value: { leadgen_id: "LEAD_ID", page_id: "PAGE_ID", form_id: "FORM_ID", ... }
   *     }]
   *   }]
   * }
   */
  app.post("/api/meta/leadgen", async (req: Request, res: Response) => {
    // Always respond 200 quickly to avoid Meta retries
    res.status(200).json({ received: true });

    try {
      const body = req.body as {
        object?: string;
        entry?: Array<{
          id: string;
          time: number;
          changes?: Array<{
            field: string;
            value: {
              leadgen_id: string;
              page_id: string;
              form_id: string;
              created_time: number;
            };
          }>;
        }>;
      };

      if (body.object !== "page" || !body.entry?.length) {
        console.log("[MetaLeadWebhook] Ignoring non-page webhook");
        return;
      }

      // Get access token from DB credentials
      const { getAiVaCredentials } = await import("../db");
      const creds = await getAiVaCredentials("meta_ads");
      const userToken = creds["user_access_token"] ||
        (creds["token_type"] === "page_access_token" ? null : creds["access_token"]) ||
        process.env.META_ACCESS_TOKEN;
      const savedPageToken = creds["page_access_token"] ||
        (creds["token_type"] === "page_access_token" ? creds["access_token"] : null);
      const configuredPageId = creds["page_id"];
      if (!userToken && !savedPageToken) {
        console.error("[MetaLeadWebhook] No usable Meta token available — cannot fetch lead data");
        return;
      }

      for (const entry of body.entry) {
        const changes = entry.changes ?? [];
        for (const change of changes) {
          if (change.field !== "leadgen") continue;

          const { leadgen_id, page_id } = change.value;
          if (configuredPageId && page_id !== configuredPageId) {
            console.warn("[MetaLeadWebhook] Ignoring unexpected Page ID");
            continue;
          }
          console.log(`[MetaLeadWebhook] New lead: ${leadgen_id} from page ${page_id}`);

          try {
            // Use the Page credential saved during OAuth for lead retrieval.
            const pageToken = savedPageToken || await getPageAccessToken(page_id, userToken!);
            const lead = await fetchLeadData(leadgen_id, pageToken);

            const fullName =
              extractField(lead.field_data, "full_name") ??
              [extractField(lead.field_data, "first_name"), extractField(lead.field_data, "last_name")].filter(Boolean).join(" ");
            const email = extractField(lead.field_data, "email");
            const phone = extractField(lead.field_data, "phone_number");
            const extra = formatExtraFields(lead.field_data);

            // Split full name into first/last
            const nameParts = fullName.trim().split(/\s+/);
            const firstName = nameParts[0] || undefined;
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;
            const marker = `Lead ${leadgen_id}`;

            // Save to leadCaptures table (the website CRM's Leads list)
            const db = await getDb();
            if (db) {
              // Meta retries webhooks — skip a lead we already saved.
              const existing = await db
                .select({ id: leadCaptures.id })
                .from(leadCaptures)
                .where(sql`${leadCaptures.captureType} = 'meta_lead_ad' AND ${leadCaptures.message} LIKE ${`%${marker}%`}`)
                .limit(1);
              if (existing.length > 0) {
                console.log(`[MetaLeadWebhook] Duplicate lead ${leadgen_id} — already saved`);
                continue;
              }
              const inserted = await db.insert(leadCaptures).values({
                email: email ?? null,
                phone: phone ?? null,
                firstName: firstName ?? null,
                lastName: lastName ?? null,
                name: fullName || null,
                captureType: "meta_lead_ad",
                pageUrl: `https://facebook.com/${page_id}`,
                message: [...extra, `Meta Lead Gen — Form ${change.value.form_id}, ${marker}`].join("\n"),
                utmSource: "facebook",
                utmMedium: "paid_social",
                channel: "paid",
                status: "new",
              });
              console.log(`[MetaLeadWebhook] Saved lead ${leadgen_id}`);

              const newId = Number((inserted as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
              if (newId > 0) void enrollSpeedToLead({ table: "leadCaptures", id: newId });

              // Policy: every new lead becomes a QuickBooks customer. Fire-and-forget —
              // never blocks or fails webhook processing (QBO errors are swallowed).
              enqueueLeadCustomerSync({
                name: fullName || null,
                firstName: firstName ?? null,
                lastName: lastName ?? null,
                email: email ?? null,
                phone: phone ?? null,
                source: "web:meta_lead_ad",
                origin: `meta_lead_ad:${leadgen_id}`,
              });
            }

            // Email alert to the sales inbox so someone follows up.
            await sendSalesAlert({ name: fullName, email, phone, extra, leadId: leadgen_id }).catch((err) =>
              console.error("[MetaLeadWebhook] Sales alert error:", err),
            );
            await notifyOwner({
              title: `New Meta Lead: ${fullName}`,
              content: `A new lead submitted the Instant Form on Facebook.\n\nName: ${fullName}\nEmail: ${email ?? "N/A"}\nPhone: ${phone ?? "N/A"}\n${extra.join("\n")}\n\nLead ID: ${leadgen_id}`,
            }).catch((err) => console.error("[MetaLeadWebhook] Notification error:", err));
          } catch (err) {
            console.error(`[MetaLeadWebhook] Failed to process lead ${leadgen_id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error("[MetaLeadWebhook] Error processing webhook:", err);
    }
  });
}

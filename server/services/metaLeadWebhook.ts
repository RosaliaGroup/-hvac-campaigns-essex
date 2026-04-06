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
import { getDb } from "../db";
import { leadCaptures } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";

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
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[MetaLeadWebhook] Verification successful");
      return res.status(200).send(challenge);
    }
    console.warn("[MetaLeadWebhook] Verification failed — bad token");
    return res.status(403).json({ error: "Forbidden" });
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
      const userToken = creds["access_token"] || process.env.META_ACCESS_TOKEN;
      if (!userToken) {
        console.error("[MetaLeadWebhook] No Meta access token available — cannot fetch lead data");
        return;
      }

      for (const entry of body.entry) {
        const changes = entry.changes ?? [];
        for (const change of changes) {
          if (change.field !== "leadgen") continue;

          const { leadgen_id, page_id } = change.value;
          console.log(`[MetaLeadWebhook] New lead: ${leadgen_id} from page ${page_id}`);

          try {
            // Get page-level access token for leads retrieval
            const pageToken = await getPageAccessToken(page_id, userToken);
            const lead = await fetchLeadData(leadgen_id, pageToken);

            const fullName = extractField(lead.field_data, "full_name") ?? "";
            const email = extractField(lead.field_data, "email");
            const phone = extractField(lead.field_data, "phone_number");

            // Split full name into first/last
            const nameParts = fullName.trim().split(/\s+/);
            const firstName = nameParts[0] || undefined;
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

            // Save to leadCaptures table
            const db = await getDb();
            if (db) {
              await db.insert(leadCaptures).values({
                email: email ?? null,
                phone: phone ?? null,
                firstName: firstName ?? null,
                lastName: lastName ?? null,
                name: fullName || null,
                captureType: "meta_lead_ad",
                pageUrl: `https://facebook.com/${page_id}`,
                message: `Meta Lead Gen — Form ${change.value.form_id}, Lead ${leadgen_id}`,
                status: "new",
              });
              console.log(`[MetaLeadWebhook] Saved lead: ${fullName} (${email}, ${phone})`);
            }

            // Notify owner about new lead
            await notifyOwner({
              title: `New Meta Lead: ${fullName}`,
              content: `A new lead submitted the Instant Form on Facebook.\n\nName: ${fullName}\nEmail: ${email ?? "N/A"}\nPhone: ${phone ?? "N/A"}\n\nLead ID: ${leadgen_id}`,
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

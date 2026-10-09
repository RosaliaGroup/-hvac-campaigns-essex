import { startGmailCrmScheduler } from "../services/gmailCrm";
import { start30DayCadenceScheduler } from "../services/crm30DaySync";
import { startVerifiedProspectPhoneBackfill } from "../services/backfillVerifiedProspectPhones";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerSeoRoutes } from "../seo";
import { startScheduledSmsProcessor } from "../services/scheduledSms";
import { startSalesDocPoller } from "../services/salesDocPoller";
import { startDueReminderSweep } from "../services/dueReminderSweep";
import { registerSmsWebhookRoutes, assertWebhookSecurityOrExit } from "../services/smsWebhook";
import { attachBodyParsers } from "./bodyParser";
import { registerMetaLeadWebhookRoutes } from "../services/metaLeadWebhook";
import { registerVapiToolRoutes } from "../services/vapiSendForm";
import { registerQuickbooksRoutes } from "../integrations/accounting/routes";
import { registerGoogleCalendarRoutes } from "../integrations/google/routes";
import { registerSeoSyncRoutes, startSeoSyncScheduler } from "../services/seo/routes";
import { registerActionLinkRoutes } from "../services/seo/actionLinkRoutes";
import { startNightlyDraftScheduler } from "../services/seo/nightlyDraftJob";
import { startWeeklyContentScheduler } from "../services/seo/contentPipeline";
import { startAutoMergeScheduler } from "../services/seo/autoMerge";
import { seedContentQueue } from "../services/seo/contentQueue";
import { startStaleOptimizingSweep } from "../services/seo/draftManagement";
import { startMarketIntelScheduler } from "../services/seo/intel/job";
import { registerGa4SyncRoutes, startGa4SyncScheduler } from "../services/ga4/routes";
import { registerGbpSyncRoutes, startGbpSyncScheduler } from "../services/gbp/routes";
import { registerVapiRecapRoute } from "../integrations/vapiRecapRoute";
import { registerVapiToolsRoute } from "../integrations/vapiToolsRoute";
import { startGrowthCadencePoller } from "../services/growth/cadenceEngine";
import { startReviewEnginePoller } from "../services/growth/reviewEngine";
import { startImportReleaseSweep } from "../services/growth/contactImport";
import { registerSocialActionRoutes } from "../services/social/vetoRoutes";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Fail-fast in production if webhook signature verification is not configured.
  assertWebhookSecurityOrExit();

  const app = express();
  const server = createServer(app);
  // Body parsers + raw-body capture for webhook signature verification.
  attachBodyParsers(app);
  // SEO: dynamic sitemap.xml (must be before static file serving)
  registerSeoRoutes(app);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // SMS reply webhook — Telnyx inbound (active) + legacy TextBelt format fallback
  registerSmsWebhookRoutes(app);
  // Meta Lead Gen webhook (Instant Form submissions)
  registerMetaLeadWebhookRoutes(app);
  // Vapi tool webhook — Jessica's sendForm (Mechanical booking link via Telnyx).
  // Authenticated by VAPI_TOOL_SECRET; separate from the tRPC vapiTools webhook.
  registerVapiToolRoutes(app);
  // QuickBooks OAuth callback (/api/integrations/quickbooks/callback)
  registerQuickbooksRoutes(app);
  // Google Calendar OAuth callback (/api/integrations/google-calendar/callback)
  registerGoogleCalendarRoutes(app);
  // SEO Intelligence — Search Console sync (POST /api/seo/sync)
  registerSeoSyncRoutes(app);
  // SEO autopublish — unauthenticated veto link (GET/POST /api/seo/action)
  registerActionLinkRoutes(app);
  // Social Lane — unauthenticated veto/revert links (GET/POST /api/social/veto, /api/social/revert)
  registerSocialActionRoutes(app);
  // GA4 Analytics — Analytics Data API sync (POST /api/analytics/ga4/sync)
  registerGa4SyncRoutes(app);
  // Local SEO — Google Business Profile sync (POST /api/gbp/sync)
  registerGbpSyncRoutes(app);
  // Vapi (Jessica) end-of-call recap — persist to Mechanical CRM + notify (POST /api/vapi/call-recap)
  registerVapiRecapRoute(app);
  // Vapi function tools (getCallerInfo/bookHVAC/rescheduleHVAC/sendReferralLink) — Vapi-shaped REST adapter over the vapiTools dispatcher (POST /api/vapi/tools)
  registerVapiToolsRoute(app);
  // API responses (incl. auth.me and every session-scoped read) must never be
  // cached or restored from the back button / bfcache — always re-fetched and
  // re-authorized. Applied before the tRPC handler so it covers all responses.
  app.use("/api/trpc", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Start background SMS scheduler (checks every 5 min for due sends)
    startScheduledSmsProcessor();
    // Start QuickBooks sales-document poller (incremental sync + follow-up dispatch)
    startSalesDocPoller();
    // Hourly sweep: task due dates + bid deadlines -> bell + email reminders
    startDueReminderSweep();
    // Start daily Search Console → cache sync for SEO Intelligence
    startSeoSyncScheduler();
    startGmailCrmScheduler();
    start30DayCadenceScheduler();
    startVerifiedProspectPhoneBackfill();
    // Start daily GA4 Analytics Data API → cache sync for Marketing Analytics
    startGa4SyncScheduler();
    // Start daily Business Profile → cache sync for Local SEO
    startGbpSyncScheduler();
    // SEO autopublish (docs/seo-automation-addendum-autopublish.md) — all
    // gated off by default via their own env flags; seeding the content queue
    // is always safe (idempotent, by-title check).
    seedContentQueue().catch((err) => console.error("[SEO] content queue seed failed:", err));
    startNightlyDraftScheduler();
    startWeeklyContentScheduler();
    startAutoMergeScheduler();
    // Recovery sweep: a page can't be permanently stuck showing "optimizing"
    // in SEO Opportunities — anything past 30min gets kicked back to
    // needs_review (content preserved) with an audit row.
    startStaleOptimizingSweep();
    // Growth system (docs/growth-system-spec.md) — speed-to-lead's day-0 SMS
    // dispatches inline at enrollment; this poller carries every later cadence
    // step (day-0 call, day-1/3/7/14) plus the review engine + §7 import release.
    startGrowthCadencePoller();
    startReviewEnginePoller();
    startImportReleaseSweep();
    // Daily Market Intelligence Report (docs/market-intel-spec.md) — gated
    // off by default via SEO_INTEL_ENABLED.
    startMarketIntelScheduler();
  });
}

startServer().catch(console.error);

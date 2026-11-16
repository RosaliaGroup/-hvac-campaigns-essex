/**
 * Marketing role — the Marketing department and the Daily Hub, nothing else.
 *
 * A team member with role "marketing" runs social, SEO, ads and SMS campaigns.
 * They do NOT see the rest of the CRM: leads and contacts lists, calendar,
 * jobs, financials (QuickBooks, invoices, estimates, opportunities), dispatch,
 * AI/automation settings or administration.
 *
 * Enforcement is DENY BY DEFAULT on the server, same as shared/salesAccess.ts:
 * a marketing session may only call the tRPC procedures listed below (see
 * server/_core/trpc.ts). Admin-only procedures stay admin-only (adminProcedure
 * checks users.role, which a team marketing session never has). The route list
 * further down only decides what the sidebar shows and where the browser lands.
 */

export const MARKETING_ROLE = "marketing" as const;

/** Every tRPC procedure path a marketing session may call. Nothing else. */
export const MARKETING_ALLOWED_PROCEDURES: ReadonlySet<string> = new Set([
  // Session
  "auth.me",
  "auth.logout",
  // Own notifications
  "notifications.list",
  "notifications.unreadCount",
  "notifications.markRead",
  "notifications.markAllRead",
  // Team Hub inside the CRM (tasks, clock, reports)
  "teamHub.link",
  "teamHub.assignment",

  // Marketing Dashboard (social posts)
  "aiVa.listSocialPosts",
  "aiVa.generatePostContent",
  "aiVa.schedulePost",
  "aiVa.retryPost",
  "aiVa.deletePost",
  "leadCaptures.marketingBaseline",
  "marketingAiTasks.submit",

  // SEO Intelligence (publishing to the site stays admin-only server-side)
  "seo.addTag",
  "seo.aiProviderStatus",
  "seo.approveBatchToPR",
  "seo.approveContentToPR",
  "seo.approveOptimization",
  "seo.autopublishStatus",
  "seo.buildBatchDiff",
  "seo.bulkGenerateOptimization",
  "seo.discardAllDrafts",
  "seo.generateOptimization",
  "seo.getActiveJobs",
  "seo.getAuditLog",
  "seo.getBusinessImpact",
  "seo.getJobStatus",
  "seo.getLaneJobStatus",
  "seo.getLockStatus",
  "seo.getOpportunities",
  "seo.getOptimization",
  "seo.getOverview",
  "seo.getPublicationAuditStatus",
  "seo.getPublicationIssues",
  "seo.getSyncStatus",
  "seo.getTags",
  "seo.githubConfigured",
  "seo.listBatches",
  "seo.listContentQueue",
  "seo.regenerateOptimization",
  "seo.regenerateUnlockedDrafts",
  "seo.rejectOptimization",
  "seo.removeTag",
  "seo.resumeCircuitBreaker",
  "seo.retryRejectedContentDraft",
  "seo.revertBatch",
  "seo.runContentJobNow",
  "seo.runNightlyDraftJobNow",
  "seo.setStatus",
  "seo.sync",
  "seo.updateOptimizationDraft",
  "seo.verifyRecentLiveBlogs",

  // Market Intel
  "marketIntel.dismissItem",
  "marketIntel.getJobStatus",
  "marketIntel.getLatestReport",
  "marketIntel.getReport",
  "marketIntel.listReports",
  "marketIntel.revertAllFromReport",
  "marketIntel.revertItem",
  "marketIntel.runNow",

  // Revenue Attribution
  "attribution.getByLandingPage",
  "attribution.getBySource",
  "attribution.getCommercialLandingAudit",
  "attribution.getFunnel",
  "attribution.getOverview",
  "attribution.getSuggestedMatches",
  "attribution.getUnattributed",
  "attribution.linkOpportunityToLeadCapture",
  "attribution.unlinkOpportunityAttribution",

  // SMS Campaigns and its conversation panel are NOT here on purpose: they are
  // customer phone numbers and private texts, which marketing doesn't need.

  // Campaign Performance + Google Ads + Facebook/Instagram
  "googleAds.createCampaign",
  "googleAds.getAccountSummary",
  "googleAds.getAuthUrl",
  "googleAds.getCampaignPerformance",
  "googleAds.getConnectionStatus",
  "googleAds.getConversionActionPerformance",
  "googleAds.getSearchTermPerformance",
  "metaAds.createCampaign",
  "metaAds.getAuthUrl",
  "metaAds.getCampaignPerformance",
  "metaAds.getConnectionStatus",
  "metaAds.saveConfig",
  "metaAds.testConnection",
]);

export function isMarketingAllowedProcedure(path: string): boolean {
  return MARKETING_ALLOWED_PROCEDURES.has(path);
}

type MaybeTeamUser = { teamRole?: string | null; marketingOnly?: boolean | null } | null | undefined;

/** A marketing session: teamRole "marketing", or a viewer flagged marketing-only. */
export function isMarketingUser(user: MaybeTeamUser): boolean {
  return user?.teamRole === MARKETING_ROLE || user?.marketingOnly === true;
}

/**
 * Viewers limited to Marketing + Daily Hub without a role change: their login
 * emails, comma-separated, in env MARKETING_ONLY_EMAILS (server only).
 */
export function isMarketingOnlyEmail(email: string | null | undefined, listArg?: string): boolean {
  const list = listArg ?? (typeof process !== "undefined" ? process.env.MARKETING_ONLY_EMAILS : undefined);
  const e = String(email ?? "").trim().toLowerCase();
  if (!e || !list) return false;
  return list.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).includes(e);
}

/* ── Client side (navigation only — not a security boundary) ─────────────── */

/** Routes a marketing user can open. Everything else redirects to the Daily Hub. */
export const MARKETING_ROUTE_PREFIXES: readonly string[] = [
  "/team-hub",
  "/marketing-dashboard",
  "/seo-intelligence",
  "/market-intel",
  "/revenue-attribution",
  "/campaign-performance",
  "/google-ads-campaigns",
  "/facebook-campaigns",
];

export const MARKETING_HOME = "/team-hub";

export function isMarketingRoute(location: string): boolean {
  const path = (location || "/").split(/[?#]/)[0] || "/";
  return MARKETING_ROUTE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

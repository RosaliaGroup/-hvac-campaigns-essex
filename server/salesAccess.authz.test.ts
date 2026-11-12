/**
 * Sales role lock-down. A sales session (teamRole "sales") may only call the
 * procedures in shared/salesAccess.ts. Walks EVERY procedure in the real
 * appRouter so a newly added route is denied to sales unless deliberately
 * allowlisted.
 */
import "./testEnvSetup"; // MUST be first
import { afterEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";
import type { AuthenticatedUser, TrpcContext } from "./_core/context";
import {
  SALES_ALLOWED_PROCEDURES,
  isSalesAllowedProcedure,
  isSalesRoute,
  redactCustomerDetailForSales,
  redactLeadCaptureForSales,
} from "@shared/salesAccess";
import { decodeState, encodeState, handleCallEvent } from "./services/clickToCall";

const createCaller = createCallerFactory(appRouter);

function ctxFor(teamRole: AuthenticatedUser["teamRole"], role: "user" | "admin" = "user"): TrpcContext {
  return {
    req: { headers: {}, ip: "1.1.1.1" } as never,
    res: { cookie() {}, clearCookie() {} } as never,
    user: {
      id: -9, openId: "team:9", name: "Rep", email: "rep@example.com", loginMethod: "team",
      role, teamRole, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), videoInterests: null,
    } as AuthenticatedUser,
  };
}

async function codeOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await Promise.race([fn(), new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 3000))]);
    return "NO_ERROR";
  } catch (e) {
    return e instanceof TRPCError ? e.code : "OTHER";
  }
}

/** Genuinely public endpoints (website forms, sign-in, customer portal with its own session, webhooks). */
const PUBLIC = [
  /^system\.health$/,
  /^teamAuth\.(getInvite|acceptInvite|login|requestPasswordReset|resetPassword)$/,
  /^rebateCalculator\.(calculate|submitCalculation|geocodeAddress|sendResultsSms|register|getByToken|autocompleteAddress)$/,
  /^portal\./,
  /^leadCaptures\.create$/,
  /^warmSafe\.nominate$/,
  /^webhooks\./,
];

const allPaths = Object.keys((appRouter as any)._def.procedures as Record<string, unknown>);
const call = (caller: any, path: string) => () => path.split(".").reduce((o, p) => o[p], caller)({});

describe("sales role — server allowlist", () => {
  it("every allowlisted path exists in the router", () => {
    for (const p of SALES_ALLOWED_PROCEDURES) expect(allPaths, p).toContain(p);
  });

  it("blocks every non-allowlisted internal procedure with FORBIDDEN", async () => {
    const sales = createCaller(ctxFor("sales"));
    const leaks: string[] = [];
    for (const path of allPaths) {
      if (isSalesAllowedProcedure(path) || PUBLIC.some((re) => re.test(path))) continue;
      const code = await codeOf(call(sales, path));
      if (code !== "FORBIDDEN") leaks.push(`${path} → ${code}`);
    }
    expect(leaks).toEqual([]);
  }, 120_000);

  it("blocks financial, marketing and admin areas specifically", async () => {
    const sales = createCaller(ctxFor("sales"));
    for (const path of [
      "quickbooks.getStatus", "opportunities.list", "estimates.listByCustomer", "jobs.list",
      "executiveDashboards.finance", "googleAds.getCampaignPerformance", "metaAds.getCampaignPerformance",
      "seo.getOverview", "analytics.overview", "attribution.getOverview", "smsCampaigns.listCampaigns",
      "leadCaptures.analytics", "leadCaptures.marketingBaseline", "aiVa.getAllCredentials", "teamAuth.list",
      "customers.archive", "customers.deleteProperty", "growth.scoreboard",
    ]) {
      expect(await codeOf(call(sales, path)), path).toBe("FORBIDDEN");
    }
  });

  it("lets sales reach the allowlisted procedures (no FORBIDDEN from the guard)", async () => {
    const sales = createCaller(ctxFor("sales"));
    for (const path of ["appointments.list", "customers.list", "leadCaptures.list", "calls.status", "calls.listForContact"]) {
      expect(await codeOf(call(sales, path)), path).not.toBe("FORBIDDEN");
    }
  });

  it("does not change access for members", async () => {
    const member = createCaller(ctxFor("member"));
    expect(await codeOf(call(member, "opportunities.list"))).not.toBe("FORBIDDEN");
    expect(await codeOf(call(member, "jobs.list"))).not.toBe("FORBIDDEN");
  });
});

describe("sales role — redaction", () => {
  it("strips money and QuickBooks from a contact's detail", () => {
    const out = redactCustomerDetailForSales({
      customer: { id: 1, firstName: "A", phone: "5551234567", quickbooksCustomerId: "77", quickbooksSyncStatus: "synced", hasQboConflicts: true },
      captures: [{ id: 3, utmCampaign: "x", gclid: "g", status: "new" }],
      opportunities: [{ amount: 9000 }], estimates: [{ totalAmount: 1 }], invoices: [{ balance: 5 }], jobs: [{ id: 1 }],
      rebateCalculations: [{ total: 1 }],
      counts: { properties: 2, opportunities: 1, jobs: 1, estimates: 1, invoices: 1 },
      summary: { collectedRevenue: 100, outstandingBalance: 50, invoicedTotal: 150, wonOpportunityValue: 9000, properties: 2 },
    } as any) as any;
    expect(out.customer.phone).toBe("5551234567");
    expect(out.customer.quickbooksCustomerId).toBeNull();
    expect(out.customer.hasQboConflicts).toBe(false);
    expect(out.opportunities).toEqual([]);
    expect(out.estimates).toEqual([]);
    expect(out.invoices).toEqual([]);
    expect(out.jobs).toEqual([]);
    expect(out.rebateCalculations).toEqual([]);
    expect(out.summary).toMatchObject({ collectedRevenue: 0, outstandingBalance: 0, invoicedTotal: 0, wonOpportunityValue: 0, properties: 2 });
    expect(out.captures[0]).toMatchObject({ utmCampaign: null, gclid: null, status: "new" });
  });

  it("strips marketing attribution from a lead", () => {
    const out = redactLeadCaptureForSales({ id: 1, phone: "5551234567", utmSource: "google", utmCampaign: "c", gclid: "g", pageUrl: "/lp", status: "new" });
    expect(out).toMatchObject({ phone: "5551234567", utmSource: null, utmCampaign: null, gclid: null, pageUrl: null, status: "new" });
  });

  it("limits sales to the lead, contact and calendar screens", () => {
    for (const ok of ["/lead-dashboard", "/leads/12", "/customers", "/customers/5", "/calendar?x=1"]) expect(isSalesRoute(ok), ok).toBe(true);
    for (const no of ["/command-center", "/opportunities", "/google-ads-campaigns", "/settings/integrations", "/customers/sms-consent", "/team-management", "/jobs/3"]) {
      expect(isSalesRoute(no), no).toBe(false);
    }
  });
});

describe("click-to-call webhook flow", () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 }));
  afterEach(() => {
    fetchMock.mockClear();
    vi.unstubAllGlobals();
  });

  it("round-trips client_state and ignores foreign calls", () => {
    expect(decodeState(encodeState({ logId: 4, leg: "rep", to: "+15551234567" }))).toEqual({ logId: 4, leg: "rep", to: "+15551234567" });
    expect(decodeState("not-base64-json")).toBeNull();
    expect(decodeState(undefined)).toBeNull();
  });

  it("rep answers → dials the client bridged to the rep; client answers → recording starts", async () => {
    vi.stubGlobal("fetch", fetchMock);
    process.env.TELNYX_API_KEY = "k";
    process.env.TELNYX_CALL_CONTROL_APP_ID = "app1";
    process.env.TELNYX_VOICE_FROM_NUMBER = "+15516007027";

    await handleCallEvent("call.answered", { call_control_id: "rep-cc", client_state: encodeState({ logId: 7, leg: "rep", to: "+15551234567" }) });
    const [url1, init1] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url1).toBe("https://api.telnyx.com/v2/calls");
    const body1 = JSON.parse(String(init1.body));
    expect(body1).toMatchObject({ to: "+15551234567", from: "+15516007027", link_to: "rep-cc", bridge_on_answer: true, connection_id: "app1" });
    expect(decodeState(body1.client_state)).toEqual({ logId: 7, leg: "client", repCcid: "rep-cc" });

    await handleCallEvent("call.answered", { call_control_id: "client-cc", client_state: body1.client_state });
    const [url2, init2] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(url2).toBe("https://api.telnyx.com/v2/calls/rep-cc/actions/record_start");
    expect(JSON.parse(String(init2.body))).toMatchObject({ format: "mp3", channels: "dual", play_beep: true });
  });

  it("does nothing for calls that aren't click-to-call legs", async () => {
    vi.stubGlobal("fetch", fetchMock);
    await handleCallEvent("call.answered", { call_control_id: "x", client_state: undefined });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

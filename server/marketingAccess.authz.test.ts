/**
 * Marketing role lock-down. A marketing session (teamRole "marketing") may only
 * call the procedures in shared/marketingAccess.ts. Walks EVERY procedure in the
 * real appRouter so a newly added route is denied to marketing unless
 * deliberately allowlisted.
 */
import "./testEnvSetup"; // MUST be first
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { createCallerFactory } from "./_core/trpc";
import type { AuthenticatedUser, TrpcContext } from "./_core/context";
import { MARKETING_ALLOWED_PROCEDURES, isMarketingAllowedProcedure, isMarketingRoute } from "@shared/marketingAccess";

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

describe("marketing role — server allowlist", () => {
  it("every allowlisted path exists in the router", () => {
    for (const p of MARKETING_ALLOWED_PROCEDURES) expect(allPaths, p).toContain(p);
  });

  it("blocks every non-allowlisted internal procedure with FORBIDDEN", async () => {
    const mk = createCaller(ctxFor("marketing"));
    const leaks: string[] = [];
    for (const path of allPaths) {
      if (isMarketingAllowedProcedure(path) || PUBLIC.some((re) => re.test(path))) continue;
      const code = await codeOf(call(mk, path));
      if (code !== "FORBIDDEN") leaks.push(`${path} → ${code}`);
    }
    expect(leaks).toEqual([]);
  }, 120_000);

  it("blocks the CRM, money and admin areas specifically", async () => {
    const mk = createCaller(ctxFor("marketing"));
    for (const path of [
      "leadCaptures.list", "customers.list", "customers.getById", "appointments.list", "jobs.list",
      "opportunities.list", "quickbooks.getStatus", "executiveDashboards.finance", "teamAuth.list",
      "growth.scoreboard", "calls.start", "crmCommunications.composeEmail", "analytics.overview",
    ]) {
      expect(await codeOf(call(mk, path)), path).toBe("FORBIDDEN");
    }
  });

  it("keeps publishing and ad spend admin-only", async () => {
    const mk = createCaller(ctxFor("marketing"));
    for (const path of ["seo.approveContentToPR", "seo.approveBatchToPR", "googleAds.createCampaign", "metaAds.createCampaign", "metaAds.saveConfig"]) {
      expect(await codeOf(call(mk, path)), path).toBe("FORBIDDEN");
    }
  });

  it("lets marketing reach its pages (no FORBIDDEN from the guard)", async () => {
    const mk = createCaller(ctxFor("marketing"));
    for (const path of ["seo.getOverview", "aiVa.listSocialPosts", "smsCampaigns.listContacts", "attribution.getOverview", "teamHub.assignment"]) {
      expect(await codeOf(call(mk, path)), path).not.toBe("FORBIDDEN");
    }
  });

  it("does not change access for members or sales", async () => {
    expect(await codeOf(call(createCaller(ctxFor("member")), "jobs.list"))).not.toBe("FORBIDDEN");
    expect(await codeOf(call(createCaller(ctxFor("sales")), "customers.list"))).not.toBe("FORBIDDEN");
  });

  it("limits marketing to the Marketing screens and the Daily Hub", () => {
    for (const ok of ["/team-hub", "/marketing-dashboard", "/seo-intelligence?tab=x", "/sms-campaigns", "/facebook-campaigns"]) expect(isMarketingRoute(ok), ok).toBe(true);
    for (const no of ["/command-center", "/lead-dashboard", "/customers", "/calendar", "/opportunities", "/analytics", "/team-management"]) {
      expect(isMarketingRoute(no), no).toBe(false);
    }
  });
});

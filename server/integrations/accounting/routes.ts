/**
 * QuickBooks OAuth callback (Task 7).
 * Reachable in production via the Netlify /api/* proxy → Railway.
 * Intuit redirects the browser here with ?code&realmId&state after consent.
 */
import type { Express, Request, Response } from "express";
import { quickbooksProvider, getQboConfig, verifyState } from "./quickbooks";

function qp(req: Request, key: string): string | undefined {
  const v = req.query[key];
  return typeof v === "string" ? v : undefined;
}

const DEST = "/settings/integrations";

export function registerQuickbooksRoutes(app: Express) {
  app.get("/api/integrations/quickbooks/callback", async (req: Request, res: Response) => {
    const code = qp(req, "code");
    const realmId = qp(req, "realmId");
    const state = qp(req, "state");
    const error = qp(req, "error");

    if (error) {
      res.redirect(302, `${DEST}?qb_error=${encodeURIComponent(error)}`);
      return;
    }
    if (!verifyState(state)) {
      res.redirect(302, `${DEST}?qb_error=invalid_state`);
      return;
    }
    if (!code || !realmId) {
      res.redirect(302, `${DEST}?qb_error=missing_code_or_realm`);
      return;
    }

    try {
      const cfg = getQboConfig();
      await quickbooksProvider.connect({ code, realmId, redirectUri: cfg.redirectUri });
      res.redirect(302, `${DEST}?qb_connected=1`);
    } catch (e) {
      // Never leak token/exchange internals to the URL.
      console.error("[QuickBooks] OAuth connect failed:", (e as Error).message);
      res.redirect(302, `${DEST}?qb_error=connect_failed`);
    }
  });
}

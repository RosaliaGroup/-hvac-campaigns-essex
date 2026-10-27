import type { Express, Request, Response } from "express";
import { connectDedicatedGbp, verifyGbpState } from "./gbpDedicatedOAuth";
export function registerDedicatedGbpRoutes(app: Express) {
  app.get("/api/integrations/google-business/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !verifyGbpState(state)) {
      res.redirect(302, "/settings/integrations?gbp_error=invalid_authorization");
      return;
    }
    try {
      await connectDedicatedGbp(code);
      res.redirect(302, "/settings/integrations?gbp_connected=1");
    } catch (error) {
      console.warn("[GBP] OAuth callback failed:", (error as Error).name);
      res.redirect(302, "/settings/integrations?gbp_error=connect_failed");
    }
  });
}

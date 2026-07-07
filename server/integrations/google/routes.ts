/**
 * Google Calendar OAuth callback (Task 8).
 * Google redirects the browser here with ?code&state after consent.
 * Reachable in production via the Netlify /api/* proxy → Railway.
 */
import type { Express, Request, Response } from "express";
import { googleCalendarProvider, verifyState } from "./calendar";

function qp(req: Request, key: string): string | undefined {
  const v = req.query[key];
  return typeof v === "string" ? v : undefined;
}

const DEST = "/settings/integrations";

export function registerGoogleCalendarRoutes(app: Express) {
  app.get("/api/integrations/google-calendar/callback", async (req: Request, res: Response) => {
    const code = qp(req, "code");
    const state = qp(req, "state");
    const error = qp(req, "error");

    if (error) {
      res.redirect(302, `${DEST}?gcal_error=${encodeURIComponent(error)}`);
      return;
    }
    if (!verifyState(state)) {
      res.redirect(302, `${DEST}?gcal_error=invalid_state`);
      return;
    }
    if (!code) {
      res.redirect(302, `${DEST}?gcal_error=missing_code`);
      return;
    }

    try {
      await googleCalendarProvider.connect({ code });
      res.redirect(302, `${DEST}?gcal_connected=1`);
    } catch (e) {
      // Never leak token/exchange internals to the URL.
      console.error("[GoogleCalendar] OAuth connect failed:", (e as Error).message);
      res.redirect(302, `${DEST}?gcal_error=connect_failed`);
    }
  });
}

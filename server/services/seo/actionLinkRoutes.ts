/**
 * Unauthenticated veto route for the autopublish hold-and-veto flow
 * (docs/seo-automation-addendum-autopublish.md §A2). GET renders a
 * confirmation page (so an email client's link-preview crawler prefetching
 * the URL can never itself trigger the veto); POST performs it. Rate-limited
 * with this codebase's existing limiter (server/_core/rateLimit.ts).
 */
import type { Express, Request, Response } from "express";
import { verifyActionLink, consumeActionLink, ActionLinkNotConfiguredError, InvalidActionLinkError, ExpiredActionLinkError, ActionLinkAlreadyConsumedError } from "./actionLinks";
import { vetoBatch } from "./bulkApprove";
import { checkRateLimit, getClientIp } from "../../_core/rateLimit";

const RATE_LIMIT_BUCKET = "seo.action.link";
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function page(title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:system-ui,sans-serif;max-width:520px;margin:64px auto;padding:0 20px;color:#1e3a5f}button{background:#ff6b35;color:#fff;border:none;padding:12px 20px;border-radius:6px;font-size:15px;cursor:pointer}button:hover{opacity:.9}</style></head><body>${bodyHtml}</body></html>`;
}

export function registerActionLinkRoutes(app: Express): void {
  app.get("/api/seo/action", (req: Request, res: Response) => {
    const token = String(req.query.token ?? "");
    try {
      const payload = verifyActionLink(token);
      res.status(200).send(
        page(
          "Confirm veto — SEO Intelligence",
          `<h1>Veto this batch?</h1><p>This will close batch #${payload.batchId}'s pull request without merging it. This cannot be undone with this link.</p>
           <form method="POST" action="/api/seo/action"><input type="hidden" name="token" value="${token}"><button type="submit">Confirm veto</button></form>`,
        ),
      );
    } catch (err) {
      res.status(err instanceof ExpiredActionLinkError ? 410 : 400).send(page("Link invalid", `<h1>${describeError(err)}</h1>`));
    }
  });

  app.post("/api/seo/action", async (req: Request, res: Response) => {
    const ip = getClientIp({ req });
    const { allowed } = checkRateLimit(RATE_LIMIT_BUCKET, ip, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!allowed) {
      res.status(429).send(page("Too many attempts", "<h1>Too many attempts — try again later.</h1>"));
      return;
    }

    const token = String(req.body?.token ?? req.query.token ?? "");
    try {
      const payload = await consumeActionLink(token);
      await vetoBatch(payload.batchId, null);
      res.status(200).send(page("Vetoed", `<h1>Batch #${payload.batchId} vetoed.</h1><p>The pull request has been closed without merging.</p>`));
    } catch (err) {
      const status = err instanceof ExpiredActionLinkError ? 410 : err instanceof ActionLinkAlreadyConsumedError ? 409 : 400;
      res.status(status).send(page("Could not veto", `<h1>${describeError(err)}</h1>`));
    }
  });
}

function describeError(err: unknown): string {
  if (err instanceof ActionLinkNotConfiguredError) return "This feature is not configured.";
  if (err instanceof ExpiredActionLinkError) return "This link has expired.";
  if (err instanceof ActionLinkAlreadyConsumedError) return "This link has already been used.";
  if (err instanceof InvalidActionLinkError) return "This link is invalid.";
  return "Something went wrong.";
}

/**
 * Unauthenticated veto/revert routes for the Social Lane's hold-and-veto flow
 * (docs/social-lane-spec.md §1/§7). Mirrors
 * server/services/seo/actionLinkRoutes.ts's GET-confirms/POST-performs
 * pattern exactly (so an email client's link-preview crawler can never
 * itself trigger the action) and reuses the same rate limiter.
 */
import type { Express, Request, Response } from "express";
import {
  ExpiredActionLinkError,
  InvalidActionLinkError,
  ActionLinkNotConfiguredError,
  verifySocialActionLink,
} from "../seo/actionLinks";
import { vetoPost, revertPost, SocialActionAlreadyHandledError } from "./holdAndPublish";
import { defaultHoldRepoDeps } from "./repo";
import { makeGatedSocialPlatformClient } from "./platformClient";
import { checkRateLimit, getClientIp } from "../../_core/rateLimit";

const RATE_LIMIT_BUCKET = "social.action.link";
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function page(title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:system-ui,sans-serif;max-width:520px;margin:64px auto;padding:0 20px;color:#1e3a5f}button{background:#ff6b35;color:#fff;border:none;padding:12px 20px;border-radius:6px;font-size:15px;cursor:pointer}button:hover{opacity:.9}</style></head><body>${bodyHtml}</body></html>`;
}

function describeError(err: unknown): string {
  if (err instanceof ActionLinkNotConfiguredError) return "This feature is not configured.";
  if (err instanceof ExpiredActionLinkError) return "This link has expired.";
  if (err instanceof SocialActionAlreadyHandledError) return err.message;
  if (err instanceof InvalidActionLinkError) return "This link is invalid.";
  return err instanceof Error ? err.message : "Something went wrong.";
}

export function registerSocialActionRoutes(app: Express): void {
  app.get("/api/social/veto", (req: Request, res: Response) => {
    const token = String(req.query.token ?? "");
    try {
      const payload = verifySocialActionLink(token);
      res.status(200).send(
        page(
          "Confirm veto — Social Lane",
          `<h1>Cancel this post?</h1><p>This will cancel post #${payload.postId} before it publishes. This cannot be undone with this link.</p>
           <form method="POST" action="/api/social/veto"><input type="hidden" name="token" value="${token}"><button type="submit">Confirm cancel</button></form>`,
        ),
      );
    } catch (err) {
      res.status(err instanceof ExpiredActionLinkError ? 410 : 400).send(page("Link invalid", `<h1>${describeError(err)}</h1>`));
    }
  });

  app.post("/api/social/veto", async (req: Request, res: Response) => {
    const ip = getClientIp({ req });
    const { allowed } = checkRateLimit(RATE_LIMIT_BUCKET, ip, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!allowed) {
      res.status(429).send(page("Too many attempts", "<h1>Too many attempts — try again later.</h1>"));
      return;
    }
    const token = String(req.body?.token ?? req.query.token ?? "");
    try {
      const { id } = await vetoPost(token, defaultHoldRepoDeps());
      res.status(200).send(page("Cancelled", `<h1>Post #${id} cancelled.</h1><p>It will not publish.</p>`));
    } catch (err) {
      res.status(400).send(page("Could not cancel", `<h1>${describeError(err)}</h1>`));
    }
  });

  app.get("/api/social/revert", (req: Request, res: Response) => {
    const token = String(req.query.token ?? "");
    try {
      const payload = verifySocialActionLink(token);
      res.status(200).send(
        page(
          "Confirm delete — Social Lane",
          `<h1>Delete this post?</h1><p>This will delete post #${payload.postId} from the platform it was published to. This cannot be undone.</p>
           <form method="POST" action="/api/social/revert"><input type="hidden" name="token" value="${token}"><button type="submit">Confirm delete</button></form>`,
        ),
      );
    } catch (err) {
      res.status(err instanceof ExpiredActionLinkError ? 410 : 400).send(page("Link invalid", `<h1>${describeError(err)}</h1>`));
    }
  });

  app.post("/api/social/revert", async (req: Request, res: Response) => {
    const ip = getClientIp({ req });
    const { allowed } = checkRateLimit(RATE_LIMIT_BUCKET, ip, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!allowed) {
      res.status(429).send(page("Too many attempts", "<h1>Too many attempts — try again later.</h1>"));
      return;
    }
    const token = String(req.body?.token ?? req.query.token ?? "");
    try {
      const { id } = await revertPost(token, defaultHoldRepoDeps(), makeGatedSocialPlatformClient());
      res.status(200).send(page("Deleted", `<h1>Post #${id} deleted.</h1>`));
    } catch (err) {
      res.status(400).send(page("Could not delete", `<h1>${describeError(err)}</h1>`));
    }
  });
}

/**
 * Web push delivery.
 *
 * Alerts already exist in-app (the bell); this fans the same alert out to any device the
 * team member has allowed notifications on, so a phone buzzes with the app closed.
 *
 * Configuration is optional by design: with no VAPID keys set, `sendPushToMembers` is a
 * silent no-op and everything else in the app keeps working. That keeps local dev and any
 * environment without keys from throwing on every alert.
 *
 * Required env:
 *   VAPID_PUBLIC_KEY   — also served to the browser to subscribe with
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT      — a mailto: or https: URL identifying the sender (optional)
 */
import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { pushSubscriptions } from "../../drizzle/schema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

let configured: boolean | null = null;

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

/** Configure once per process; returns false when keys are absent. */
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    console.warn("[webPush] VAPID keys not set — push notifications disabled (in-app alerts still work).");
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:sales@mechanicalenterprise.com",
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body?: string | null;
  link?: string | null;
  tag?: string | null;
};

/**
 * Deliver a push to every device belonging to these team members.
 *
 * Never throws: a push failure must not roll back the action that raised the alert.
 * Endpoints that report 404/410 are dead — the subscription is deleted so the table
 * doesn't accumulate devices that will never receive anything again.
 */
export async function sendPushToMembers(db: Db, teamMemberIds: number[], payload: PushPayload): Promise<number> {
  if (!teamMemberIds.length) return 0;
  if (!ensureConfigured()) return 0;

  try {
    const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.teamMemberId, teamMemberIds));
    // Log the attempt, not just failures. A silent log used to be indistinguishable
    // between "sent fine" and "never ran", which made this impossible to diagnose.
    console.log(`[webPush] attempt: members=${teamMemberIds.join(",")} devices=${subs.length} title="${payload.title}"`);
    if (!subs.length) return 0;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body ?? "",
      link: payload.link ?? "/",
      tag: payload.tag ?? undefined,
    });

    let sent = 0;
    const dead: number[] = [];

    await Promise.all(
      subs.map(async sub => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
          );
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) dead.push(sub.id);
          else console.error("[webPush] send failed", status, (err as Error).message);
        }
      }),
    );

    for (const id of dead) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
    }
    console.log(`[webPush] result: sent=${sent} dead=${dead.length} of ${subs.length}`);
    return sent;
  } catch (err) {
    console.error("[webPush] unexpected failure", err);
    return 0;
  }
}

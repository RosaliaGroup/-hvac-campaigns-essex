/**
 * Structured server-side auth event logging (Auth Hardening, 2026-07).
 *
 * Emits one JSON line per security-relevant auth event so it is greppable in
 * Railway logs and parseable by log tooling. Deliberately records ONLY metadata:
 * never a password, session token, or any JWT contents.
 */
import type { Request } from "express";

export type AuthEvent =
  | "login"
  | "logout"
  | "session_expired"
  | "invalid_token"
  | "invalid_signature";

export type AuthOutcome = "success" | "failure";

export type AuthLogFields = {
  event: AuthEvent;
  outcome: AuthOutcome;
  /** Numeric team-member id (or null for anonymous / OAuth-only). */
  userId?: number | string | null;
  /** Reserved for multi-tenant; single-org today, logged as null for forward-compat. */
  teamId?: number | string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Short machine reason, e.g. "bad_password", "jwt_expired", "absolute_cap". Never secrets. */
  reason?: string;
  /** Non-sensitive identifier for a failed login attempt (email is an identifier, not a secret). */
  email?: string | null;
};

/** First hop of X-Forwarded-For (Railway sits behind a proxy), else socket address. */
export function clientIp(req: Pick<Request, "headers" | "ip" | "socket"> | undefined): string | null {
  if (!req) return null;
  const xff = req.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0]!.trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return String(xff[0]).split(",")[0]!.trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

export function userAgent(req: Pick<Request, "headers"> | undefined): string | null {
  const ua = req?.headers?.["user-agent"];
  return typeof ua === "string" ? ua : null;
}

/**
 * Emit an auth event. Safe to call in hot paths; only metadata is serialized.
 * Shape mirrors the app's other structured logs: `tag="[Auth]" ...`.
 */
export function logAuthEvent(fields: AuthLogFields): void {
  const record = {
    tag: "[Auth]",
    ts: new Date().toISOString(),
    event: fields.event,
    outcome: fields.outcome,
    userId: fields.userId ?? null,
    teamId: fields.teamId ?? null,
    ip: fields.ip ?? null,
    userAgent: fields.userAgent ?? null,
    ...(fields.reason ? { reason: fields.reason } : {}),
    ...(fields.email ? { email: fields.email } : {}),
  };
  // Single-line JSON for easy filtering: `grep '"tag":"[Auth]"'`.
  console.log(JSON.stringify(record));
}

/** Convenience: log an auth event pulling IP/UA straight off the request. */
export function logAuthEventFromReq(
  req: Pick<Request, "headers" | "ip" | "socket"> | undefined,
  fields: Omit<AuthLogFields, "ip" | "userAgent">,
): void {
  logAuthEvent({ ...fields, ip: clientIp(req), userAgent: userAgent(req) });
}

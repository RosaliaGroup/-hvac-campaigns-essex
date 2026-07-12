/**
 * Pure gating logic for the admin-only Marketing Publishing Canary panel.
 * Kept framework-free so it can be unit-tested without a DOM.
 */

/** The single fixed test string. The UI never lets an admin edit this. */
export const CANARY_CONTENT = "Mechanical Enterprise publishing test — safe to delete";

/** The exact confirmation the admin must acknowledge before publishing. */
export const CANARY_CONFIRM_LABEL =
  "I understand this will publish one visible test post to the selected company-owned account.";

export interface CanaryUser {
  role?: string | null;
}

export interface CanaryPlatformStatus {
  platform: string;
  connected: boolean;
}

export function isCanaryAdmin(user: CanaryUser | null | undefined): boolean {
  return Boolean(user && user.role === "admin");
}

export interface CanaryGate {
  allowed: boolean;
  reason:
    | "ok"
    | "not_admin"
    | "no_destination"
    | "not_confirmed"
    | "platform_not_connected";
  message: string;
}

/**
 * Decide whether the "Run canary" action may be enabled. All conditions must
 * hold: admin, a connected destination exists, the chosen platform is
 * connected, and the confirmation checkbox is ticked.
 */
export function canRunCanary(params: {
  user: CanaryUser | null | undefined;
  platforms: CanaryPlatformStatus[] | undefined;
  selectedPlatform: string | null;
  confirmed: boolean;
}): CanaryGate {
  const { user, platforms, selectedPlatform, confirmed } = params;
  if (!isCanaryAdmin(user)) {
    return { allowed: false, reason: "not_admin", message: "Admins only." };
  }
  const connectedList = (platforms ?? []).filter((p) => p.connected);
  if (connectedList.length === 0) {
    return {
      allowed: false,
      reason: "no_destination",
      message: "No safe connected destination is available. Canary cannot run.",
    };
  }
  if (!selectedPlatform || !connectedList.some((p) => p.platform === selectedPlatform)) {
    return {
      allowed: false,
      reason: "platform_not_connected",
      message: "Select a connected destination.",
    };
  }
  if (confirmed !== true) {
    return { allowed: false, reason: "not_confirmed", message: "Confirmation required." };
  }
  return { allowed: true, reason: "ok", message: "Ready to run canary." };
}

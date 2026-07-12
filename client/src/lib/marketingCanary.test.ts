import { describe, it, expect } from "vitest";
import {
  isCanaryAdmin,
  canRunCanary,
  CANARY_CONTENT,
  CANARY_CONFIRM_LABEL,
} from "./marketingCanary";

const admin = { role: "admin" };
const nonAdmin = { role: "member" };
const connectedFb = [{ platform: "facebook", connected: true }, { platform: "instagram", connected: false }];

describe("marketingCanary client gate", () => {
  it("isCanaryAdmin only true for admin role", () => {
    expect(isCanaryAdmin(admin)).toBe(true);
    expect(isCanaryAdmin(nonAdmin)).toBe(false);
    expect(isCanaryAdmin(null)).toBe(false);
    expect(isCanaryAdmin(undefined)).toBe(false);
  });

  it("blocks non-admins", () => {
    const g = canRunCanary({ user: nonAdmin, platforms: connectedFb, selectedPlatform: "facebook", confirmed: true });
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe("not_admin");
  });

  it("blocks when no destination is connected", () => {
    const g = canRunCanary({
      user: admin,
      platforms: [{ platform: "facebook", connected: false }],
      selectedPlatform: "facebook",
      confirmed: true,
    });
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe("no_destination");
    expect(g.message).toMatch(/No safe connected destination/);
  });

  it("blocks when the selected platform is not connected", () => {
    const g = canRunCanary({ user: admin, platforms: connectedFb, selectedPlatform: "instagram", confirmed: true });
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe("platform_not_connected");
  });

  it("requires the confirmation checkbox", () => {
    const g = canRunCanary({ user: admin, platforms: connectedFb, selectedPlatform: "facebook", confirmed: false });
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe("not_confirmed");
  });

  it("allows only when admin + connected + selected + confirmed", () => {
    const g = canRunCanary({ user: admin, platforms: connectedFb, selectedPlatform: "facebook", confirmed: true });
    expect(g.allowed).toBe(true);
    expect(g.reason).toBe("ok");
  });

  it("exposes the fixed, non-editable canary content and confirmation label", () => {
    expect(CANARY_CONTENT).toBe("Mechanical Enterprise publishing test — safe to delete");
    expect(CANARY_CONFIRM_LABEL).toMatch(/one visible test post/);
  });
});

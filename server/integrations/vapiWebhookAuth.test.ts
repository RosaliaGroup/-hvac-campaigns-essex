import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  classifyVapiWebhookAuth,
  evaluateVapiWebhookAuth,
  isVapiWebhookAuthEnforced,
} from "./vapiWebhookAuth";

const SECRET = "webhook-secret-abc-123";
const PREV_SECRET = process.env.VAPI_WEBHOOK_SECRET;
const PREV_ENFORCED = process.env.VAPI_WEBHOOK_AUTH_ENFORCED;

describe("vapiWebhookAuth — classify + evaluate (compatibility → fail-closed)", () => {
  beforeEach(() => {
    process.env.VAPI_WEBHOOK_SECRET = SECRET;
    delete process.env.VAPI_WEBHOOK_AUTH_ENFORCED;
  });
  afterEach(() => {
    if (PREV_SECRET === undefined) delete process.env.VAPI_WEBHOOK_SECRET;
    else process.env.VAPI_WEBHOOK_SECRET = PREV_SECRET;
    if (PREV_ENFORCED === undefined) delete process.env.VAPI_WEBHOOK_AUTH_ENFORCED;
    else process.env.VAPI_WEBHOOK_AUTH_ENFORCED = PREV_ENFORCED;
  });

  // --- classification ---
  it("classifies a correct Bearer token as ok", () => {
    expect(classifyVapiWebhookAuth(`Bearer ${SECRET}`)).toBe("ok");
  });
  it("classifies a wrong secret as bad_credential", () => {
    expect(classifyVapiWebhookAuth("Bearer nope-wrong")).toBe("bad_credential");
  });
  it("classifies a non-Bearer scheme as malformed", () => {
    expect(classifyVapiWebhookAuth(`Basic ${SECRET}`)).toBe("malformed");
  });
  it("classifies an absent header as missing_header", () => {
    expect(classifyVapiWebhookAuth(undefined)).toBe("missing_header");
    expect(classifyVapiWebhookAuth("")).toBe("missing_header");
  });
  it("classifies an unconfigured backend secret as not_configured", () => {
    delete process.env.VAPI_WEBHOOK_SECRET;
    expect(classifyVapiWebhookAuth(`Bearer ${SECRET}`)).toBe("not_configured");
  });

  // --- compatibility mode (enforcement disabled) ---
  it("compat: correct Bearer → allow", () => {
    expect(evaluateVapiWebhookAuth(`Bearer ${SECRET}`, false)).toMatchObject({
      outcome: "allow",
      status: "ok",
      compatibilityAccepted: false,
    });
  });
  it("compat: MISSING header → temporarily allowed (compatibility)", () => {
    expect(evaluateVapiWebhookAuth(undefined, false)).toMatchObject({
      outcome: "allow",
      status: "missing_header",
      compatibilityAccepted: true,
    });
  });
  it("compat: WRONG secret → rejected (bad creds never trusted)", () => {
    expect(evaluateVapiWebhookAuth("Bearer wrong", false)).toMatchObject({
      outcome: "reject",
      status: "bad_credential",
    });
  });
  it("compat: MALFORMED scheme → rejected", () => {
    expect(evaluateVapiWebhookAuth(`Basic ${SECRET}`, false)).toMatchObject({
      outcome: "reject",
      status: "malformed",
    });
  });
  it("compat: missing backend secret → temporarily allowed (cannot validate)", () => {
    delete process.env.VAPI_WEBHOOK_SECRET;
    expect(evaluateVapiWebhookAuth(undefined, false)).toMatchObject({
      outcome: "allow",
      status: "not_configured",
      compatibilityAccepted: true,
    });
  });

  // --- enforced mode ---
  it("enforced: correct Bearer → allow", () => {
    expect(evaluateVapiWebhookAuth(`Bearer ${SECRET}`, true)).toMatchObject({
      outcome: "allow",
      status: "ok",
    });
  });
  it("enforced: MISSING header → rejected (fail-closed)", () => {
    expect(evaluateVapiWebhookAuth(undefined, true)).toMatchObject({
      outcome: "reject",
      status: "missing_header",
    });
  });
  it("enforced: wrong secret → rejected", () => {
    expect(evaluateVapiWebhookAuth("Bearer wrong", true)).toMatchObject({
      outcome: "reject",
      status: "bad_credential",
    });
  });
  it("enforced: missing backend secret → rejected (fail-closed)", () => {
    delete process.env.VAPI_WEBHOOK_SECRET;
    expect(evaluateVapiWebhookAuth(`Bearer ${SECRET}`, true)).toMatchObject({
      outcome: "reject",
      status: "not_configured",
    });
  });

  // --- enforcement flag parsing ---
  it("reads VAPI_WEBHOOK_AUTH_ENFORCED truthy values", () => {
    for (const v of ["true", "1", "yes", "on", "TRUE"]) {
      process.env.VAPI_WEBHOOK_AUTH_ENFORCED = v;
      expect(isVapiWebhookAuthEnforced()).toBe(true);
    }
    for (const v of ["", "false", "0", "no", "off"]) {
      process.env.VAPI_WEBHOOK_AUTH_ENFORCED = v;
      expect(isVapiWebhookAuthEnforced()).toBe(false);
    }
  });

  // --- no secret leakage ---
  it("never includes the secret in the decision object", () => {
    const d = evaluateVapiWebhookAuth("Bearer wrong", false);
    expect(JSON.stringify(d)).not.toContain(SECRET);
    const d2 = evaluateVapiWebhookAuth(`Bearer ${SECRET}`, true);
    expect(JSON.stringify(d2)).not.toContain(SECRET);
  });
});

import "../testEnvSetup";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authenticateVapiToolCall } from "./vapiToolAuth";
import { handleVapiToolCalls } from "./vapiTools";

const SECRET = "test-vapi-webhook-secret-abc123";
const PREV = process.env.VAPI_WEBHOOK_SECRET;

afterEach(() => {
  if (PREV === undefined) delete process.env.VAPI_WEBHOOK_SECRET;
  else process.env.VAPI_WEBHOOK_SECRET = PREV;
});

describe("authenticateVapiToolCall — Bearer auth for the Vapi tool webhook", () => {
  it("fails closed when the backend secret is NOT configured", () => {
    delete process.env.VAPI_WEBHOOK_SECRET;
    // Even a would-be-correct token is refused when the backend has no secret.
    expect(authenticateVapiToolCall(`Bearer ${SECRET}`)).toEqual({ ok: false, reason: "not_configured" });
  });

  describe("with a configured secret", () => {
    beforeEach(() => {
      process.env.VAPI_WEBHOOK_SECRET = SECRET;
    });

    it("rejects a MISSING Authorization header", () => {
      expect(authenticateVapiToolCall(undefined)).toEqual({ ok: false, reason: "unauthorized" });
      expect(authenticateVapiToolCall("")).toEqual({ ok: false, reason: "unauthorized" });
    });

    it("rejects a MALFORMED header (no scheme / empty token / wrong scheme)", () => {
      expect(authenticateVapiToolCall(SECRET)).toEqual({ ok: false, reason: "unauthorized" }); // raw, no "Bearer"
      expect(authenticateVapiToolCall("Bearer")).toEqual({ ok: false, reason: "unauthorized" }); // no token
      expect(authenticateVapiToolCall("Bearer   ")).toEqual({ ok: false, reason: "unauthorized" }); // whitespace token
      expect(authenticateVapiToolCall(`Basic ${SECRET}`)).toEqual({ ok: false, reason: "unauthorized" }); // wrong scheme
    });

    it("rejects an INCORRECT secret (same and different length)", () => {
      expect(authenticateVapiToolCall("Bearer wrong-secret")).toEqual({ ok: false, reason: "unauthorized" });
      expect(authenticateVapiToolCall(`Bearer ${SECRET}x`)).toEqual({ ok: false, reason: "unauthorized" });
      expect(authenticateVapiToolCall(`Bearer ${SECRET.slice(0, -1)}`)).toEqual({ ok: false, reason: "unauthorized" });
    });

    it("ACCEPTS the correct Bearer secret (scheme is case-insensitive)", () => {
      expect(authenticateVapiToolCall(`Bearer ${SECRET}`)).toEqual({ ok: true });
      expect(authenticateVapiToolCall(`bearer ${SECRET}`)).toEqual({ ok: true });
    });

    it("accepts a header surfaced as string[] (repeated header)", () => {
      expect(authenticateVapiToolCall([`Bearer ${SECRET}`])).toEqual({ ok: true });
    });

    it("never includes the secret in its result", () => {
      expect(JSON.stringify(authenticateVapiToolCall("Bearer nope"))).not.toContain(SECRET);
      expect(JSON.stringify(authenticateVapiToolCall(`Bearer ${SECRET}`))).not.toContain(SECRET);
    });
  });
});

const envelope = (name: string) => ({
  message: {
    type: "tool-calls" as const,
    call: { id: "vapi_1" },
    toolCallList: [{ id: "tc_1", type: "function" as const, function: { name, arguments: "{}" } }],
  },
});

describe("handleVapiToolCalls — canonical routing & retired names (auth-independent dispatcher)", () => {
  it.each(["getCallerInfo", "sendReferralLink", "bookHVAC", "rescheduleHVAC"])(
    "routes canonical tool '%s' to a real handler (not 'Unknown tool')",
    async (tool) => {
      const out = await handleVapiToolCalls(envelope(tool));
      // Empty args → each handler returns a validation error BEFORE any I/O; the
      // point is only that the tool is wired (never the unknown-tool fallthrough).
      expect(out.results[0].result).not.toContain("Unknown tool");
    },
  );

  it.each(["bookAppointment", "rescheduleAppointment", "sendForm", "sendCallRecap"])(
    "retired / dedicated-route name '%s' is NOT reachable via the dispatcher",
    async (tool) => {
      const out = await handleVapiToolCalls(envelope(tool));
      expect(out.results[0].result).toContain(`Unknown tool: ${tool}`);
    },
  );
});

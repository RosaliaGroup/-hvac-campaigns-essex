/**
 * REST entry point for Vapi function tools: POST /api/vapi/tools
 *
 * Why this exists: `webhooks.vapiTools` is a tRPC procedure, and this app's tRPC
 * uses the superjson transformer — it expects a `{ json: … }` request body and
 * wraps the reply as `{ result: { data: { json: … } } }`. Vapi sends its plain
 * `{ message: { toolCallList } }` envelope and reads a top-level `{ results }`
 * reply, so it cannot talk to the tRPC procedure directly. This route is the thin
 * Vapi-shaped adapter over the SAME dispatcher (handleVapiToolCalls) and the SAME
 * auth (authenticateVapiToolCall: Authorization: Bearer <VAPI_WEBHOOK_SECRET>).
 *
 * Auth is checked before the body is looked at. Fail-closed:
 *   secret not configured → 503, header missing/wrong → 401.
 */
import type { Express, Request, Response } from "express";
import { authenticateVapiToolCall } from "./vapiToolAuth";
import { handleVapiToolCalls, type VapiToolCallPayload } from "./vapiTools";

/**
 * Vapi delivers `function.arguments` as an already-parsed OBJECT for server (function) tools, while the
 * dispatcher (written for the OpenAI-style string) JSON.parses it — an object makes JSON.parse throw and the
 * tool silently runs with empty args. Normalize to the JSON string the dispatcher expects.
 */
export function normalizeToolCallArguments(payload: VapiToolCallPayload): VapiToolCallPayload {
  for (const call of payload.message.toolCallList) {
    const args = (call as { function?: { arguments?: unknown } }).function?.arguments;
    if (args !== undefined && args !== null && typeof args !== "string") {
      (call.function as { arguments: unknown }).arguments = JSON.stringify(args);
    }
  }
  return payload;
}

export function registerVapiToolsRoute(app: Express): void {
  app.post("/api/vapi/tools", async (req: Request, res: Response) => {
    const auth = authenticateVapiToolCall(req.get("authorization"));
    if (!auth.ok) {
      if (auth.reason === "not_configured") {
        console.error("[VapiToolsRoute] VAPI_WEBHOOK_SECRET not configured — refusing tool call (fail-closed)");
        return res.status(503).json({ error: "Tool endpoint not configured" });
      }
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = req.body as VapiToolCallPayload | undefined;
    const list = payload?.message?.toolCallList;
    if (!Array.isArray(list) || list.length === 0) {
      return res.status(400).json({ error: "Expected message.toolCallList" });
    }

    try {
      const result = await handleVapiToolCalls(normalizeToolCallArguments(payload as VapiToolCallPayload));
      return res.status(200).json(result);
    } catch (err) {
      console.error("[VapiToolsRoute] dispatcher failed:", err instanceof Error ? err.message : "unknown error");
      return res.status(500).json({ error: "Tool dispatch failed" });
    }
  });
}

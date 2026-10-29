export class ProfileProviderError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string
  ) {
    super(`Public profile lookup failed (${status}); ${reason}.`);
    this.name = "ProfileProviderError";
  }
}
// Return only fixed categories; never expose provider text or request identifiers.
export function profileProviderReason(body: unknown): string {
  const error = (body as any)?.error;
  const message = typeof error?.message === "string" ? error.message : "";
  if (
    /credit balance|out of credits|insufficient.*credit|billing/i.test(message)
  )
    return "billing_required";
  if (/model.*(not found|invalid|unsupported|does not exist)/i.test(message))
    return "model_unavailable";
  if (error?.type === "authentication_error") return "authentication_failed";
  if (error?.type === "rate_limit_error") return "rate_limited";
  return "provider_request_failed";
}

/** Anthropic's server-side search keeps arbitrary public URL fetching out of our backend. */
export async function anthropicSearch(
  query: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
  /** Per-call budget. Defaults keep single-contact profile lookups small and cheap. */
  opts: { maxSearches?: number; maxTokens?: number; model?: string } = {}
): Promise<{ text: string; citations: string[] }> {
  const model = opts.model?.trim() || env.CRM_PROFILE_MODEL?.trim() || "claude-haiku-4-5";
  const messages: any[] = [{ role: "user", content: query }];
  const citations = new Set<string>();
  // Text blocks are fragments of ONE answer, split wherever a citation starts or ends
  // (often inside a JSON string). Join them as-is: inserting a separator corrupts the JSON.
  let text = "";
  for (let turn = 0; turn < 2; turn++) {
    let turnText = "";
    const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 3000,
        tools: [
          { type: "web_search_20250305", name: "web_search", max_uses: opts.maxSearches ?? 2 },
        ],
        messages,
      }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      throw new ProfileProviderError(
        response.status,
        profileProviderReason(failure)
      );
    }
    const body = await response.json();
    console.info("[CRM Profile Usage]", {model,
      inputTokens: Number(body.usage?.input_tokens ?? 0), outputTokens: Number(body.usage?.output_tokens ?? 0),
      webSearches: Number(body.usage?.server_tool_use?.web_search_requests ?? 0)});
    for (const block of Array.isArray(body.content) ? body.content : []) {
      if (block.type === "text") {
        turnText += block.text || "";
        for (const citation of block.citations || [])
          if (typeof citation.url === "string") citations.add(citation.url);
      }
      if (block.type === "web_search_tool_result") {
        if (!Array.isArray(block.content))
          throw new Error(
            "Public profile search is unavailable. Try again later."
          );
        for (const result of block.content)
          if (
            result.type === "web_search_result" &&
            typeof result.url === "string"
          )
            citations.add(result.url);
      }
    }
    // A continuation turn restates the answer; prefer the latest turn that holds an object.
    if (turnText.includes("{") || !text) text = turnText;
    if (body.stop_reason === "end_turn")
      return { text, citations: Array.from(citations) };
    if (body.stop_reason !== "pause_turn")
      throw new Error("Profile lookup did not finish. Try again later.");
    messages.push({ role: "assistant", content: body.content });
    messages.push({
      role: "user",
      content:
        "Finish the requested JSON using only the verified search results already found.",
    });
  }
  throw new Error(
    "Profile lookup timed out before finishing. Try again later."
  );
}

/**
 * Extract the JSON object from a model reply: strips code fences, takes the outermost
 * braces, and on failure retries with control characters (raw line breaks or tabs that
 * would be invalid inside JSON strings) replaced by spaces. Returns null when unparseable.
 */
export function parseJsonObject(reply: string): any | null {
  const text = reply.replace(/```(?:json)?/g, "").trim();
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try { return JSON.parse(slice); } catch { /* fall through */ }
  try { return JSON.parse(slice.replace(/[\u0000-\u001f]+/g, " ")); } catch { return null; }
}

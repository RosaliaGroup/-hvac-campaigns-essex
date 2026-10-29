export class ProfileProviderError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string
  ) {
    super(`Public profile lookup failed (${status}); ${reason}.`);
    this.name = "ProfileProviderError";
  }
}
/** A lookup that reached the provider but produced no usable answer; `category` is safe to log. */
export class ProfileLookupError extends Error {
  constructor(public readonly category: "search_error" | "truncated" | "not_finished" | "unreadable" | "timed_out", message: string) {
    super(message);
    this.name = "ProfileLookupError";
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
  let searchErrors = 0, searchResults = 0, askedForJson = false;
  for (let turn = 0; turn < 3; turn++) {
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
        // An error result (e.g. max_uses_exceeded when the model asks for one search too
        // many) is normal: keep the results already found instead of discarding the lookup.
        if (!Array.isArray(block.content)) { searchErrors++; continue; }
        searchResults++;
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
    // Every search failed and nothing was found: that is an outage, not "no match".
    const searchFailed = () => searchErrors > 0 && searchResults === 0 && citations.size === 0;
    if (body.stop_reason === "end_turn") {
      if (searchFailed() && !parseJsonObject(text))
        throw new ProfileLookupError("search_error", "Public profile search is unavailable. Try again later.");
      // A prose answer with no JSON: ask once, in the same conversation, for the JSON only.
      if (!parseJsonObject(text) && !askedForJson && turn < 2) {
        askedForJson = true;
        messages.push({ role: "assistant", content: body.content });
        messages.push({ role: "user", content: "Reply with ONLY the JSON object requested, using the results you already found. If nothing was found, return the JSON with empty fields." });
        continue;
      }
      return { text, citations: Array.from(citations) };
    }
    if (body.stop_reason === "max_tokens") {
      // Use a cut-off reply only if it still holds a complete object.
      if (parseJsonObject(text)) return { text, citations: Array.from(citations) };
      throw new ProfileLookupError("truncated", "Profile lookup reply was cut off. Try again later.");
    }
    if (body.stop_reason !== "pause_turn")
      throw new ProfileLookupError(searchErrors && !searchResults ? "search_error" : "not_finished",
        "Profile lookup did not finish. Try again later.");
    // pause_turn: send the paused turn back unchanged and the provider resumes it.
    messages.push({ role: "assistant", content: body.content });
  }
  throw new ProfileLookupError("timed_out", "Profile lookup timed out before finishing. Try again later.");
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

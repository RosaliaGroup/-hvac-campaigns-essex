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
  fetchImpl: typeof fetch = fetch
): Promise<{ text: string; citations: string[] }> {
  const messages: any[] = [{ role: "user", content: query }];
  const citations = new Set<string>();
  let text = "";
  for (let turn = 0; turn < 2; turn++) {
    const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model: env.CRM_PROFILE_MODEL?.trim() || "claude-sonnet-5",
        max_tokens: 3000,
        tools: [
          { type: "web_search_20250305", name: "web_search", max_uses: 3 },
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
    for (const block of Array.isArray(body.content) ? body.content : []) {
      if (block.type === "text") {
        text += (text ? "\n" : "") + (block.text || "");
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

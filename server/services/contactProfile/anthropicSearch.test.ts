import { expect, it, vi } from "vitest";
import { anthropicSearch } from "./anthropicSearch";
const json = (body: unknown) => new Response(JSON.stringify(body));
it("collects actual search result URLs and preserves citation URLs", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    json({
      stop_reason: "end_turn",
      content: [
        {
          type: "web_search_tool_result",
          content: [{ type: "web_search_result", url: "https://example.com" }],
        },
        {
          type: "text",
          text: "{}",
          citations: [{ url: "https://example.com/about" }],
        },
      ],
    })
  );
  const result = await anthropicSearch(
    "sample",
    { ANTHROPIC_API_KEY: "sample" },
    fetcher
  );
  expect(result).toEqual({
    text: "{}",
    citations: ["https://example.com", "https://example.com/about"],
  });
  const request = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(request.tools[0].max_uses).toBe(3);
  expect(request.messages[0].content).toBe("sample");
});
it("continues a paused search with unmodified content blocks", async () => {
  const content = [
    {
      type: "web_search_tool_result",
      content: [
        {
          type: "web_search_result",
          url: "https://example.com",
          encrypted_content: "opaque",
        },
      ],
    },
  ];
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json({ stop_reason: "pause_turn", content }))
    .mockResolvedValueOnce(
      json({ stop_reason: "end_turn", content: [{ type: "text", text: "{}" }] })
    );
  await anthropicSearch("sample", { ANTHROPIC_API_KEY: "sample" }, fetcher);
  expect(JSON.parse(fetcher.mock.calls[1][1].body).messages[1].content).toEqual(
    content
  );
});
it("reports a search tool error instead of claiming no matching person exists", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    json({
      stop_reason: "end_turn",
      content: [
        {
          type: "web_search_tool_result",
          content: {
            type: "web_search_tool_result_error",
            error_code: "unavailable",
          },
        },
      ],
    })
  );
  await expect(
    anthropicSearch("sample", { ANTHROPIC_API_KEY: "sample" }, fetcher)
  ).rejects.toThrow("unavailable");
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { extractBodyText, fetchBodyExcerpt } from "./pageBody";

describe("extractBodyText", () => {
  it("strips tags and collapses whitespace", () => {
    const html = "<html><body><h1>Newark  HVAC</h1><p>We install   heat pumps.</p></body></html>";
    expect(extractBodyText(html)).toBe("Newark HVAC We install heat pumps.");
  });

  it("strips script/style/nav/header/footer blocks entirely, including their text", () => {
    const html = `
      <header><nav>Home | Services | Contact</nav></header>
      <script>console.log("tracking");</script>
      <style>.hero { color: red; }</style>
      <main><p>Licensed HVAC installation in Newark, NJ.</p></main>
      <footer>Copyright 2026</footer>
    `;
    const text = extractBodyText(html);
    expect(text).toBe("Licensed HVAC installation in Newark, NJ.");
  });

  it("strips HTML comments", () => {
    const html = "<p>Visible text</p><!-- internal note, never surface this -->";
    expect(extractBodyText(html)).toBe("Visible text");
  });

  it("decodes common HTML entities", () => {
    const html = "<p>AC &amp; heating &mdash; call &quot;us&quot; &#39;today&#39;</p>";
    expect(extractBodyText(html)).toContain("AC & heating");
    expect(extractBodyText(html)).toContain('"us"');
    expect(extractBodyText(html)).toContain("'today'");
  });

  it("truncates to maxWords", () => {
    const html = `<p>${Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ")}</p>`;
    const text = extractBodyText(html, 5);
    expect(text.split(" ")).toHaveLength(5);
    expect(text).toBe("word0 word1 word2 word3 word4");
  });

  it("returns an empty string for empty/whitespace-only HTML", () => {
    expect(extractBodyText("")).toBe("");
    expect(extractBodyText("<script>only script</script>")).toBe("");
  });
});

describe("fetchBodyExcerpt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the extracted body text on a successful fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html><body><p>Newark HVAC installation.</p></body></html>", { status: 200 })),
    );
    const text = await fetchBodyExcerpt("https://mechanicalenterprise.com/hvac-newark-nj");
    expect(text).toBe("Newark HVAC installation.");
  });

  it("returns an empty string (never throws) on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    await expect(fetchBodyExcerpt("https://mechanicalenterprise.com/missing")).resolves.toBe("");
  });

  it("returns an empty string (never throws) on a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNRESET");
      }),
    );
    await expect(fetchBodyExcerpt("https://mechanicalenterprise.com/hvac-newark-nj")).resolves.toBe("");
  });
});

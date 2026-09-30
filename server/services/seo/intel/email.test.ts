import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../emailService", () => ({ sendEmail: vi.fn(async () => true) }));
import { sendEmail } from "../../emailService";
import { sendCrawlCheckAlert } from "./email";

const result = (anomalies: Array<{ url: string; kind: any; detail: string }>) => ({ checkedAt: "2026-10-01T10:00:00Z", checked: 41, anomalies });
const oneIssue = [{ url: "https://x.test/p", kind: "unexpected_redirect" as const, detail: "301 → https://x.test/other" }];

beforeEach(() => {
  vi.mocked(sendEmail).mockClear();
  process.env.SEO_ALERT_EMAIL = "ana@example.com";
});

describe("sendCrawlCheckAlert", () => {
  it("sends one email naming the issue count and each anomaly", async () => {
    expect(await sendCrawlCheckAlert({ reportId: 7, date: "2026-10-01", result: result(oneIssue) })).toBe(true);
    const arg = vi.mocked(sendEmail).mock.calls[0][0] as { subject: string; html: string; to: string };
    expect(arg.to).toBe("ana@example.com");
    expect(arg.subject).toBe("Crawl check — 1 issue — 2026-10-01");
    expect(arg.html).toContain("unexpected_redirect");
    expect(arg.html).toContain("across 41 URLs");
    expect(arg.html).toContain("market-intel?report=7");
  });
  it("sends nothing when there are no anomalies, or no alert address is configured", async () => {
    expect(await sendCrawlCheckAlert({ reportId: 7, date: "2026-10-01", result: result([]) })).toBe(false);
    delete process.env.SEO_ALERT_EMAIL;
    expect(await sendCrawlCheckAlert({ reportId: 7, date: "2026-10-01", result: result(oneIssue) })).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it("escapes HTML from fetched pages (titles/locations are untrusted)", async () => {
    await sendCrawlCheckAlert({ reportId: 1, date: "2026-10-01", result: result([{ url: "https://x.test/p", kind: "bot_diverges", detail: 'Googlebot: 200 "<script>alert(1)</script>"' }]) });
    const html = (vi.mocked(sendEmail).mock.calls[0][0] as { html: string }).html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("caps the listed anomalies at 30 and says how many more there are", async () => {
    const many = Array.from({ length: 35 }, (_, i) => ({ url: `https://x.test/p${i}`, kind: "http_error" as const, detail: "HTTP 503" }));
    await sendCrawlCheckAlert({ reportId: 1, date: "2026-10-01", result: result(many) });
    const html = (vi.mocked(sendEmail).mock.calls[0][0] as { html: string }).html;
    expect(html.match(/<li>/g)).toHaveLength(30);
    expect(html).toContain("and 5 more");
  });
});

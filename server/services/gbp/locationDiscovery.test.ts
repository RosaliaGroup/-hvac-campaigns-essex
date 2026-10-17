import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../integrations/gbp", () => ({ getGbpAccessToken: vi.fn(async () => "token-a") }));
vi.mock("../../integrations/gbpHttp", () => ({
  getGbpJson: vi.fn(),
  GbpHttpError: class extends Error {
    constructor(public status: number, public reason: string, public retryAfterSeconds?: number) { super(reason); }
  },
}));

beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });
async function setup() {
  const http = await import("../../integrations/gbpHttp");
  const oauth = await import("../../integrations/gbp");
  vi.mocked(oauth.getGbpAccessToken).mockResolvedValue("token-a");
  const discovery = await import("./locationDiscovery");
  return { ...http, ...oauth, ...discovery };
}

describe("GBP location discovery", () => {
  it("coalesces concurrent requests and caches successful discovery", async () => {
    const { getGbpJson, discoverGbpLocations } = await setup();
    vi.mocked(getGbpJson).mockResolvedValueOnce({ accounts: [{ name: "accounts/1", accountName: "Business" }] })
      .mockResolvedValueOnce({ locations: [{ name: "locations/2", title: "Mechanical Enterprise" }] });
    const [a, b] = await Promise.all([discoverGbpLocations(), discoverGbpLocations()]);
    expect(a).toEqual(b);
    expect(a).toEqual({ ok: true, locations: [{ accountId: "1", locationId: "2", title: "Mechanical Enterprise", accountName: "Business" }] });
    await expect(discoverGbpLocations()).resolves.toEqual(a);
    expect(getGbpJson).toHaveBeenCalledTimes(2);
  });

  it("does not reuse another Google grant's cached result", async () => {
    const { getGbpJson, getGbpAccessToken, discoverGbpLocations } = await setup();
    vi.mocked(getGbpJson).mockResolvedValue({ accounts: [] });
    await discoverGbpLocations();
    vi.mocked(getGbpAccessToken).mockResolvedValue("token-b");
    await discoverGbpLocations();
    expect(getGbpJson).toHaveBeenCalledTimes(2);
  });

  it("paginates accounts and locations", async () => {
    const { getGbpJson, discoverGbpLocations } = await setup();
    vi.mocked(getGbpJson)
      .mockResolvedValueOnce({ accounts: [{ name: "accounts/1" }], nextPageToken: "account-next" })
      .mockResolvedValueOnce({ accounts: [{ name: "accounts/3" }] })
      .mockResolvedValueOnce({ locations: [{ name: "locations/2" }], nextPageToken: "location-next" })
      .mockResolvedValueOnce({ locations: [{ name: "locations/4" }] })
      .mockResolvedValueOnce({ locations: [{ name: "locations/5" }] });
    const result = await discoverGbpLocations();
    expect(result.ok && result.locations.map(row => row.locationId)).toEqual(["2", "4", "5"]);
    expect(getGbpJson).toHaveBeenNthCalledWith(2, expect.stringContaining("pageToken=account-next"), "token-a");
    expect(getGbpJson).toHaveBeenNthCalledWith(4, expect.stringContaining("pageToken=location-next"), "token-a");
  });

  it("returns rate-limit details from the location service and can recover", async () => {
    const { getGbpJson, GbpHttpError, discoverGbpLocations } = await setup();
    vi.mocked(getGbpJson).mockResolvedValueOnce({ accounts: [{ name: "accounts/1" }] })
      .mockRejectedValueOnce(new GbpHttpError(429, "RATE_LIMIT_EXCEEDED", 120));
    await expect(discoverGbpLocations()).resolves.toEqual({ ok: false, status: 429, stage: "locations", reason: "RATE_LIMIT_EXCEEDED", retryAfterSeconds: 120 });
    vi.mocked(getGbpJson).mockResolvedValue({ accounts: [] });
    await expect(discoverGbpLocations()).resolves.toEqual({ ok: true, locations: [] });
  });
});

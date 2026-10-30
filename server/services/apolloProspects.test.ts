import { describe, expect, it, vi } from "vitest";
import { apolloQuery, apolloToProspect, createApolloClient, findApolloProspects, APOLLO_LOCATIONS, type ApolloStore } from "./apolloProspects";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const verified = (over: any = {}) => ({
  id: "p1", first_name: "Jane", last_name: "Smith", title: "Property Manager", email: "jsmith@acmeproperties.com",
  email_status: "verified", linkedin_url: "https://www.linkedin.com/in/janesmith", city: "Newark", state: "New Jersey",
  organization: { name: "Acme Properties LLC", primary_domain: "acmeproperties.com", phone: "+1 973-555-0100" }, ...over,
});
function memStore(limit = 100): ApolloStore & { seen: Set<string>; reveals: number } {
  const seen = new Set<string>();
  const st = { seen, reveals: 0,
    claimPerson: async (id: string) => (seen.has(id) ? false : (seen.add(id), true)),
    markPerson: async () => undefined,
    reserveReveal: async () => (st.reveals++ < limit) };
  return st;
}

describe("Apollo client", () => {
  it("searches free with titles, locations and verified-email filter; reveals work email only", async () => {
    const urls: string[] = []; const headers: any[] = [];
    const fetchImpl = vi.fn(async (url: string, init: any) => { urls.push(url); headers.push(init.headers); return json({ people: [], person: null }); });
    const c = createApolloClient("key123", fetchImpl as any);
    await c.search(["property manager"], ["Newark, New Jersey"], 2);
    await c.reveal("abc");
    const search = decodeURIComponent(urls[0]);
    expect(urls[0]).toContain("https://api.apollo.io/api/v1/mixed_people/api_search?");
    expect(search).toContain("person_titles[]=property manager".replace(/ /g, "+"));
    expect(search).toContain("contact_email_status[]=verified");
    expect(search).toContain("page=2");
    expect(urls[1]).toContain("/people/match?id=abc&reveal_personal_emails=false&reveal_phone_number=false");
    expect(headers[0]["x-api-key"]).toBe("key123");
  });
  it("reports a rejected key clearly", async () => {
    const c = createApolloClient("bad", vi.fn(async () => json({}, 403)) as any);
    await expect(c.search(["x"], ["y"], 1)).rejects.toMatchObject({ name: "ApolloError", status: 403 });
  });
});

describe("Apollo results become prospects only when safe", () => {
  it("accepts a verified private-sector work email, with source, evidence and office phone", () => {
    const r = apolloToProspect(verified());
    expect(r.prospect).toMatchObject({ name: "Jane Smith", company: "Acme Properties LLC", email: "jsmith@acmeproperties.com", phone: "(973) 555-0100" });
    expect(r.prospect!.verificationUrl).toBe("https://www.linkedin.com/in/janesmith");
  });
  it.each([
    [{ email_status: "extrapolated" }, "email not verified by Apollo"],
    [{ email: "info@acmeproperties.com" }, "no direct business email"],
    [{ email: "jsmith@townofx.nj.us", organization: { name: "Township of X" } }, "public body or school"],
    [{ organization: { name: "Giga Holdings" }, email: "j@gigaholdings.com" }, "excluded"],
    [{ last_name: "", name: "" }, "incomplete identity"],
  ])("rejects %j", (over, reason) => {
    expect(apolloToProspect(verified(over)).reason).toBe(reason);
  });
});

describe("finding prospects", () => {
  it("skips public bodies and known companies before spending credits, and never reveals a person twice", async () => {
    const client = {
      search: vi.fn(async () => [
        { id: "a", organization: { name: "Newark Board of Education" } },
        { id: "b", organization: { name: "Known Co" } },
        { id: "c", organization: { name: "Acme Properties LLC" } },
        { id: "c", organization: { name: "Acme Properties LLC" } },
      ]),
      reveal: vi.fn(async () => verified({ id: "c" })),
    };
    const store = memStore();
    const accepted: any[] = [];
    const r = await findApolloProspects({ client: client as any, store, now: new Date("2026-10-30T14:00:00Z"), needed: 5, maxSearches: 1,
      knownCompanies: new Set(["known"]), accept: async p => (accepted.push(p), true) });
    expect(client.reveal).toHaveBeenCalledTimes(1);
    expect(r.added).toBe(1);
    expect(r.rejected).toMatchObject({ "public body or school": 1, "company already in outreach": 2 }); // known co + same company again
    expect(accepted[0].email).toBe("jsmith@acmeproperties.com");
  });
  it("stops at the daily credit cap", async () => {
    const client = { search: vi.fn(async () => Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, organization: { name: `Co ${i}` } }))),
      reveal: vi.fn(async (id: string) => verified({ id, email: `${id}@co${id}.com`, organization: { name: `Co ${id}` } })) };
    const r = await findApolloProspects({ client: client as any, store: memStore(3), now: new Date("2026-10-30T14:00:00Z"), needed: 10, maxSearches: 2,
      knownCompanies: new Set(), accept: async () => true });
    expect(client.reveal).toHaveBeenCalledTimes(3);
    expect(r.capped).toBe(true);
  });
  it("one person per company per run", async () => {
    const client = { search: vi.fn(async () => [{ id: "x1", organization: { name: "Acme" } }, { id: "x2", organization: { name: "Acme" } }]),
      reveal: vi.fn(async (id: string) => verified({ id, email: `${id}@acme.com`, organization: { name: "Acme" } })) };
    const r = await findApolloProspects({ client: client as any, store: memStore(), now: new Date("2026-10-30T14:00:00Z"), needed: 5, maxSearches: 1,
      knownCompanies: new Set(), accept: async () => true });
    expect(r.added).toBe(1);
    expect(client.reveal).toHaveBeenCalledTimes(1);
  });
});

describe("query rotation", () => {
  it("varies segment and cities by hour and attempt, always North Jersey", () => {
    const a = apolloQuery(new Date("2026-10-30T14:00:00Z"), 0), b = apolloQuery(new Date("2026-10-30T14:00:00Z"), 1);
    expect(a.segment.label).not.toBe(b.segment.label);
    expect(a.locations).not.toEqual(b.locations);
    for (const l of [...a.locations, ...b.locations]) expect(APOLLO_LOCATIONS).toContain(l);
  });
});

describe("Apollo error detail", () => {
  it("logs the HTTP status, endpoint and Apollo's own reason", async () => {
    const c = createApolloClient("k", vi.fn(async () => new Response('{"error":"api/v1/mixed_people/api_search is not accessible with this api_key on a free plan"}', { status: 403 })) as any);
    await expect(c.search(["x"], ["y"], 1)).rejects.toThrow(/HTTP 403, mixed_people\/api_search\).*free plan/);
  });
});

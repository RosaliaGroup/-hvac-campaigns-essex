import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  research: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("../../db", () => ({ getDb: mocks.db }));
vi.mock("./research", () => ({ researchContact: mocks.research }));
vi.mock("../crmCommunications", () => ({
  upsertExternalContact: mocks.upsert,
}));
import { contactProfile } from "./store";
const contact = {
  id: 10,
  name: "Sample Person",
  email: "sample@example.com",
  company: "Example",
};
const profile = {
  company: {},
  social: [],
  checkedAt: new Date().toISOString(),
  status: "not_found",
};
let chain: any;
beforeEach(() => {
  chain = {
    execute: vi.fn().mockResolvedValue([]),
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: vi.fn(),
    insert: () => chain,
    values: vi.fn(() => chain),
    onDuplicateKeyUpdate: vi.fn().mockResolvedValue({}),
  };
  mocks.db.mockResolvedValue(chain);
  mocks.research.mockReset().mockResolvedValue(profile);
  mocks.upsert.mockReset();
});
it("reads a saved profile without starting research or editing the CRM contact", async () => {
  chain.limit
    .mockResolvedValueOnce([contact])
    .mockResolvedValueOnce([
      {
        identity: JSON.stringify({
          name: contact.name,
          email: contact.email,
          company: contact.company,
        }),
        profile,
      },
    ]);
  expect(await contactProfile({ contactId: 10 })).toEqual(profile);
  expect(mocks.research).not.toHaveBeenCalled();
  expect(mocks.upsert).not.toHaveBeenCalled();
});
it("does not reuse a profile belonging to an old contact identity", async () => {
  chain.limit
    .mockResolvedValueOnce([contact])
    .mockResolvedValueOnce([{ identity: "old identity", profile }]);
  expect(await contactProfile({ contactId: 10 })).toBeNull();
});
it("reuses a recent cached result instead of paying for another lookup", async () => {
  chain.limit
    .mockResolvedValueOnce([contact])
    .mockResolvedValueOnce([
      {
        identity: JSON.stringify({
          name: contact.name,
          email: contact.email,
          company: contact.company,
        }),
        profile,
      },
    ]);
  expect(await contactProfile({ contactId: 10 }, true)).toEqual(profile);
  expect(mocks.research).not.toHaveBeenCalled();
});
it("persists research under the contact ID without overwriting contact fields", async () => {
  chain.limit.mockResolvedValueOnce([contact]).mockResolvedValueOnce([]);
  expect(await contactProfile({ contactId: 10 }, true)).toEqual(profile);
  expect(chain.values).toHaveBeenCalledWith(
    expect.objectContaining({ contactId: 10, profile })
  );
  expect(mocks.upsert).not.toHaveBeenCalled();
});

it("requests a new lookup when a saved profile is more than a day old", async () => {
  chain.limit
    .mockResolvedValueOnce([contact])
    .mockResolvedValueOnce([
      {
        identity: JSON.stringify({
          name: contact.name,
          email: contact.email,
          company: contact.company,
        }),
        profile: { ...profile, checkedAt: "2020-01-01T00:00:00.000Z" },
      },
    ]);
  expect(await contactProfile({ contactId: 10 })).toBeNull();
});

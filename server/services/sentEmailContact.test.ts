import { describe, it, expect, vi } from "vitest";
import { ensureSentEmailContact } from "./sentEmailContact";
function database(existing: unknown[]) {
  const tx: any = {
    select: vi.fn(() => tx),
    from: vi.fn(() => tx),
    where: vi.fn(() => tx),
    limit: vi.fn(async () => existing),
    insert: vi.fn(() => tx),
    values: vi.fn(async () => [{ insertId: 12 }]),
    update: vi.fn(() => tx),
    set: vi.fn(() => tx),
  };
  return { tx, db: { transaction: async (fn: any) => fn(tx) } as any };
}
describe("Sent email CRM contacts", () => {
  it("reuses existing CRM contacts without overwriting their details", async () => {
    const { tx, db } = database([{ id: 4 }]);
    expect(
      await ensureSentEmailContact(db, {
        id: 7,
        email: "a@example.com",
        name: "A",
      })
    ).toBe(4);
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.set).toHaveBeenCalledWith({ customerId: 4 });
  });
  it("creates a main CRM contact and links the communication contact", async () => {
    const { tx, db } = database([]);
    expect(
      await ensureSentEmailContact(db, {
        id: 7,
        email: " A@Example.com ",
        name: "Ana",
        phone: "2015550123",
      })
    ).toBe(12);
    expect(tx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Ana",
        email: "a@example.com",
        phone: "2015550123",
        source: "Gmail Sent",
      })
    );
    expect(tx.set).toHaveBeenCalledWith({ customerId: 12 });
  });
});

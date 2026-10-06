import { describe, expect, it } from "vitest";
import { upsertExternalContact, logCommunication } from "./crmCommunications";
function fake(rows: any[][] = [], insertError?: unknown) {
  const updates: any[] = [],
    inserts: any[] = [];
  const select = {
    from: () => select,
    where: () => select,
    limit: async () => rows.shift() ?? [],
  };
  return {
    updates,
    inserts,
    select: () => select,
    update: () => ({
      set: (v: any) => ({
        where: async () => {
          updates.push(v);
        },
      }),
    }),
    insert: () => ({
      values: async (v: any) => {
        if (insertError) throw insertError;
        inserts.push(v);
        return [{ insertId: 9 }];
      },
    }),
  } as any;
}
describe("CRM communications preservation", () => {
  it("does not select an arbitrary contact when no identity is supplied", async () => {
    const db = fake([[{ id: 1, name: "Someone else" }]]);
    expect(
      await upsertExternalContact(db, { name: "New person" })
    ).toMatchObject({ id: 9 });
    expect(db.updates).toHaveLength(0);
  });
  it("preserves enriched names, phone numbers and existing customer linkage", async () => {
    const db = fake([
      [
        {
          id: 1,
          name: "Grace Aquino",
          email: "grace@example.com",
          phone: "+19735555555",
          customerId: 3,
        },
      ],
    ]);
    const contact = await upsertExternalContact(db, {
      name: "grace@example.com",
      email: " GRACE@example.com ",
      phone: null,
      customerId: null,
    });
    expect(contact).toMatchObject({
      id: 1,
      name: "Grace Aquino",
      phone: "+19735555555",
      customerId: 3,
    });
    expect(db.updates[0]).not.toHaveProperty("phone");
  });
  it("treats concurrent provider-ID insert conflicts as duplicate delivery", async () => {
    const db = fake([[], [{ id: 5 }]], { cause: { code: "ER_DUP_ENTRY" } });
    expect(
      await logCommunication(db, {
        channel: "email",
        direction: "inbound",
        provider: "gmail",
        providerMessageId: "id1",
      })
    ).toEqual({ id: 5, duplicate: true });
  });
  it("propagates database failures instead of reporting success", async () => {
    const db = fake([[]], new Error("DB unavailable"));
    await expect(
      logCommunication(db, {
        channel: "sms",
        direction: "inbound",
        provider: "telnyx",
        providerMessageId: "id1",
      })
    ).rejects.toThrow("DB unavailable");
  });
});

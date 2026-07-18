/**
 * Conversation → CRM resolution tests.
 *
 * Locks in the smart-matching rules:
 *   - zero matches → "unlinked"
 *   - exactly one match → "single" (auto-DISPLAYED, resolves the customer)
 *   - multiple matches → "ambiguous" (candidates only, NEVER auto-resolved)
 *   - a confirmed link wins and is used verbatim ("linked")
 *
 * Uses a table-aware fake db (keyed by drizzle table name) so the concurrent
 * query fan-out in resolveConversationContext is order-independent.
 */
import "../testEnvSetup"; // MUST be first
import { describe, it, expect } from "vitest";
import { getTableName } from "drizzle-orm";
import { resolveConversationContext } from "./conversationCrm";

function makeDb(data: Record<string, unknown[]>) {
  const rows = (t: unknown) => Promise.resolve(data[getTableName(t as never)] ?? []);
  const db = {
    select() {
      let tbl: unknown;
      const chain = {
        from: (t: unknown) => { tbl = t; return chain; },
        where: () => chain,
        orderBy: () => chain,
        limit: () => rows(tbl),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => rows(tbl).then(res, rej),
      };
      return chain;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db as any;
}

const PHONE = "+17189383793";

describe("resolveConversationContext", () => {
  it("is 'unlinked' when nothing matches", async () => {
    const ctx = await resolveConversationContext(makeDb({}), PHONE);
    expect(ctx.status).toBe("unlinked");
    expect(ctx.customer).toBeNull();
    expect(ctx.phoneLast10).toBe("7189383793");
  });

  it("is 'single' and resolves the customer + property for one match", async () => {
    const db = makeDb({
      customers: [{ id: 5, name: "Jane Doe", phone: PHONE, type: "residential", status: "active" }],
      properties: [{ id: 9, addressLine1: "1 Main St", addressLine2: null, city: "Newark", state: "NJ", zip: "07102", label: "Home", isPrimary: 1 }],
    });
    const ctx = await resolveConversationContext(db, PHONE);
    expect(ctx.status).toBe("single");
    expect(ctx.customer?.id).toBe(5);
    expect(ctx.selectedProperty?.address).toContain("1 Main St");
    expect(ctx.job).toBeNull(); // no job rows → Not linked
  });

  it("is 'ambiguous' with candidates and NO auto-resolved customer when multiple match", async () => {
    const db = makeDb({ customers: [{ id: 5, name: "A" }, { id: 6, name: "B" }] });
    const ctx = await resolveConversationContext(db, PHONE);
    expect(ctx.status).toBe("ambiguous");
    expect(ctx.customer).toBeNull();          // never auto-linked
    expect(ctx.candidates.customers).toHaveLength(2);
  });

  it("uses a confirmed link verbatim ('linked'), ignoring other candidates", async () => {
    const db = makeDb({
      smsConversationLinks: [{ customerId: 5, leadId: null, leadCaptureId: null, propertyId: null }],
      customers: [{ id: 5, name: "Linked Co", phone: PHONE, type: "commercial", status: "active" }, { id: 6, name: "Other" }],
    });
    const ctx = await resolveConversationContext(db, PHONE);
    expect(ctx.status).toBe("linked");
    expect(ctx.customer?.id).toBe(5);
  });

  it("matches a lead by phone (leads use contact + contactType)", async () => {
    const db = makeDb({ leads: [{ id: 3, name: "Lead Guy", contact: PHONE, status: "new" }] });
    const ctx = await resolveConversationContext(db, PHONE);
    expect(ctx.status).toBe("single");
    expect(ctx.lead?.id).toBe(3);
    expect(ctx.customer).toBeNull();
  });

  it("flags a stale link when the confirmed customer no longer exists", async () => {
    // link points at customer 5, but no customer row is returned (deleted).
    const db = makeDb({ smsConversationLinks: [{ customerId: 5, leadId: null, leadCaptureId: null, propertyId: null }] });
    const ctx = await resolveConversationContext(db, PHONE);
    expect(ctx.staleLink).toBe(true);
    expect(ctx.status).toBe("unlinked");
    expect(ctx.customer).toBeNull(); // no stale data shown
  });

  it("surfaces the newest OPEN estimate + a count for '+N more'", async () => {
    const db = makeDb({
      customers: [{ id: 5, name: "Jane", phone: PHONE, type: "residential", status: "active" }],
      // keys match the SELECT projection (totalAmount is aliased to `amount`)
      quickbooksSalesDocuments: [
        { id: 11, status: "pending", amount: "500.00" },
        { id: 12, status: "accepted", amount: "300.00" },
      ],
    });
    const ctx = await resolveConversationContext(db, PHONE);
    expect(ctx.estimate?.amount).toBe("500.00");
    expect(ctx.estimatesOpenCount).toBe(2); // "+1 more"
  });
});

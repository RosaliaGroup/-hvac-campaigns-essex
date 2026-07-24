import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import { decidePropertyLink } from "./appointmentNormalization";

describe("decidePropertyLink — ownership, dedupe, idempotency", () => {
  it("links an existing property that belongs to the resolved customer", () => {
    const d = decidePropertyLink({
      resolvedCustomerId: 7,
      mode: "existing",
      existingProperty: { id: 42, customerId: 7 },
    });
    expect(d).toEqual({ action: "link", propertyId: 42 });
  });

  it("rejects linking a property owned by a different customer (no cross-customer link)", () => {
    expect(() =>
      decidePropertyLink({
        resolvedCustomerId: 7,
        mode: "existing",
        existingProperty: { id: 42, customerId: 99 },
      }),
    ).toThrow(TRPCError);
    try {
      decidePropertyLink({ resolvedCustomerId: 7, mode: "existing", existingProperty: { id: 42, customerId: 99 } });
    } catch (e) {
      expect((e as TRPCError).code).toBe("CONFLICT");
    }
  });

  it("throws NOT_FOUND when the referenced property does not exist", () => {
    try {
      decidePropertyLink({ resolvedCustomerId: 7, mode: "existing", existingProperty: null });
      throw new Error("expected throw");
    } catch (e) {
      expect((e as TRPCError).code).toBe("NOT_FOUND");
    }
  });

  it("reuses an address-matched property instead of creating a duplicate (dedupe)", () => {
    const d = decidePropertyLink({
      resolvedCustomerId: 7,
      mode: "create",
      dedupeMatchId: 55,
    });
    expect(d).toEqual({ action: "link", propertyId: 55 });
  });

  it("creates a new property when no address match exists", () => {
    const d = decidePropertyLink({
      resolvedCustomerId: 7,
      mode: "create",
      dedupeMatchId: null,
    });
    expect(d).toEqual({ action: "create" });
  });

  it("requires a resolvable customer (rejects an appointment with no customer)", () => {
    try {
      decidePropertyLink({ resolvedCustomerId: null, mode: "create", dedupeMatchId: null });
      throw new Error("expected throw");
    } catch (e) {
      expect((e as TRPCError).code).toBe("BAD_REQUEST");
    }
  });

  it("is idempotent: re-linking the same existing property returns the same decision", () => {
    const input = { resolvedCustomerId: 3, mode: "existing" as const, existingProperty: { id: 9, customerId: 3 } };
    expect(decidePropertyLink(input)).toEqual(decidePropertyLink(input));
  });
});

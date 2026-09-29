import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { router, publicProcedure, adminProcedure, createCallerFactory, GATEWAY_GUARD_MS } from "./trpc";

const testRouter = router({
  slowMutation: publicProcedure.mutation(async () => {
    await new Promise((r) => setTimeout(r, GATEWAY_GUARD_MS + 1_000));
    return "done";
  }),
  fastMutation: publicProcedure.mutation(async () => {
    await new Promise((r) => setTimeout(r, 1_000));
    return "done";
  }),
  slowQuery: publicProcedure.query(async () => {
    await new Promise((r) => setTimeout(r, GATEWAY_GUARD_MS + 1_000));
    return "done";
  }),
  slowThenThrows: publicProcedure.mutation(async () => {
    await new Promise((r) => setTimeout(r, GATEWAY_GUARD_MS + 1_000));
    throw new Error("boom");
  }),
  adminSlow: adminProcedure.mutation(async () => "unreachable for non-admin"),
});

const caller = createCallerFactory(testRouter)({ user: null } as never);

describe("gateway-guard middleware (runtime half of the 20s rule)", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    warn.mockRestore();
  });

  it("warns, naming the procedure, when a mutation runs past the gateway timeout — and still returns its result", async () => {
    const p = caller.slowMutation();
    await vi.advanceTimersByTimeAsync(GATEWAY_GUARD_MS + 1_000);
    await expect(p).resolves.toBe("done");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/\[gateway-guard\] mutation "slowMutation" ran 21\.0s/);
  });

  it("stays silent for a mutation under the limit", async () => {
    const p = caller.fastMutation();
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(p).resolves.toBe("done");
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not apply to queries", async () => {
    const p = caller.slowQuery();
    await vi.advanceTimersByTimeAsync(GATEWAY_GUARD_MS + 1_000);
    await expect(p).resolves.toBe("done");
    expect(warn).not.toHaveBeenCalled();
  });

  it("still warns when the slow mutation ends in an error (the client 504'd either way)", async () => {
    const p = caller.slowThenThrows();
    const settled = p.catch((e) => e);
    await vi.advanceTimersByTimeAsync(GATEWAY_GUARD_MS + 1_000);
    expect((await settled).message).toBe("boom");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("is wired into adminProcedure without disturbing its auth check", async () => {
    await expect(caller.adminSlow()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

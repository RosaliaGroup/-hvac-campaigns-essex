import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("./auditLog", () => ({ logAudit: vi.fn() }));

import { getDb } from "../../db";
import { logAudit } from "./auditLog";
import {
  signActionLink,
  verifyActionLink,
  isActionLinkConsumed,
  consumeActionLink,
  isActionLinksConfigured,
  ActionLinkNotConfiguredError,
  InvalidActionLinkError,
  ExpiredActionLinkError,
  ActionLinkAlreadyConsumedError,
} from "./actionLinks";

const SECRET = "test-secret-do-not-use-in-prod";

beforeEach(() => {
  process.env.SEO_ACTION_LINK_SECRET = SECRET;
  vi.mocked(getDb).mockReset();
  vi.mocked(logAudit).mockReset();
});
afterEach(() => {
  delete process.env.SEO_ACTION_LINK_SECRET;
});

describe("isActionLinksConfigured / secret gate", () => {
  it("is false and signing throws when SEO_ACTION_LINK_SECRET is unset", () => {
    delete process.env.SEO_ACTION_LINK_SECRET;
    expect(isActionLinksConfigured()).toBe(false);
    expect(() => signActionLink(1, "veto")).toThrow(ActionLinkNotConfiguredError);
  });

  it("is true once the secret is set", () => {
    expect(isActionLinksConfigured()).toBe(true);
  });
});

describe("sign / verify round-trip", () => {
  it("round-trips a valid token", () => {
    const token = signActionLink(42, "veto");
    const payload = verifyActionLink(token);
    expect(payload.batchId).toBe(42);
    expect(payload.action).toBe("veto");
    expect(payload.exp).toBeGreaterThan(Date.now());
  });

  it("rejects a tampered payload (batchId swapped after signing)", () => {
    const token = signActionLink(42, "veto");
    const [payloadB64, sig] = token.split(".");
    const tampered = Buffer.from(JSON.stringify({ batchId: 999, action: "veto", exp: Date.now() + 1000000 }), "utf-8").toString(
      "base64url",
    );
    expect(() => verifyActionLink(`${tampered}.${sig}`)).toThrow(InvalidActionLinkError);
    void payloadB64;
  });

  it("rejects a token signed with a different secret", () => {
    const token = signActionLink(42, "veto");
    process.env.SEO_ACTION_LINK_SECRET = "a-completely-different-secret";
    expect(() => verifyActionLink(token)).toThrow(InvalidActionLinkError);
  });

  it("rejects malformed tokens (wrong shape, missing parts)", () => {
    expect(() => verifyActionLink("not-a-real-token")).toThrow(InvalidActionLinkError);
    expect(() => verifyActionLink("")).toThrow(InvalidActionLinkError);
    expect(() => verifyActionLink("a.b.c")).toThrow(InvalidActionLinkError);
  });

  it("rejects an expired token", () => {
    const token = signActionLink(42, "veto", -1000); // already expired
    expect(() => verifyActionLink(token)).toThrow(ExpiredActionLinkError);
  });
});

describe("consumeActionLink", () => {
  it("consumes a fresh token and logs link_consumed with the token hash", async () => {
    vi.mocked(getDb).mockResolvedValue({
      select: () => ({ from: () => ({ where: async () => [] }) }),
    } as never);

    const token = signActionLink(7, "veto");
    const payload = await consumeActionLink(token);
    expect(payload.batchId).toBe(7);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "link_consumed", batchId: 7, after: expect.objectContaining({ tokenHash: expect.any(String) }) }),
    );
  });

  it("throws ActionLinkAlreadyConsumedError on a second consumption of the same token", async () => {
    const token = signActionLink(7, "veto");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    vi.mocked(getDb).mockResolvedValue({
      select: () => ({ from: () => ({ where: async () => [{ after: { tokenHash: hash } }] }) }),
    } as never);

    await expect(consumeActionLink(token)).rejects.toThrow(ActionLinkAlreadyConsumedError);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("isActionLinkConsumed returns false when the DB is unavailable (fail-open on read, matching this codebase's other lookups)", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);
    const token = signActionLink(7, "veto");
    expect(await isActionLinkConsumed(token, 7)).toBe(false);
  });
});

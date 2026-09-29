import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ENV_KEYS = ["SEO_META_WARMUP_DEFAULT", "SEO_CONTENT_WARMUP_DEFAULT"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.resetModules();
});

async function loadWithEnv(meta?: string, content?: string) {
  if (meta === undefined) delete process.env.SEO_META_WARMUP_DEFAULT;
  else process.env.SEO_META_WARMUP_DEFAULT = meta;
  if (content === undefined) delete process.env.SEO_CONTENT_WARMUP_DEFAULT;
  else process.env.SEO_CONTENT_WARMUP_DEFAULT = content;
  vi.resetModules();
  return import("./warmupConfig");
}

describe("WARMUP_DEFAULTS", () => {
  it("defaults both lanes to 0 when the env vars are unset", async () => {
    const { WARMUP_DEFAULTS } = await loadWithEnv(undefined, undefined);
    expect(WARMUP_DEFAULTS).toEqual({ meta: 0, content: 0 });
  });

  it("reads a configured non-zero value", async () => {
    const { WARMUP_DEFAULTS } = await loadWithEnv("2", "8");
    expect(WARMUP_DEFAULTS).toEqual({ meta: 2, content: 8 });
  });

  it("falls back to 0 on a non-numeric or negative value rather than throwing", async () => {
    const { WARMUP_DEFAULTS } = await loadWithEnv("not-a-number", "-5");
    expect(WARMUP_DEFAULTS).toEqual({ meta: 0, content: 0 });
  });

  it("treats a blank string the same as unset", async () => {
    const { WARMUP_DEFAULTS } = await loadWithEnv("", "  ");
    expect(WARMUP_DEFAULTS).toEqual({ meta: 0, content: 0 });
  });
});

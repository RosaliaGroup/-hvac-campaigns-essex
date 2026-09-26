/**
 * Static regression test: the /warranty page's three [CONFIRM] placeholders
 * (docs/positioning-warranty-spec.md §3/§8) must render as live JSX text —
 * never removed, filled with invented copy, or commented out — until the
 * owner fills them in and the PR checklist is satisfied.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const src = readFileSync(path.join(__dirname, "Warranty.tsx"), "utf8");

const CONFIRM_STRINGS = [
  "[CONFIRM WITH PROVIDER TERMS — typical programs allow one transfer.]",
  "[CONFIRM — if the program requires annual maintenance, state it here.]",
  "[PROVIDER LEGAL NAME]",
];

/** Strips //, /* *\/, and JSX {/* *\/} comments so a placeholder found in the remaining text is genuinely live. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("Warranty.tsx — [CONFIRM] placeholders stay visible", () => {
  it("contains all three placeholder strings", () => {
    for (const s of CONFIRM_STRINGS) expect(src).toContain(s);
  });

  it("none of the three placeholders are inside a comment", () => {
    const withoutComments = stripComments(src);
    for (const s of CONFIRM_STRINGS) expect(withoutComments).toContain(s);
  });

  it("the two FAQ placeholders are NOT gated behind the collapsible accordion's conditional render", () => {
    // pendingConfirmations renders unconditionally (openFaq === i && ...
    // only gates the separate, non-placeholder `faqs` array) — confirm the
    // placeholder strings sit outside that conditional block.
    const openFaqGate = src.indexOf("openFaq === i &&");
    expect(openFaqGate).toBeGreaterThan(-1);
    const transferIdx = src.indexOf(CONFIRM_STRINGS[0]);
    const maintenanceIdx = src.indexOf(CONFIRM_STRINGS[1]);
    expect(transferIdx).toBeLessThan(openFaqGate);
    expect(maintenanceIdx).toBeLessThan(openFaqGate);
  });

  it("the terms-disclosure placeholder is not inside the collapsible accordion either", () => {
    const openFaqGate = src.indexOf("openFaq === i &&");
    const providerNameIdx = src.indexOf("[PROVIDER LEGAL NAME]");
    expect(providerNameIdx).toBeGreaterThan(openFaqGate);
  });
});

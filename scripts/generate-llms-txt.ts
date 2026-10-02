/**
 * Writes client/public/llms.txt from VERIFIED_FACTS (see shared/llmsTxt.ts).
 * Run: npx tsx scripts/generate-llms-txt.ts   (also part of `prebuild`/`build`)
 */
import fs from "fs";
import path from "path";
import { VERIFIED_FACTS } from "../shared/verifiedFacts";
import { buildLlmsTxt } from "../shared/llmsTxt";

const out = path.resolve(import.meta.dirname, "..", "client", "public", "llms.txt");
fs.writeFileSync(out, buildLlmsTxt(VERIFIED_FACTS));
console.log(`[llms.txt] wrote ${out}`);

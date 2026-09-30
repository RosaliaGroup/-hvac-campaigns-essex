// READ-ONLY export of Mechanical's two Vapi assistants + their tools, for revert purposes.
// Run: railway run --service=-hvac-campaigns-essex --environment=production node scripts/export-vapi-mechanical.cjs <outDir>
// Key is read from process.env.VAPI_API_KEY and never written. Secret-bearing fields are masked; IDs are kept in full
// (they are identifiers, not credentials) because a revert PATCH needs them.
const fs = require("fs");
const path = require("path");
const KEY = process.env.VAPI_API_KEY;
if (!KEY) { console.error("VAPI_API_KEY not set"); process.exit(1); }
const OUT = process.argv[2] || "ops/vapi-backups";
const TARGET_SUFFIXES = ["2894", "5b09"]; // Mechanical Inbound / Mechanical Outbound

const SECRET_KEY = /secret|token|authorization|password|api[-_]?key|bearer|private/i;
const mask = (v) => (typeof v === "string" && v.length > 4 ? `***masked(len=${v.length},…${v.slice(-2)})***` : "***masked***");
function scrub(x, k = "") {
  if (Array.isArray(x)) return x.map((i) => scrub(i, k));
  if (x && typeof x === "object") {
    const o = {};
    for (const [kk, vv] of Object.entries(x)) {
      if (SECRET_KEY.test(kk) && vv && typeof vv !== "object") o[kk] = mask(vv);
      else if (kk.toLowerCase() === "headers" && vv && typeof vv === "object") {
        o[kk] = Object.fromEntries(Object.entries(vv).map(([h, val]) => [h, /^(content-type|accept)$/i.test(h) ? val : mask(String(val))]));
      } else o[kk] = scrub(vv, kk);
    }
    return o;
  }
  return x;
}
const get = async (p) => { const r = await fetch("https://api.vapi.ai" + p, { headers: { Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(`GET ${p} -> ${r.status}`); return r.json(); };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const all = await get("/assistant?limit=200");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const summary = [];
  for (const sfx of TARGET_SUFFIXES) {
    const a = all.find((x) => x.id.endsWith(sfx));
    if (!a) throw new Error("assistant …" + sfx + " not found");
    const full = await get("/assistant/" + a.id);
    const toolIds = full.model?.toolIds || [];
    const tools = [];
    for (const id of toolIds) tools.push(await get("/tool/" + id));
    const doc = { exportedAt: new Date().toISOString(), note: "masked; secrets must be re-supplied on restore", assistant: scrub(full), tools: scrub(tools) };
    const file = path.join(OUT, `assistant-${sfx}-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
    summary.push({ assistant: "…" + sfx, name: full.name, tools: tools.map((t) => ({ id: "…" + t.id.slice(-4), type: t.type, name: t.function?.name || t.name, url: t.server?.url || t.url || null, method: t.method || null, credentialId: t.server?.credentialId ? "…" + String(t.server.credentialId).slice(-4) : null, hasHeaders: !!(t.server?.headers || t.headers) })), file });
  }
  console.log(JSON.stringify(summary, null, 2));
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });

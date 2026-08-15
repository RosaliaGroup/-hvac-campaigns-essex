/** Read-only post-apply verification of every object migration 0066 touches. */
import mysql from "mysql2/promise";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const c = await mysql.createConnection({ uri: url, timezone: "Z" });
  const q = async (sql: string, p: unknown[] = []) => (await c.query(sql, p))[0] as any[];
  try {
    const P = (label: string, ok: boolean, detail: string) =>
      console.log(`  ${ok ? "✅" : "❌"} ${label.padEnd(46)} ${detail}`);

    // 1. numberSequences table + commercial_bid seed
    const nsTab = await q(`SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='numberSequences'`);
    const nsRow = await q("SELECT `key`,`nextValue` FROM `numberSequences` WHERE `key`='commercial_bid'");
    P("numberSequences table", nsTab[0].n > 0, `exists=${nsTab[0].n>0}`);
    P("  commercial_bid sequence seed", nsRow.length>0 && nsRow[0].nextValue===2158, nsRow.length? `nextValue=${nsRow[0].nextValue}` : "MISSING");

    // 2-3. enum extensions
    const cls = await q(`SELECT COLUMN_TYPE t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='opportunityStages' AND COLUMN_NAME='classification'`);
    P("opportunityStages.classification enum", cls[0].t.includes("'declined'"), cls[0].t);
    const st = await q(`SELECT COLUMN_TYPE t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='opportunities' AND COLUMN_NAME='status'`);
    P("opportunities.status enum", st[0].t.includes("'declined'"), st[0].t);

    // 4. opportunityDocuments url nullable + storageKey
    const url_ = await q(`SELECT COLUMN_TYPE t, IS_NULLABLE n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='opportunityDocuments' AND COLUMN_NAME='url'`);
    P("opportunityDocuments.url", url_.length>0 && url_[0].t.includes("1024") && url_[0].n==="YES", `${url_[0].t} nullable=${url_[0].n}`);
    const sk = await q(`SELECT COLUMN_TYPE t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='opportunityDocuments' AND COLUMN_NAME='storageKey'`);
    P("opportunityDocuments.storageKey", sk.length>0, sk.length? sk[0].t : "MISSING");

    // 5. commercial flags
    for (const col of ["isBid","isStrategicLead","isStrategicProject"]) {
      const r = await q(`SELECT COLUMN_TYPE t, IS_NULLABLE n, COLUMN_DEFAULT d FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='opportunities' AND COLUMN_NAME=?`, [col]);
      P(`opportunities.${col}`, r.length>0, r.length? `${r[0].t} nullable=${r[0].n} default=${r[0].d}` : "MISSING");
    }
    // 6. priorityScore
    const ps = await q(`SELECT COLUMN_TYPE t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='opportunities' AND COLUMN_NAME='priorityScore'`);
    P("opportunities.priorityScore", ps.length>0, ps.length? ps[0].t : "MISSING");

    // 7. unique index swap
    const idx = await q(`SELECT INDEX_NAME, NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='opportunities' AND INDEX_NAME IN ('opportunities_opportunityNumber_idx','opportunities_opportunityNumber_uq') GROUP BY INDEX_NAME, NON_UNIQUE`);
    const names = new Set(idx.map(r => r.INDEX_NAME));
    P("opportunityNumber unique index (_uq)", names.has("opportunities_opportunityNumber_uq"), names.has("opportunities_opportunityNumber_uq")?"present (UNIQUE)":"MISSING");
    P("  old non-unique index (_idx) removed", !names.has("opportunities_opportunityNumber_idx"), names.has("opportunities_opportunityNumber_idx")?"STILL PRESENT":"gone");

    // 8. declined_to_bid stage row
    const dtb = await q("SELECT stageKey,name,sortOrder,classification,isSystem FROM opportunityStages WHERE pipelineKey='commercial' AND stageKey='declined_to_bid'");
    P("declined_to_bid stage seed", dtb.length>0 && dtb[0].classification==='declined', dtb.length? `sortOrder=${dtb[0].sortOrder} classification=${dtb[0].classification}` : "MISSING");

    // 9. ledger row + data integrity
    const led = await q("SELECT id, LEFT(hash,12) h, created_at FROM __drizzle_migrations WHERE created_at=1785814913936");
    P("__drizzle_migrations 0066 row", led.length>0, led.length? `id=${led[0].id} hash=${led[0].h}… created_at=${led[0].created_at}` : "MISSING");
    const ns = await q("SELECT COUNT(*) n FROM opportunities WHERE stageId IS NULL");
    const tot = await q("SELECT COUNT(*) n FROM opportunities");
    P("null_stage (data integrity)", ns[0].n===0, `${ns[0].n} of ${tot[0].n}`);

    // backups present
    const bk = await q(`SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME LIKE '%\\_backup\\_pre0066'`);
    console.log("\n  backups:", bk.map(r=>`${r.TABLE_NAME}`).join(", ") || "none");
  } finally { await c.end(); }
}
main().catch(e => { console.error("REPORT ERR:", e instanceof Error ? e.message : e); process.exit(1); });

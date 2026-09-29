import { regenerateUnlockedDrafts } from "../server/services/seo/draftManagement";

const PAGE_IDS = [150, 26, 56, 17907, 53, 205]; // heat-pump-installation-nj, ductless-mini-split-installation-nj, vrv-vrf-installation-nj, central-ac-installation-nj, hvac-short-hills-nj, hvac-union-nj

async function main() {
  console.log("regenerating pageIds:", PAGE_IDS);
  const { results, skippedLocked } = await regenerateUnlockedDrafts(PAGE_IDS);
  console.log("skipped (locked):", JSON.stringify(skippedLocked));
  console.log("results:", JSON.stringify(results, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });

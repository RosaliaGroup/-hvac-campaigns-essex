interface VerifyRow {
  category: string;
  description: string;
  tag: string;
  qty: number;
  unit: string;
}

interface VerifyFinding {
  id: string;
  severity: "info" | "warning" | "error";
  title: string;
  detail: string;
}

/**
 * Run automatic verification checks on a completed takeoff.
 * Returns findings for any failed checks.
 */
export function runVerification(rows: VerifyRow[]): VerifyFinding[] {
  const findings: VerifyFinding[] = [];
  const uid = () => Math.random().toString(36).slice(2, 10);

  const desc = (r: VerifyRow) => (r.description + " " + r.tag).toLowerCase();

  // Count key item types
  const kitchenExhaust = rows.filter((r) => desc(r).includes("kitchen") && (desc(r).includes("exhaust") || desc(r).includes("kx"))).reduce((s, r) => s + r.qty, 0);
  const bathExhaust = rows.filter((r) => (desc(r).includes("bath") || desc(r).includes("toilet")) && (desc(r).includes("exhaust") || desc(r).includes("tx"))).reduce((s, r) => s + r.qty, 0);
  const thermostats = rows.filter((r) => desc(r).includes("thermostat") || desc(r).includes("controller")).reduce((s, r) => s + r.qty, 0);
  const ahuCount = rows.filter((r) => r.category === "MACHINERY" && (desc(r).includes("ahu") || desc(r).includes("air handler") || desc(r).includes("air handling"))).reduce((s, r) => s + r.qty, 0);
  const oduCount = rows.filter((r) => r.category === "MACHINERY" && (desc(r).includes("odu") || desc(r).includes("outdoor unit") || desc(r).includes("condensing"))).reduce((s, r) => s + r.qty, 0);
  const supplyRegisters = rows.filter((r) => r.category === "AIR DEVICES" && (desc(r).includes("supply") || desc(r).includes("register"))).reduce((s, r) => s + r.qty, 0);
  const returnGrilles = rows.filter((r) => r.category === "AIR DEVICES" && desc(r).includes("return")).reduce((s, r) => s + r.qty, 0);
  const fireDampers = rows.filter((r) => desc(r).includes("fire damper")).reduce((s, r) => s + r.qty, 0);

  // Estimate unit count from AHU count (residential: 1 AHU per unit typically)
  const estimatedUnits = ahuCount > 10 ? ahuCount : 0;

  if (estimatedUnits > 0) {
    // Kitchen exhaust check
    if (kitchenExhaust > 0 && kitchenExhaust < estimatedUnits * 0.8) {
      findings.push({
        id: uid(),
        severity: "warning",
        title: `Kitchen exhaust fans (${kitchenExhaust}) may be low for ${estimatedUnits} units`,
        detail: `Expected approximately ${estimatedUnits} kitchen exhaust fans (1 per unit). Found ${kitchenExhaust}. Check schedule vs plan count.`,
      });
    }

    // Bathroom exhaust check
    if (bathExhaust > 0 && bathExhaust < estimatedUnits * 0.8) {
      findings.push({
        id: uid(),
        severity: "warning",
        title: `Bathroom exhaust fans (${bathExhaust}) may be low for ${estimatedUnits} units`,
        detail: `Expected approximately ${estimatedUnits} bathroom exhaust fans (1 per unit). Found ${bathExhaust}. Check schedule vs plan count.`,
      });
    }

    // Thermostat check
    if (thermostats > 0 && thermostats < estimatedUnits * 0.8) {
      findings.push({
        id: uid(),
        severity: "warning",
        title: `Thermostats (${thermostats}) may be low for ${estimatedUnits} units`,
        detail: `Expected approximately ${estimatedUnits} thermostats (1 per unit). Found ${thermostats}.`,
      });
    }
  }

  // Equipment schedule vs plan count sanity checks
  if (oduCount > 0 && ahuCount > 0 && ahuCount / oduCount > 20) {
    findings.push({
      id: uid(),
      severity: "warning",
      title: `High AHU/ODU ratio: ${ahuCount} AHUs to ${oduCount} ODUs`,
      detail: `Typical VRF ratio is 8-16 indoor units per outdoor unit. ${ahuCount}:${oduCount} = ${(ahuCount / oduCount).toFixed(1)}:1. Verify ODU sizing.`,
    });
  }

  // Air devices balance check
  if (supplyRegisters > 0 && returnGrilles > 0) {
    const ratio = supplyRegisters / returnGrilles;
    if (ratio > 4 || ratio < 0.5) {
      findings.push({
        id: uid(),
        severity: "info",
        title: `Supply/return ratio: ${supplyRegisters} supply, ${returnGrilles} return`,
        detail: `Unusual supply-to-return ratio of ${ratio.toFixed(1)}:1. Typical residential is 2-3:1. Verify return air path.`,
      });
    }
  }

  // Fire damper check — should have at least 1 per floor penetration
  if (fireDampers === 0 && rows.length > 20) {
    findings.push({
      id: uid(),
      severity: "warning",
      title: "No fire dampers found",
      detail: "Multi-story buildings typically require fire dampers at rated wall/floor penetrations. Verify if fire dampers are specified elsewhere.",
    });
  }

  // Missing categories check
  const cats = new Set(rows.map((r) => r.category));
  if (rows.length > 10) {
    if (!cats.has("INSULATION")) {
      findings.push({ id: uid(), severity: "info", title: "No insulation items found", detail: "Verify if duct/pipe insulation is specified on the drawings or in the spec." });
    }
    if (!cats.has("LABOR")) {
      findings.push({ id: uid(), severity: "info", title: "No labor hours itemized", detail: "Consider adding labor hours for equipment setting, duct installation, and controls wiring." });
    }
  }

  // Summary finding
  if (findings.length === 0) {
    findings.push({ id: uid(), severity: "info", title: "All verification checks passed", detail: "No count discrepancies detected. Manual review is still recommended." });
  }

  return findings;
}

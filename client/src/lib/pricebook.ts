export interface PricebookEntry {
  key: string;
  label: string;
  category: string;
  unit: string;
  defaultPrice: number;
  laborHours: number;
  laborRate: number;
}

export const DEFAULT_PRICEBOOK: PricebookEntry[] = [
  // Equipment
  { key: "vrf_odu_3t", label: "VRF/VRV ODU 3-Ton", category: "MACHINERY", unit: "EA", defaultPrice: 3600, laborHours: 6, laborRate: 95 },
  { key: "vrf_odu_5t", label: "VRF/VRV ODU 5-Ton", category: "MACHINERY", unit: "EA", defaultPrice: 5400, laborHours: 8, laborRate: 95 },
  { key: "vrf_ahu_1t", label: "VRF/VRV AHU 1-Ton", category: "MACHINERY", unit: "EA", defaultPrice: 500, laborHours: 3, laborRate: 95 },
  { key: "vrf_ahu_1.5t", label: "VRF/VRV AHU 1.5-Ton", category: "MACHINERY", unit: "EA", defaultPrice: 600, laborHours: 3, laborRate: 95 },
  { key: "erv", label: "ERV Unit", category: "MACHINERY", unit: "EA", defaultPrice: 1400, laborHours: 6, laborRate: 95 },
  { key: "exhaust_fan_sm", label: "Exhaust Fan <500 CFM", category: "MACHINERY", unit: "EA", defaultPrice: 225, laborHours: 2, laborRate: 95 },
  { key: "exhaust_fan_lg", label: "Exhaust Fan >1000 CFM", category: "MACHINERY", unit: "EA", defaultPrice: 900, laborHours: 4, laborRate: 95 },
  { key: "ahu_ceiling", label: "AHU Ceiling Mounted", category: "MACHINERY", unit: "EA", defaultPrice: 2800, laborHours: 8, laborRate: 95 },
  { key: "condensing_unit", label: "Condensing Unit Air Cooled", category: "MACHINERY", unit: "EA", defaultPrice: 2200, laborHours: 6, laborRate: 95 },
  { key: "rtu", label: "Rooftop Unit", category: "MACHINERY", unit: "EA", defaultPrice: 4500, laborHours: 12, laborRate: 95 },
  // Ductwork
  { key: "rect_duct_sm", label: "Rect Duct ≤10\" wide", category: "SHEET METAL", unit: "LF", defaultPrice: 11, laborHours: 0.015, laborRate: 105 },
  { key: "rect_duct_md", label: "Rect Duct 12-20\" wide", category: "SHEET METAL", unit: "LF", defaultPrice: 22, laborHours: 0.02, laborRate: 105 },
  { key: "rect_duct_lg", label: "Rect Duct >20\" wide", category: "SHEET METAL", unit: "LF", defaultPrice: 35, laborHours: 0.03, laborRate: 105 },
  { key: "round_duct", label: "Round/Flex Duct 5-6\"", category: "SHEET METAL", unit: "LF", defaultPrice: 6, laborHours: 0.01, laborRate: 105 },
  // Piping
  { key: "refrig_pipe_sm", label: "Refrigerant Line ≤3/8\"", category: "COPPER", unit: "LF", defaultPrice: 8, laborHours: 0.015, laborRate: 95 },
  { key: "refrig_pipe_lg", label: "Refrigerant Line >3/8\"", category: "COPPER", unit: "LF", defaultPrice: 14, laborHours: 0.02, laborRate: 95 },
  { key: "condensate", label: "Condensate Drain PVC", category: "COPPER", unit: "LF", defaultPrice: 5, laborHours: 0.01, laborRate: 85 },
  // Air Devices
  { key: "supply_register", label: "Supply Register/Grille", category: "AIR DEVICES", unit: "EA", defaultPrice: 55, laborHours: 0.75, laborRate: 95 },
  { key: "return_grille", label: "Return Air Grille", category: "AIR DEVICES", unit: "EA", defaultPrice: 65, laborHours: 0.75, laborRate: 95 },
  { key: "exhaust_grille", label: "Exhaust Grille", category: "AIR DEVICES", unit: "EA", defaultPrice: 45, laborHours: 0.5, laborRate: 95 },
  // Accessories
  { key: "fire_damper", label: "Fire Damper", category: "ACCESSORIES", unit: "EA", defaultPrice: 250, laborHours: 2, laborRate: 95 },
  { key: "volume_damper", label: "Volume Damper", category: "ACCESSORIES", unit: "EA", defaultPrice: 85, laborHours: 1, laborRate: 95 },
  { key: "motorized_damper", label: "Motorized Damper", category: "ACCESSORIES", unit: "EA", defaultPrice: 320, laborHours: 2, laborRate: 95 },
  { key: "louver", label: "Wall Louver", category: "ACCESSORIES", unit: "EA", defaultPrice: 350, laborHours: 2, laborRate: 95 },
  // Insulation
  { key: "duct_insulation", label: "Duct Insulation Wrap", category: "INSULATION", unit: "SF", defaultPrice: 4, laborHours: 0.005, laborRate: 85 },
  { key: "pipe_insulation", label: "Pipe Insulation", category: "INSULATION", unit: "LF", defaultPrice: 5, laborHours: 0.008, laborRate: 85 },
  // Controls
  { key: "thermostat", label: "Thermostat/Controller", category: "ACCESSORIES", unit: "EA", defaultPrice: 275, laborHours: 2.5, laborRate: 95 },
  { key: "co_detector", label: "CO Detector", category: "ACCESSORIES", unit: "EA", defaultPrice: 180, laborHours: 1.5, laborRate: 95 },
];

/** Try to match a takeoff row description to a pricebook entry. Returns the entry or undefined. */
export function matchPricebook(description: string, pricebook: PricebookEntry[]): PricebookEntry | undefined {
  const d = description.toLowerCase();
  for (const entry of pricebook) {
    const keywords = entry.label.toLowerCase().split(/\s+/);
    // Match if at least 2 keywords are found in the description
    const matches = keywords.filter((kw) => d.includes(kw));
    if (matches.length >= 2) return entry;
  }
  return undefined;
}

/** CSI Division 23 category mapping */
export const CSI_DIVISIONS: Record<string, string> = {
  MACHINERY: "23 30 00 - HVAC Air Distribution",
  "SHEET METAL": "23 31 00 - HVAC Ducts and Casings",
  COPPER: "23 21 00 - Hydronic Piping and Pumps",
  INSULATION: "23 07 00 - HVAC Insulation",
  "AIR DEVICES": "23 37 00 - Air Outlets and Inlets",
  ACCESSORIES: "23 33 00 - Air Duct Accessories",
  LABOR: "23 05 00 - Common Work Results for HVAC",
  OTHER: "23 00 00 - HVAC General",
};

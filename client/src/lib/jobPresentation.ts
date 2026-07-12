/**
 * Shared presentation constants for jobs (Task 6).
 *
 * IMPORTANT: `value` is the STORED enum value and must never change. `label` is
 * display-only and may be relabeled freely (per product decision, the operational
 * pipeline reads e.g. "new" as "Unscheduled" without touching the stored value).
 */
export const JOB_STATUS_META = [
  { value: "new", label: "Unscheduled", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700" },
  { value: "scheduled", label: "Scheduled", dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700" },
  { value: "in_progress", label: "On Site / In Progress", dot: "bg-indigo-500", badge: "bg-indigo-100 text-indigo-700" },
  { value: "waiting_parts", label: "Waiting for Parts", dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700" },
  { value: "estimate_sent", label: "Waiting for Approval", dot: "bg-purple-500", badge: "bg-purple-100 text-purple-700" },
  { value: "approved", label: "Approved", dot: "bg-teal-500", badge: "bg-teal-100 text-teal-700" },
  { value: "completed", label: "Completed", dot: "bg-green-500", badge: "bg-green-100 text-green-700" },
  { value: "invoice_sent", label: "Invoice Sent", dot: "bg-cyan-500", badge: "bg-cyan-100 text-cyan-700" },
  { value: "paid", label: "Paid", dot: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
  { value: "closed", label: "Closed", dot: "bg-gray-400", badge: "bg-gray-100 text-gray-600" },
  { value: "cancelled", label: "Cancelled", dot: "bg-red-500", badge: "bg-red-100 text-red-700" },
] as const;

/** Human labels for the job type enum (stored values unchanged). */
export const JOB_TYPE_LABELS: Record<string, string> = {
  service_call: "Service Call", diagnostic: "Diagnostic", repair: "Repair",
  maintenance: "Preventive Maintenance", installation: "Installation", replacement: "Replacement",
  estimate: "Estimate Visit", commercial_hvac: "Commercial HVAC", residential_hvac: "Residential HVAC",
  boiler: "Boiler", furnace: "Furnace", ac: "Air Conditioning", heat_pump: "Heat Pump",
  mini_split: "Mini-Split", rooftop_unit: "Rooftop Unit", refrigeration: "Refrigeration", other: "Other",
};

/** Warranty classification labels. */
export const WARRANTY_LABELS: Record<string, string> = {
  none: "No Warranty", manufacturer: "Manufacturer", labor: "Labor", extended: "Extended", warranty_call: "Warranty Call",
};

export const LINE_ITEM_TYPE_LABELS: Record<string, string> = {
  labor: "Labor",
  part: "Part",
  service: "Service",
  equipment: "Equipment",
  other: "Other",
};

export function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

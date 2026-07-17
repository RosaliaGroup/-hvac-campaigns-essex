/**
 * Appointment + service type catalog and Google Calendar formatting (Task: HVAC
 * appointment model). Single source of truth shared by the client (dialog +
 * display) and the server (event sync + tests). Pure + framework-free.
 *
 * The option lists are plain arrays so they're easy to extend later (and, in a
 * future pass, to make admin-editable).
 */

export interface Option {
  value: string;
  label: string;
}

// ── Appointment Type ────────────────────────────────────────────────────────
export const APPOINTMENT_TYPES: Option[] = [
  { value: "assessment", label: "Assessment" },
  { value: "estimate", label: "Estimate" },
  { value: "service_call", label: "Service Call" },
  { value: "installation", label: "Installation" },
  { value: "maintenance", label: "Maintenance" },
  { value: "warranty", label: "Warranty" },
  { value: "follow_up", label: "Follow-up" },
  { value: "inspection", label: "Inspection" },
  { value: "sales_visit", label: "Sales Visit" },
  { value: "other", label: "Other" },
];

/** Legacy enum values kept in the DB for existing rows; mapped to new ones for display. */
export const LEGACY_APPOINTMENT_TYPE_MAP: Record<string, string> = {
  free_consultation: "assessment",
  commercial_assessment: "assessment",
  technician_dispatch: "service_call",
  maintenance_plan: "maintenance",
};

/** Full DB enum = new values + legacy (legacy retained so existing rows stay valid). */
export const APPOINTMENT_TYPE_ENUM = [
  "assessment", "estimate", "service_call", "installation", "maintenance",
  "warranty", "follow_up", "inspection", "sales_visit", "other",
  // legacy — do not remove (existing appointment rows use these):
  "free_consultation", "technician_dispatch", "maintenance_plan", "commercial_assessment",
] as const;

export type AppointmentTypeValue = (typeof APPOINTMENT_TYPE_ENUM)[number];

// ── Service Type (second dropdown) ──────────────────────────────────────────
export const SERVICE_TYPES: Option[] = [
  { value: "mini_split_installation", label: "Mini Split Installation" },
  { value: "central_air", label: "Central Air" },
  { value: "heat_pump", label: "Heat Pump" },
  { value: "furnace", label: "Furnace" },
  { value: "boiler", label: "Boiler" },
  { value: "rooftop_unit", label: "Rooftop Unit" },
  { value: "water_heater", label: "Water Heater" },
  { value: "indoor_air_quality", label: "Indoor Air Quality" },
  { value: "commercial_hvac", label: "Commercial HVAC" },
  { value: "refrigeration", label: "Refrigeration" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "general", label: "General" },
  { value: "other", label: "Other" },
];

/** Appointment types that show the Service Type dropdown. */
export const SERVICE_TYPE_APPOINTMENT_TYPES = new Set([
  "assessment", "estimate", "service_call", "installation", "maintenance",
]);

export function normalizeAppointmentType(value?: string | null): string {
  if (!value) return "assessment"; // backwards compat: missing type → Assessment
  return LEGACY_APPOINTMENT_TYPE_MAP[value] ?? value;
}

export function showsServiceType(appointmentType?: string | null): boolean {
  return SERVICE_TYPE_APPOINTMENT_TYPES.has(normalizeAppointmentType(appointmentType));
}

const APPOINTMENT_LABELS: Record<string, string> = Object.fromEntries(APPOINTMENT_TYPES.map(t => [t.value, t.label]));
export function appointmentTypeLabel(value?: string | null): string {
  return APPOINTMENT_LABELS[normalizeAppointmentType(value)] ?? "Assessment";
}

const SERVICE_LABELS: Record<string, string> = Object.fromEntries(SERVICE_TYPES.map(t => [t.value, t.label]));
export function serviceTypeLabel(value?: string | null): string | null {
  if (!value) return null;
  return SERVICE_LABELS[value] ?? value; // varchar column → fall back to the raw value
}

// ── Reminders ───────────────────────────────────────────────────────────────
export interface ReminderOption {
  value: number | null; // minutes before start; null = none
  label: string;
}
export const REMINDER_OPTIONS: ReminderOption[] = [
  { value: null, label: "None" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 1440, label: "1 day" },
];
export function reminderLabel(minutes?: number | null): string {
  return REMINDER_OPTIONS.find(o => o.value === (minutes ?? null))?.label ?? "None";
}

/** Google `reminders` resource. null/undefined = no reminder overrides. */
export function reminderToGoogle(minutes?: number | null): { useDefault: boolean; overrides: { method: string; minutes: number }[] } {
  if (minutes == null) return { useDefault: false, overrides: [] };
  return { useDefault: false, overrides: [{ method: "popup", minutes }] };
}

// ── Google Calendar title ───────────────────────────────────────────────────
/** "<Appointment Type> – <Service Type>" (en dash), no customer name. */
export function buildAppointmentTitle(appointmentType?: string | null, serviceType?: string | null): string {
  const typeLabel = appointmentTypeLabel(appointmentType);
  const svc = serviceTypeLabel(serviceType);
  return svc ? `${typeLabel} – ${svc}` : typeLabel;
}

// ── Google Calendar description ─────────────────────────────────────────────
export interface DescriptionFields {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  propertyAddress?: string | null;
  appointmentType?: string | null;
  serviceType?: string | null;
  /** The written job/problem description captured on the appointment (issueDescription). */
  issueDescription?: string | null;
  assignedTechnician?: string | null;
  additionalTechnicians?: string[];
  notes?: string | null;
}

/** Ordered description with the customer name at the top (above the address). */
export function buildAppointmentDescription(f: DescriptionFields): string {
  const blocks: string[] = [];
  const add = (label: string, val?: string | null) => {
    if (val && val.trim()) blocks.push(`${label}\n${val.trim()}`);
  };
  add("Customer", f.fullName);
  add("Phone", f.phone);
  add("Email", f.email);
  add("Service Address", f.propertyAddress);
  add("Appointment Type", appointmentTypeLabel(f.appointmentType));
  add("Service Type", serviceTypeLabel(f.serviceType));
  add("Job Description", f.issueDescription);
  add("Assigned Technician", f.assignedTechnician);
  const extra = (f.additionalTechnicians ?? []).map(s => s.trim()).filter(Boolean);
  if (extra.length) blocks.push(`Additional Technicians\n${extra.join(", ")}`);
  add("Notes", f.notes);
  blocks.push("Booked via Mechanical Enterprise CRM");
  return blocks.join("\n\n");
}

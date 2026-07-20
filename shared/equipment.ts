/**
 * Equipment — shared vocabulary for the staff Equipment CRM (PR #1).
 *
 * Deliberately does NOT introduce a new category taxonomy. The equipment
 * category reuses the existing shared HVAC `SERVICE_TYPES` vocabulary
 * (furnace / boiler / heat_pump / water_heater / rooftop_unit / …) so the
 * whole app has ONE list. `customerEquipment.category` is a plain varchar, so
 * this is a runtime-controlled list (no DB enum, no migration).
 */
import { SERVICE_TYPES, serviceTypeLabel, type Option } from "./appointmentTypes";

/** The controlled category options shown in the equipment picker. */
export const EQUIPMENT_CATEGORIES: Option[] = SERVICE_TYPES;

/** Non-empty tuple of allowed category values — for building a zod enum. */
export const EQUIPMENT_CATEGORY_VALUES = EQUIPMENT_CATEGORIES.map(o => o.value) as [string, ...string[]];

/** Display label for a stored category value (falls back to the raw value for any legacy row). */
export function equipmentCategoryLabel(value?: string | null): string | null {
  return serviceTypeLabel(value);
}

/** Lifecycle states mirror the `customerEquipment.status` DB enum exactly. */
export const EQUIPMENT_STATUSES = ["active", "retired"] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

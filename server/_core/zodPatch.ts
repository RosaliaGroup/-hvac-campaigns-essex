import { z } from "zod";

/**
 * Build a PATCH-style input schema from a create/base schema.
 *
 * `z.object({...}).partial()` keeps any `.default(...)` wrappers, so an OMITTED
 * field still resolves to its default when parsed (e.g. `unitCost` -> 0,
 * `billable` -> false, `type` -> "labor"). For an UPDATE endpoint that is wrong:
 * an omitted field must stay `undefined` so the handler leaves the stored value
 * untouched. `toPatch` strips the defaults and makes every field optional, so:
 *   - omitted field  -> absent from the parsed object (no value synthesized)
 *   - supplied field -> passed through unchanged (including `0`, `false`, `null`)
 *
 * The ORIGINAL schema is left intact — create endpoints keep applying defaults.
 * This exists because Zod's `.partial()` does not remove `.default()`; see the
 * production verification of the Jobs module (updatePart/updateLabor).
 *
 * The return type mirrors `base.partial()` (all fields optional) so `.extend()`
 * and inference keep working for callers; the runtime differs only in that
 * defaults are not synthesized for omitted fields.
 */
export function toPatch<T extends z.ZodRawShape>(
  base: z.ZodObject<T>,
): ReturnType<z.ZodObject<T>["partial"]> {
  const shape = base.shape as unknown as Record<string, z.ZodType>;
  const patched: Record<string, z.ZodType> = {};
  for (const key of Object.keys(shape)) {
    let field = shape[key];
    // Strip every `.default(...)` layer so an omitted field is never synthesized.
    while (field instanceof z.ZodDefault) field = field.removeDefault() as z.ZodType;
    patched[key] = field.optional();
  }
  return z.object(patched) as unknown as ReturnType<z.ZodObject<T>["partial"]>;
}

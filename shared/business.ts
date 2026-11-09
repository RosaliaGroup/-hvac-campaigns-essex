// Single source of truth for the business phone number. (862) 419-1763 is the
// main line: it rings Jessica (Vapi "Mechanical Inbound"), which falls back to
// the office cell. (862) 423-9396 and (201) 449-6850 are personal cells and must
// not be published (owner, Nov 9 2026). Import these instead of hardcoding a literal.
export const PHONE_DISPLAY = "(862) 419-1763";
export const PHONE_E164 = "+18624191763";
export const PHONE_TEL = `tel:${PHONE_E164}`;

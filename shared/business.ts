// Single source of truth for the business phone number. Two numbers were in
// use across the site ((862) 423-9396 and (862) 419-1763); (862) 423-9396 is
// the correct, live number. Import these instead of hardcoding a literal.
export const PHONE_DISPLAY = "(862) 423-9396";
export const PHONE_E164 = "+18624239396";
export const PHONE_TEL = `tel:${PHONE_E164}`;

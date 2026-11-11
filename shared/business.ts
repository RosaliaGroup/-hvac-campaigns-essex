// Single source of truth for the business phone number. (862) 419-1763 is the
// main line: it rings Jessica (Vapi "Mechanical Inbound"), which falls back to
// the office cell. (862) 423-9396 and (201) 449-6850 are personal cells and must
// not be published (owner, Nov 9 2026). Import these instead of hardcoding a literal.
export const PHONE_DISPLAY = "(862) 419-1763";
export const PHONE_E164 = "+18624191763";
export const PHONE_TEL = `tel:${PHONE_E164}`;

// Text line. (862) 419-1763 is voice-only (Vapi-native number, cannot receive
// SMS). (551) 600-7027 is the Telnyx 10DLC number: it rings Jessica for calls
// and inbound texts land in the CRM inbox (human replies). Owner, Nov 10 2026:
// keep 419-1763 as the call number and publish 551-600-7027 for texts.
export const SMS_DISPLAY = "(551) 600-7027";
export const SMS_E164 = "+15516007027";
export const SMS_HREF = `sms:${SMS_E164}`;

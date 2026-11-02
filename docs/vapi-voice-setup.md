# Jessica (Vapi) — voice and transcriber setup

Apply to BOTH assistants (inbound and outbound) in the Vapi dashboard. Prompts live in
`jessica-inbound-prompt.md` and `jessica-outbound-prompt.md`. Written Nov 1, 2026.

## 1. Transcriber — what Jessica hears

| Setting | Value | Why |
|---|---|---|
| Provider | Deepgram | |
| Model | **nova-3** | Most accurate Deepgram phone model; supports keyterm prompting |
| Language | en (English, US) | |
| Smart format | On | Writes phone numbers, dates and addresses cleanly |
| Keyterms | list below | Nova-3 does not use "keywords"; it uses **keyterm** (multi-word phrases, no `:5` boosts) |

Keyterms (paste into Transcriber → Keyterm):

```
HVAC
heat pump
mini split
ductless
central air
air handler
condenser
furnace
boiler
radiators
baseboard heat
steam heat
oil heat
oil tank
window units
R-22
Freon
BTU
SEER
three-ton
VRF
PSE&G
rebate
assessment
replacement
installation
Mechanical Enterprise
Jessica
Daikin
Mitsubishi
Carrier
Trane
Lennox
Rheem
Bosch
Fujitsu
Newark
Ironbound
Kearny
Harrison
Bloomfield
Montclair
Clifton
Passaic
Paterson
Elizabeth
Hoboken
Jersey City
Bayonne
Union City
Irvington
Livingston
Hackensack
Paramus
Teaneck
Secaucus
Weehawken
Rahway
Linden
Woodbridge
Edison
```

## 2. Voice — what callers hear

**Live since Nov 2, 2026 on both assistants: ElevenLabs — Eleven v4 Turbo, voice "Sarah"
(mature, reassuring, confident).** About 300 ms to first audio, $0.029/min.

- Eleven v3 Conversational is NOT available to this Vapi org — publishing with it fails.
- Fallback if v4 Turbo is ever rejected: Vapi Voices v2 (about 430 ms, $0.02/min).
- The old voice (Vapi Voices v1 "Emma", about 810 ms) sounded slow and robotic — don't go back to it.

Keep the same voice on inbound and outbound so callers hear one "Jessica".

## 3. Conversation timing — sounding human

| Setting | Value |
|---|---|
| First message mode | Assistant speaks first |
| First message (inbound) | "Thanks for calling Mechanical Enterprise, this is Jessica. How can I help?" |
| Background denoising | On (callers in cars, kitchens, job sites) |
| Backchanneling | On ("mm-hmm", "got it" while the caller talks) |
| Smart endpointing | On (waits for the caller to finish instead of cutting in) |
| Start speaking wait | about 0.4 s |
| Stop speaking (interruptions) | stop after ~2 words from the caller |
| Silence timeout | about 20 s |
| Max call length | 10 minutes |
| Model temperature | 0.3–0.5 |
| Max tokens per reply | about 150 (keeps replies short) |

## 4. Numbers and tools

- Inbound phone number → inbound assistant. Outbound phone number → outbound assistant.
- In Railway (service `-hvac-campaigns-essex`): `VAPI_OUTBOUND_ASSISTANT_ID` = outbound assistant ID,
  `VAPI_PHONE_NUMBER_ID` = outbound phone number ID. Without both, the CRM never places call-backs.
- Railway variables set Nov 2, 2026: VAPI_OUTBOUND_ASSISTANT_ID = 0f768c27-dd34-4543-bc86-5d83f12d5b09,
  VAPI_PHONE_NUMBER_ID = 184bbe34-dc62-4539-b11b-a0ce970d6e58.
- Tools stay as they are: getCallerInfo, bookHVAC, rescheduleHVAC, MechanicalSendFormTelnyx, sendCallRecap, End Call,
  mechanical_transfer_interested_install (inbound only),
  and the end-of-call report to `/api/vapi/call-recap`.

## 5. After changing settings — test call checklist

- Say "I need a new mini split for my house in Kearny" — Jessica should hear "mini split" and "Kearny".
- Ask "do you do repairs?" — she should say no and offer a replacement assessment.
- Ask "how much are the rebates?" — "up to sixteen thousand dollars", no $20,000, no financing.
- Let the text link "not arrive" — she should switch to booking by voice.
- Give your number — she reads it back in groups, once.

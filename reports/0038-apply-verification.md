# QBO Controlled Apply — POST-APPLY Verification (read-only)

## Summary
- CRM IDs changed: **11, 12, 14, 15, 23**
- customer fields changed per record: displayName, first/last (or company), type, quickbooksRawDisplayName, projectReference, displayNameManuallyApproved
- properties created: **5**
- properties reused: **0**
- customer row count before → after: **23 → 23** (Δ 0)
- property row count before → after: **9 → 14** (Δ 5)
- rolled-back records: **none**
- duplicate contacts created: **0**
- duplicate properties created: **0**
- automatic merges: **0**
- manual-review records (7/8/9/10) changed: **0**
- unexpected customer records changed: **0** (only allowlisted IDs written)

## Per-record verification
### CRM #11 — ✅ OK
  - #11 type=residential
    displayName   : "Cynthia Rodriguez"
    company       : null
    first/last    : ["Cynthia","Rodriguez"]
    email/phone   : r***@msn.com / —
    qboCustomerId : 320
    rawDisplayName: "PN#165 I Cynthia Rodriguez I 36 Stuyvesant Rd, Teaneck, NJ 07666"
    projectRef    : PN#165
    manuallyApprov: true
    linked service property (1):
    - property #10 (customer 11) "Service Address (QuickBooks)" | 36 Stuyvesant Rd, Teaneck NJ 07666 | type=residential | notes=null | projectRef=PN#165 | primary=true

### CRM #12 — ✅ OK
  - #12 type=residential
    displayName   : "Anthony Paladino"
    company       : null
    first/last    : ["Anthony","Paladino"]
    email/phone   : a***@yahoo.com / —
    qboCustomerId : 329
    rawDisplayName: "PN#167 I Anthony Paladino I 689 Elm St, Maywood, NJ"
    projectRef    : PN#167
    manuallyApprov: true
    linked service property (1):
    - property #11 (customer 12) "Service Address (QuickBooks)" | 689 Elm St, Maywood NJ  | type=residential | notes=null | projectRef=PN#167 | primary=true

### CRM #14 — ✅ OK
  - #14 type=residential
    displayName   : "Helen Espiallat"
    company       : null
    first/last    : ["Helen","Espiallat"]
    email/phone   : h***@gmail.com / —
    qboCustomerId : 334
    rawDisplayName: "PN#171 I Helen Espiallat I 1600 Center Ave, Fort Lee, NJ"
    projectRef    : PN#171
    manuallyApprov: true
    linked service property (1):
    - property #12 (customer 14) "Service Address (QuickBooks)" | 1600 Center Ave, Fort Lee NJ  | type=residential | notes=null | projectRef=PN#171 | primary=true

### CRM #15 — ✅ OK
  - #15 type=commercial
    displayName   : "Cushman & Wakefield"
    company       : "Cushman & Wakefield"
    first/last    : [null,null]
    email/phone   : C***@cushwake.com / —
    qboCustomerId : 338
    rawDisplayName: "PN#172 I Cushman & Wakefield I 28th Floor 444 Madison Avenue, New York, NY 10022"
    projectRef    : PN#172
    manuallyApprov: true
    linked service property (1):
    - property #13 (customer 15) "Service Address (QuickBooks)" | 444 Madison Avenue, New York NY 10022 | type=commercial | notes="28th Floor" | projectRef=PN#172 | primary=true

### CRM #23 — ✅ OK
  - #23 type=residential
    displayName   : "Marco Weber"
    company       : null
    first/last    : ["Marco","Weber"]
    email/phone   : m***@gmail.com / —
    qboCustomerId : 354
    rawDisplayName: "PN-173-B I Marco Weber I 9005 Smith Ave, North Bergen, NJ 07047 I Basement I"
    projectRef    : PN-173-B
    manuallyApprov: true
    linked service property (1):
    - property #14 (customer 23) "Service Address (QuickBooks)" | 9005 Smith Ave, North Bergen NJ 07047 | type=residential | notes="Basement I" | projectRef=PN-173-B | primary=true

## Forbidden rows (7/8/9/10) — unchanged: YES ✅
  - #7 type=residential
    displayName   : "PN#160 I NATANYA L PHIPPS I 351 CENTRAL AVE HALEDON"
    company       : null
    first/last    : ["PN#160 I NATANYA L PHIPPS I 351 CENTRAL AVE","HALEDON"]
    email/phone   : h***@optonline.net / —
    qboCustomerId : 322
    rawDisplayName: null
    projectRef    : null
    manuallyApprov: false
  - #8 type=residential
    displayName   : "PN# 164 I Anibal Espailla I 75 Woodlawn Avenue Jersey City"
    company       : null
    first/last    : ["PN# 164 I Anibal Espailla I 75 Woodlawn Avenue Jersey","City"]
    email/phone   : a***@gmail.com / —
    qboCustomerId : 318
    rawDisplayName: null
    projectRef    : null
    manuallyApprov: false
  - #9 type=residential
    displayName   : "PN#132 I PDC I 828 Summer Ave Newark NJ"
    company       : null
    first/last    : ["PN#132 I PDC I 828 Summer Ave Newark","NJ"]
    email/phone   : A***@pdcllc.us / —
    qboCustomerId : 166
    rawDisplayName: null
    projectRef    : null
    manuallyApprov: false
  - #10 type=residential
    displayName   : "PN #163 I Colbert Watson I 360 Littleton Ave, Newark NJ 07103"
    company       : null
    first/last    : ["PN #163 I Colbert Watson I 360 Littleton Ave, Newark NJ","07103"]
    email/phone   : b***@gmail.com / —
    qboCustomerId : 316
    rawDisplayName: null
    projectRef    : null
    manuallyApprov: false

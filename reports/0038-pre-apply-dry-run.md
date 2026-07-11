# QBO Composite-Name Repair — Post-Migration Dry-Run Report

**Mode:** post-migration, DRY RUN. `--apply` not supplied, ZERO writes.

## Run context

- Command: `npx tsx scripts/repair-qbo-composite-names.ts`
- Target: Railway project `captivating-energy`, environment **production**, db `railway` (via `MYSQL_PUBLIC_URL`).
- Migration 0038: **APPLIED**. New audit/lock columns are now read: `quickbooksRawDisplayName`, `projectReference`, `displayNameManuallyApproved` (customers); `locationNotes`, `projectReference` (properties).

## Totals

- total customer records scanned (whole table): **23**
- candidate records scanned (pipe OR anchored PN/Project/Job/WO prefix): **9**
- composite records detected: **9**
- high-confidence repair candidates (apply-eligible): **5**
- medium/low manual-review records: **4**
- manually-approved records skipped: **0**
- already-clean records skipped: **0**
- non-composite records skipped: **0**
- existing properties reused (proposed): **0**
- proposed new properties: **9**
- possible duplicate contacts: **0**
- **automatic merges performed: 0**
- **database writes performed: 0**

## Apply-eligible — high-confidence repair candidates (5)

### CRM #11
- CRM record ID (read): 11
- QBO customer ID (read): 320
- current CRM display name (read): `PN#165 I Cynthia Rodriguez I 36 Stuyvesant Rd, Teaneck, NJ 07666`
- stored raw display name column (read): null (not yet populated — set on --apply)
- manual-approval / lock status (read): false
- proposed clean contact/company name (inferred): Cynthia Rodriguez
- proposed customer type (inferred): residential
- proposed first/last change (inferred): ["PN#165 I Cynthia Rodriguez I 36 Stuyvesant Rd, Teaneck, NJ","07666"] → ["Cynthia","Rodriguez"]
- proposed project reference (inferred): PN#165
- proposed property address (inferred): 36 Stuyvesant Rd, Teaneck, NJ 07666
- proposed suite/floor/basement/location notes (inferred): —
- property reuse-or-create (read+inferred): create-new
- raw name preserved for audit (inferred): `PN#165 I Cynthia Rodriguez I 36 Stuyvesant Rd, Teaneck, NJ 07666`
- match confidence (inferred): high
- name confident (inferred): true
- possible duplicate candidate(s): none
- proposed action: repair AFTER explicit --apply approval

### CRM #12
- CRM record ID (read): 12
- QBO customer ID (read): 329
- current CRM display name (read): `PN#167 I Anthony Paladino I 689 Elm St, Maywood, NJ`
- stored raw display name column (read): null (not yet populated — set on --apply)
- manual-approval / lock status (read): false
- proposed clean contact/company name (inferred): Anthony Paladino
- proposed customer type (inferred): residential
- proposed first/last change (inferred): ["PN#167 I Anthony Paladino I 689 Elm St, Maywood,","NJ"] → ["Anthony","Paladino"]
- proposed project reference (inferred): PN#167
- proposed property address (inferred): 689 Elm St, Maywood, NJ
- proposed suite/floor/basement/location notes (inferred): —
- property reuse-or-create (read+inferred): create-new
- raw name preserved for audit (inferred): `PN#167 I Anthony Paladino I 689 Elm St, Maywood, NJ`
- match confidence (inferred): high
- name confident (inferred): true
- possible duplicate candidate(s): none
- proposed action: repair AFTER explicit --apply approval

### CRM #14
- CRM record ID (read): 14
- QBO customer ID (read): 334
- current CRM display name (read): `PN#171 I Helen Espiallat I 1600 Center Ave, Fort Lee, NJ`
- stored raw display name column (read): null (not yet populated — set on --apply)
- manual-approval / lock status (read): false
- proposed clean contact/company name (inferred): Helen Espiallat
- proposed customer type (inferred): residential
- proposed first/last change (inferred): ["PN#171 I Helen Espiallat I 1600 Center Ave, Fort Lee,","NJ"] → ["Helen","Espiallat"]
- proposed project reference (inferred): PN#171
- proposed property address (inferred): 1600 Center Ave, Fort Lee, NJ
- proposed suite/floor/basement/location notes (inferred): —
- property reuse-or-create (read+inferred): create-new
- raw name preserved for audit (inferred): `PN#171 I Helen Espiallat I 1600 Center Ave, Fort Lee, NJ`
- match confidence (inferred): high
- name confident (inferred): true
- possible duplicate candidate(s): none
- proposed action: repair AFTER explicit --apply approval

### CRM #15
- CRM record ID (read): 15
- QBO customer ID (read): 338
- current CRM display name (read): `PN#172 I Cushman & Wakefield I 28th Floor 444 Madison Avenue, New York, NY 10022`
- stored raw display name column (read): null (not yet populated — set on --apply)
- manual-approval / lock status (read): false
- proposed clean contact/company name (inferred): Cushman & Wakefield
- proposed customer type (inferred): commercial
- proposed companyName change (inferred): null → "Cushman & Wakefield"
- proposed first/last change (inferred): ["PN#172 I Cushman & Wakefield I 28th Floor 444 Madison Avenue, New York, NY","10022"] → [null,null]
- proposed project reference (inferred): PN#172
- proposed property address (inferred): 28th Floor 444 Madison Avenue, New York, NY 10022
- proposed suite/floor/basement/location notes (inferred): 28th Floor
- property reuse-or-create (read+inferred): create-new
- raw name preserved for audit (inferred): `PN#172 I Cushman & Wakefield I 28th Floor 444 Madison Avenue, New York, NY 10022`
- match confidence (inferred): high
- name confident (inferred): true
- possible duplicate candidate(s): none
- proposed action: repair AFTER explicit --apply approval

### CRM #23
- CRM record ID (read): 23
- QBO customer ID (read): 354
- current CRM display name (read): `PN-173-B I Marco Weber I 9005 Smith Ave, North Bergen, NJ 07047 I Basement I`
- stored raw display name column (read): null (not yet populated — set on --apply)
- manual-approval / lock status (read): false
- proposed clean contact/company name (inferred): Marco Weber
- proposed customer type (inferred): residential
- proposed first/last change (inferred): ["PN-173-B I Marco Weber I 9005 Smith Ave, North Bergen, NJ 07047 I Basement","I"] → ["Marco","Weber"]
- proposed project reference (inferred): PN-173-B
- proposed property address (inferred): 9005 Smith Ave, North Bergen, NJ 07047
- proposed suite/floor/basement/location notes (inferred): Basement I
- property reuse-or-create (read+inferred): create-new
- raw name preserved for audit (inferred): `PN-173-B I Marco Weber I 9005 Smith Ave, North Bergen, NJ 07047 I Basement I`
- match confidence (inferred): high
- name confident (inferred): true
- possible duplicate candidate(s): none
- proposed action: repair AFTER explicit --apply approval

## Flagged for manual review (NOT auto-repaired) (4)

### CRM #7
- CRM record ID (read): 7
- QBO customer ID (read): 322
- current CRM display name (read): `PN#160 I NATANYA L PHIPPS I 351 CENTRAL AVE HALEDON`
- stored raw display name column (read): null (not yet populated — set on --apply)
- manual-approval / lock status (read): false
- proposed clean contact/company name (inferred): NATANYA L PHIPPS
- proposed customer type (inferred): residential
- proposed first/last change (inferred): ["PN#160 I NATANYA L PHIPPS I 351 CENTRAL AVE","HALEDON"] → ["NATANYA L","PHIPPS"]
- proposed project reference (inferred): PN#160
- proposed property address (inferred): 351 CENTRAL AVE HALEDON
- proposed suite/floor/basement/location notes (inferred): —
- property reuse-or-create (read+inferred): create-new
- raw name preserved for audit (inferred): `PN#160 I NATANYA L PHIPPS I 351 CENTRAL AVE HALEDON`
- match confidence (inferred): medium
- name confident (inferred): true
- possible duplicate candidate(s): none
- proposed action: flag for manual review — do NOT auto-repair

### CRM #8
- CRM record ID (read): 8
- QBO customer ID (read): 318
- current CRM display name (read): `PN# 164 I Anibal Espailla I 75 Woodlawn Avenue Jersey City`
- stored raw display name column (read): null (not yet populated — set on --apply)
- manual-approval / lock status (read): false
- proposed clean contact/company name (inferred): Anibal Espailla
- proposed customer type (inferred): residential
- proposed first/last change (inferred): ["PN# 164 I Anibal Espailla I 75 Woodlawn Avenue Jersey","City"] → ["Anibal","Espailla"]
- proposed project reference (inferred): PN# 164
- proposed property address (inferred): 75 Woodlawn Avenue Jersey City
- proposed suite/floor/basement/location notes (inferred): —
- property reuse-or-create (read+inferred): create-new
- raw name preserved for audit (inferred): `PN# 164 I Anibal Espailla I 75 Woodlawn Avenue Jersey City`
- match confidence (inferred): medium
- name confident (inferred): true
- possible duplicate candidate(s): none
- proposed action: flag for manual review — do NOT auto-repair

### CRM #9
- CRM record ID (read): 9
- QBO customer ID (read): 166
- current CRM display name (read): `PN#132 I PDC I 828 Summer Ave Newark NJ`
- stored raw display name column (read): null (not yet populated — set on --apply)
- manual-approval / lock status (read): false
- proposed clean contact/company name (inferred): PDC
- proposed customer type (inferred): residential
- proposed first/last change (inferred): ["PN#132 I PDC I 828 Summer Ave Newark","NJ"] → ["PDC",null]
- proposed project reference (inferred): PN#132
- proposed property address (inferred): 828 Summer Ave Newark NJ
- proposed suite/floor/basement/location notes (inferred): —
- property reuse-or-create (read+inferred): create-new
- raw name preserved for audit (inferred): `PN#132 I PDC I 828 Summer Ave Newark NJ`
- match confidence (inferred): medium
- name confident (inferred): true
- possible duplicate candidate(s): none
- proposed action: flag for manual review — do NOT auto-repair

### CRM #10
- CRM record ID (read): 10
- QBO customer ID (read): 316
- current CRM display name (read): `PN #163 I Colbert Watson I 360 Littleton Ave, Newark NJ 07103`
- stored raw display name column (read): null (not yet populated — set on --apply)
- manual-approval / lock status (read): false
- proposed clean contact/company name (inferred): Colbert Watson
- proposed customer type (inferred): residential
- proposed first/last change (inferred): ["PN #163 I Colbert Watson I 360 Littleton Ave, Newark NJ","07103"] → ["Colbert","Watson"]
- proposed project reference (inferred): PN #163
- proposed property address (inferred): 360 Littleton Ave, Newark NJ 07103
- proposed suite/floor/basement/location notes (inferred): —
- property reuse-or-create (read+inferred): create-new
- raw name preserved for audit (inferred): `PN #163 I Colbert Watson I 360 Littleton Ave, Newark NJ 07103`
- match confidence (inferred): medium
- name confident (inferred): true
- possible duplicate candidate(s): none
- proposed action: flag for manual review — do NOT auto-repair

## Confirmations

- Migration 0038 was applied successfully.
- No repair apply mode was run.
- No automatic contact merges occurred.
- No production customer or property records were changed.
- Nothing was deployed.

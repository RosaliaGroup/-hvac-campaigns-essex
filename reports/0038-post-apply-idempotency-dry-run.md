# QBO Composite-Name Repair — Post-Migration Dry-Run Report

**Mode:** post-migration, DRY RUN. `--apply` not supplied, ZERO writes.

## Run context

- Command: `npx tsx scripts/repair-qbo-composite-names.ts`
- Target: Railway project `captivating-energy`, environment **production**, db `railway` (via `MYSQL_PUBLIC_URL`).
- Migration 0038: **APPLIED**. New audit/lock columns are now read: `quickbooksRawDisplayName`, `projectReference`, `displayNameManuallyApproved` (customers); `locationNotes`, `projectReference` (properties).

## Totals

- total customer records scanned (whole table): **23**
- candidate records scanned (pipe OR anchored PN/Project/Job/WO prefix): **4**
- composite records detected: **4**
- high-confidence repair candidates (apply-eligible): **0**
- medium/low manual-review records: **4**
- manually-approved records skipped: **0**
- already-clean records skipped: **0**
- non-composite records skipped: **0**
- existing properties reused (proposed): **0**
- proposed new properties: **4**
- possible duplicate contacts: **0**
- **automatic merges performed: 0**
- **database writes performed: 0**

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

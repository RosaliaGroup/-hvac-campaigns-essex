# QBO Composite-Name Repair — Pre-Migration Dry-Run Report

**Mode:** pre-migration, READ-ONLY. No migration applied, `--apply` not supplied, no writes.

## Run context

- Exact command: `npx tsx scripts/repair-qbo-composite-names.ts --pre-migration` (no `--apply`).
- Target: Railway project `captivating-energy`, environment **production**, MySQL via `MYSQL_PUBLIC_URL` proxy (db `railway`). Migration 0038 NOT applied.
- SQL statements: **14** (all read-only). Database writes: **0**.
- Delimiter: production uses a corrupted-pipe `I` (U+0049); the parser recovers it.
- **Classification fix (this run):** company detection now uses the CLEAN parsed name, not stale first/last. **CRM #15 `Cushman & Wakefield` is now commercial/company** (was residential/person). No other record changed classification. Company repairs clear stale person first/last so they cannot later override the company class.

Field provenance legend:
- **read** — value read from the current production database.
- **inferred** — computed by the parser; would only be written after migration 0038 + explicit `--apply`.
- **unavailable** — column does not exist until migration 0038 is applied.

## Totals

- total customer records scanned (whole table): **23**
- candidate records scanned (pipe OR anchored PN/Project/Job/WO prefix): **9**
- confident repair candidates: **5**
- ambiguous records flagged / skipped for manual review: **4**
- manually-approved records skipped: **0** (approval column does not exist pre-migration — see note)
- non-composite records skipped: **0**
- existing properties reused: **0**
- proposed new properties: **9**
- possible duplicate contacts: **0**
- **automatic merges performed: 0**
- **database writes performed: 0**

> Note: `displayNameManuallyApproved` cannot be read pre-migration, so manually-approved records cannot be counted here. This is a schema limitation, NOT proof that no name was manually corrected. Conservative heuristics below flag such records instead of repairing them.

## SQL audit (read-only proof)

Read-only verified: **YES**. Statements issued, in order:

```sql
SET SESSION TRANSACTION READ ONLY
START TRANSACTION READ ONLY
SELECT id, type, displayName, companyName, firstName, lastName, email, phone, quickbooksCustomerId FROM customers WHERE displayName LIKE '%|%' OR REGEXP_LIKE(displayName, '^[[:space:]]*(PN|PROJECT|PRO …
SELECT id, displayName, email, phone, quickbooksCustomerId FROM customers
SELECT id, addressLine1 FROM properties WHERE customerId = ?
SELECT id, addressLine1 FROM properties WHERE customerId = ?
SELECT id, addressLine1 FROM properties WHERE customerId = ?
SELECT id, addressLine1 FROM properties WHERE customerId = ?
SELECT id, addressLine1 FROM properties WHERE customerId = ?
SELECT id, addressLine1 FROM properties WHERE customerId = ?
SELECT id, addressLine1 FROM properties WHERE customerId = ?
SELECT id, addressLine1 FROM properties WHERE customerId = ?
SELECT id, addressLine1 FROM properties WHERE customerId = ?
ROLLBACK
```

## Confident repair candidates (would repair only AFTER migration + --apply) (5)

### CRM #11
- CRM record ID (read): 11
- QBO customer ID (read): 320
- current CRM display name (read): `PN#165 I Cynthia Rodriguez I 36 Stuyvesant Rd, Teaneck, NJ 07666`
- original raw display name (unavailable): not available — migration 0038 not applied
- manual-approval / lock status (unavailable): false/not locked — approval column does not exist (schema limitation; NOT proof the name was never manually corrected)
- proposed clean contact/company name (inferred): Cynthia Rodriguez
- proposed customer type (inferred): residential
- proposed project reference (inferred): PN#165
- proposed property address (inferred): 36 Stuyvesant Rd, Teaneck, NJ 07666
- proposed suite/floor/basement/location notes (inferred): —
- property reuse-or-create (read+inferred): create-new
- match confidence (inferred): high
- reason(s): pipe-delimited composite; parser confidence high; project code + plausible name + confident address boundary
- possible duplicate candidate(s): none
- proposed action: repair AFTER migration 0038 + explicit --apply approval

### CRM #12
- CRM record ID (read): 12
- QBO customer ID (read): 329
- current CRM display name (read): `PN#167 I Anthony Paladino I 689 Elm St, Maywood, NJ`
- original raw display name (unavailable): not available — migration 0038 not applied
- manual-approval / lock status (unavailable): false/not locked — approval column does not exist (schema limitation; NOT proof the name was never manually corrected)
- proposed clean contact/company name (inferred): Anthony Paladino
- proposed customer type (inferred): residential
- proposed project reference (inferred): PN#167
- proposed property address (inferred): 689 Elm St, Maywood, NJ
- proposed suite/floor/basement/location notes (inferred): —
- property reuse-or-create (read+inferred): create-new
- match confidence (inferred): high
- reason(s): pipe-delimited composite; parser confidence high; project code + plausible name + confident address boundary
- possible duplicate candidate(s): none
- proposed action: repair AFTER migration 0038 + explicit --apply approval

### CRM #14
- CRM record ID (read): 14
- QBO customer ID (read): 334
- current CRM display name (read): `PN#171 I Helen Espiallat I 1600 Center Ave, Fort Lee, NJ`
- original raw display name (unavailable): not available — migration 0038 not applied
- manual-approval / lock status (unavailable): false/not locked — approval column does not exist (schema limitation; NOT proof the name was never manually corrected)
- proposed clean contact/company name (inferred): Helen Espiallat
- proposed customer type (inferred): residential
- proposed project reference (inferred): PN#171
- proposed property address (inferred): 1600 Center Ave, Fort Lee, NJ
- proposed suite/floor/basement/location notes (inferred): —
- property reuse-or-create (read+inferred): create-new
- match confidence (inferred): high
- reason(s): pipe-delimited composite; parser confidence high; project code + plausible name + confident address boundary
- possible duplicate candidate(s): none
- proposed action: repair AFTER migration 0038 + explicit --apply approval

### CRM #15
- CRM record ID (read): 15
- QBO customer ID (read): 338
- current CRM display name (read): `PN#172 I Cushman & Wakefield I 28th Floor 444 Madison Avenue, New York, NY 10022`
- original raw display name (unavailable): not available — migration 0038 not applied
- manual-approval / lock status (unavailable): false/not locked — approval column does not exist (schema limitation; NOT proof the name was never manually corrected)
- proposed clean contact/company name (inferred): Cushman & Wakefield
- proposed customer type (inferred): commercial
- proposed project reference (inferred): PN#172
- proposed property address (inferred): 28th Floor 444 Madison Avenue, New York, NY 10022
- proposed suite/floor/basement/location notes (inferred): 28th Floor
- property reuse-or-create (read+inferred): create-new
- match confidence (inferred): high
- reason(s): pipe-delimited composite; parser confidence high; project code + plausible name + confident address boundary
- possible duplicate candidate(s): none
- proposed action: repair AFTER migration 0038 + explicit --apply approval

### CRM #23
- CRM record ID (read): 23
- QBO customer ID (read): 354
- current CRM display name (read): `PN-173-B I Marco Weber I 9005 Smith Ave, North Bergen, NJ 07047 I Basement I`
- original raw display name (unavailable): not available — migration 0038 not applied
- manual-approval / lock status (unavailable): false/not locked — approval column does not exist (schema limitation; NOT proof the name was never manually corrected)
- proposed clean contact/company name (inferred): Marco Weber
- proposed customer type (inferred): residential
- proposed project reference (inferred): PN-173-B
- proposed property address (inferred): 9005 Smith Ave, North Bergen, NJ 07047
- proposed suite/floor/basement/location notes (inferred): Basement I
- property reuse-or-create (read+inferred): create-new
- match confidence (inferred): high
- reason(s): pipe-delimited composite; parser confidence high; project code + plausible name + confident address boundary
- possible duplicate candidate(s): none
- proposed action: repair AFTER migration 0038 + explicit --apply approval

## Flagged for manual review (NOT auto-repaired) (4)

### CRM #7
- CRM record ID (read): 7
- QBO customer ID (read): 322
- current CRM display name (read): `PN#160 I NATANYA L PHIPPS I 351 CENTRAL AVE HALEDON`
- original raw display name (unavailable): not available — migration 0038 not applied
- manual-approval / lock status (unavailable): false/not locked — approval column does not exist (schema limitation; NOT proof the name was never manually corrected)
- proposed clean contact/company name (inferred): NATANYA L PHIPPS
- proposed customer type (inferred): residential
- proposed project reference (inferred): PN#160
- proposed property address (inferred): 351 CENTRAL AVE HALEDON
- proposed suite/floor/basement/location notes (inferred): —
- property reuse-or-create (read+inferred): create-new
- match confidence (inferred): medium
- reason(s): pipe-delimited composite; parser confidence high; service address parsed without a confident city/state tail
- possible duplicate candidate(s): none
- proposed action: flag for manual review — do NOT auto-repair

### CRM #8
- CRM record ID (read): 8
- QBO customer ID (read): 318
- current CRM display name (read): `PN# 164 I Anibal Espailla I 75 Woodlawn Avenue Jersey City`
- original raw display name (unavailable): not available — migration 0038 not applied
- manual-approval / lock status (unavailable): false/not locked — approval column does not exist (schema limitation; NOT proof the name was never manually corrected)
- proposed clean contact/company name (inferred): Anibal Espailla
- proposed customer type (inferred): residential
- proposed project reference (inferred): PN# 164
- proposed property address (inferred): 75 Woodlawn Avenue Jersey City
- proposed suite/floor/basement/location notes (inferred): —
- property reuse-or-create (read+inferred): create-new
- match confidence (inferred): medium
- reason(s): pipe-delimited composite; parser confidence high; service address parsed without a confident city/state tail
- possible duplicate candidate(s): none
- proposed action: flag for manual review — do NOT auto-repair

### CRM #9
- CRM record ID (read): 9
- QBO customer ID (read): 166
- current CRM display name (read): `PN#132 I PDC I 828 Summer Ave Newark NJ`
- original raw display name (unavailable): not available — migration 0038 not applied
- manual-approval / lock status (unavailable): false/not locked — approval column does not exist (schema limitation; NOT proof the name was never manually corrected)
- proposed clean contact/company name (inferred): PDC
- proposed customer type (inferred): residential
- proposed project reference (inferred): PN#132
- proposed property address (inferred): 828 Summer Ave Newark NJ
- proposed suite/floor/basement/location notes (inferred): —
- property reuse-or-create (read+inferred): create-new
- match confidence (inferred): medium
- reason(s): pipe-delimited composite; parser confidence high; service address parsed without a confident city/state tail
- possible duplicate candidate(s): none
- proposed action: flag for manual review — do NOT auto-repair

### CRM #10
- CRM record ID (read): 10
- QBO customer ID (read): 316
- current CRM display name (read): `PN #163 I Colbert Watson I 360 Littleton Ave, Newark NJ 07103`
- original raw display name (unavailable): not available — migration 0038 not applied
- manual-approval / lock status (unavailable): false/not locked — approval column does not exist (schema limitation; NOT proof the name was never manually corrected)
- proposed clean contact/company name (inferred): Colbert Watson
- proposed customer type (inferred): residential
- proposed project reference (inferred): PN #163
- proposed property address (inferred): 360 Littleton Ave, Newark NJ 07103
- proposed suite/floor/basement/location notes (inferred): —
- property reuse-or-create (read+inferred): create-new
- match confidence (inferred): medium
- reason(s): pipe-delimited composite; parser confidence high; service address parsed without a confident city/state tail
- possible duplicate candidate(s): none
- proposed action: flag for manual review — do NOT auto-repair

## Confirmations

- No repair apply mode was run.
- No automatic contact merges occurred.
- No production customer or property records were changed.
- No migration was applied without authorization.
- Nothing was deployed.

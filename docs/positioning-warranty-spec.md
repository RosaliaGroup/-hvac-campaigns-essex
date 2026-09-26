# Positioning Update — Installation-Led Messaging + Optional 10-Year Parts & Labor Coverage (Spec)
Repo location: `docs/positioning-warranty-spec.md`
Branch: `positioning-warranty`. One PR, Netlify preview, human merge. No auto-lane.
Owner decisions (2026-09-26): coverage is **optional** (priced per system), also available as **standalone coverage for existing systems subject to eligibility**, and the **administrator is not named in marketing copy** (named only in the written agreement and on the terms page's disclosure line).

## 1. Facts (`shared/verifiedFacts.ts`)
```ts
warranty: {
  headline: "10-Year Parts & Labor Coverage",
  years: 10,
  covers: "parts and labor",
  deductible: 0,
  included: false,
  availableFor: [
    "new HVAC installations by Mechanical Enterprise",
    "existing systems that pass an eligibility inspection",
  ],
  brands: "all major brands",
  administration: "third-party extended service agreement, backed by A-rated insurers",
  eligibilityNote: "existing equipment subject to inspection and program criteria",
  termsUrl: "/warranty",
  verifiedOn: "2026-09-26",
  source: "owner-attested; provider contractor program",
},
```

## 2. Linter additions (`shared/seoLinter.ts`, extended linter for body content)
BLOCK:
- "included", "free warranty", "comes with", "every install includes", "standard on all" within 80 chars of "warranty"/"coverage"
- "lifetime", "unlimited", "no questions asked", "guaranteed for life"
- "manufacturer's warranty" presented as Mechanical Enterprise's coverage
- A year count other than 10 next to "warranty"/"coverage"
- Any provider/administrator brand name in title, meta, H1 or body of marketing pages (allowed only on `/warranty` terms disclosure block and in the agreement PDF)
- Existing-system coverage mentioned without "eligib" or "qualif" in the same sentence
WARN:
- "10-year" not followed by "parts & labor" / "parts and labor" on first use in the page

## 3. New page `/warranty` (public, indexable, `Service` + `FAQPage` schema, breadcrumb → Residential)
Title: `10-Year Parts & Labor HVAC Coverage in NJ | Mechanical Enterprise` (≤60: use "10-Year Parts & Labor HVAC Coverage | Mechanical Enterprise")
Meta: `Optional 10-year parts and labor coverage for new HVAC installations and qualifying existing systems in New Jersey. No deductible on covered repairs. Call (862) 423-9396.`

Body (use verbatim, edit only for accuracy against the provider's terms PDF):

> # 10-Year Parts & Labor Coverage for Your HVAC System
> Optional extended coverage for new installations and for qualifying existing systems — so a compressor, control board or blower failure in year six doesn't become a four-figure bill.
>
> ## What it covers
> Parts and labor for covered repairs on the enrolled equipment for 10 years from the coverage start date. No deductible on covered claims. Available for all major brands.
>
> ## Who can enroll
> **New installations.** Any system installed by Mechanical Enterprise can add coverage at the time of installation or within the enrollment window stated in your agreement.
>
> **Existing systems.** Coverage may be available for equipment we didn't install, subject to an eligibility inspection. Systems must be in good working condition and meet the program's age and maintenance criteria. We'll tell you at the inspection whether the system qualifies and what the coverage costs.
>
> ## How it works
> Coverage is provided through a third-party extended service agreement backed by A-rated insurers and administered independently of Mechanical Enterprise. You receive the written agreement at enrollment; it is the governing document and lists exact terms, exclusions and the claims process. Covered repairs are performed by Mechanical Enterprise.
>
> ## What it doesn't cover
> Routine maintenance, filters and consumables, refrigerant top-offs not tied to a covered repair, damage from neglect, accident or improper use, and pre-existing conditions on existing equipment. See the written agreement for the full list.
>
> ## Frequently asked questions
> **Is coverage required?** No. It's an optional add-on, quoted with your installation or after an eligibility inspection.
> **Does coverage transfer if I sell the property?** [CONFIRM WITH PROVIDER TERMS — typical programs allow one transfer.]
> **Is maintenance required?** [CONFIRM — if the program requires annual maintenance, state it here.]
> **How do I file a claim?** Call Mechanical Enterprise at (862) 423-9396. We diagnose the issue, confirm coverage with the administrator, and complete the repair.
>
> ## Pricing
> Coverage is priced per system and quoted with your installation or after the eligibility inspection.
> **[Request a coverage quote]** — CTA to the proposal-request form with `form_type=warranty_quote`.
>
> <small>Terms disclosure: Extended service agreements are administered by [PROVIDER LEGAL NAME] and underwritten by [INSURER(S) AS STATED IN THE AGREEMENT]. Full terms: [link to provider terms PDF].</small>

## 4. Existing-page changes (title/meta via the overrides file; body via component edits)
- **Homepage:** hero leads with installation quality + optional 10-year parts & labor coverage; rebate band moves below as "Rebates and financing may reduce your cost" (keep the calculator link). Title: `NJ HVAC Installation with 10-Year Parts & Labor Coverage | Mechanical Enterprise` (trim to ≤60).
- **`/residential`, `/heat-pump-installation-nj`, `/central-ac-installation-nj`, `/ductless-mini-split-installation-nj`, `/vrv-vrf-installation-nj`:** add a "Protect the investment" section (3–4 sentences from §3 + link to `/warranty`), CTA "Add 10-year coverage", and a one-line mention in the meta. Do not remove rebate content; demote it below the warranty section.
- **`/commercial`:** one sentence + link (commercial equipment is eligible for the same optional coverage). Nothing else.
- **`/maintenance`:** cross-link — maintenance plan customers keep coverage in good standing if the program requires maintenance.
- **Footer:** add "10-Year Coverage" link to `/warranty`.
- **Jessica/Vapi prompts** (`jessica-inbound-prompt.md`): add a two-line answer for "do you offer a warranty" — optional 10-year parts & labor coverage, quoted with the install, eligibility inspection for existing systems. Owner reviews before the Vapi prompt is updated in the dashboard (not automated).

## 5. Content queue changes (`content_queue`)
Remove any queued residential/rebate topics. Add, in this order:
1. What a 10-year HVAC warranty should actually cover (parts vs labor vs manufacturer)
2. Extended coverage for an older HVAC system: when it's worth it and what "eligible" means
3. How to compare HVAC installation quotes in NJ (equipment, labor, warranty, permits)
4. Heat pump vs furnace replacement: total cost of ownership over 10 years
5. Why compressor failures happen in years 5–8 and what protects you
Keep all existing B2B topics; the PTAC package stays as-is.

## 6. Drafting-prompt positioning (meta lane + content lane)
Add to both system prompts: "Lead with installation quality, system fit and the optional 10-year parts & labor coverage. Mention rebates only as a secondary benefit and only using figures from VERIFIED_FACTS. Never describe coverage as included or free."

## 7. Tracking
New form_type `warranty_quote`; GA4 key event; CRM lead type. Report warranty quotes separately in the weekly summary.

## 8. Acceptance
- Linter blocks "free 10-year warranty", "lifetime", a provider name in a meta, and "existing systems covered" without "eligibility".
- `/warranty` renders, indexable, schema valid, both CTAs post to the form with `warranty_quote`.
- Homepage hero and five install pages show the warranty section; rebate content still present below.
- No change to `/promos`, case studies, city pages, or locked pages.
- Owner fills the two [CONFIRM] FAQ lines and the terms-disclosure line before merge; the PR is blocked with a checklist until they're filled.

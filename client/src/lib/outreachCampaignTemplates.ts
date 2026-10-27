/** Draft-only templates from the October 2026 commercial campaign kit.
 * Bracketed details must be personalized and verified before queue intake.
 */
export const outreachCampaignTemplates = {
  propertyManagement: {
    label: "Fall HVAC readiness — property managers",
    subject: "Fall HVAC planning for [Company]'s NJ properties",
    body: "Hi [First Name],\n\nI'm reaching out from Mechanical Enterprise. We support NJ property managers with commercial and multifamily HVAC maintenance, repairs, equipment replacements, and planning across multiple buildings.\n\nWith colder weather approaching, would it be useful to review any properties that need a fall HVAC inspection, service coverage, or replacement plan? We can also discuss portfolio pricing if you manage multiple sites.\n\nAna\nMechanical Enterprise LLC",
  },
  condoPtac: {
    label: "Condo and PTAC replacement planning",
    subject: "PTAC replacement planning for [Building/Association]",
    body: "Hi [First Name],\n\nMechanical Enterprise helps NJ condo and apartment properties plan HVAC repairs and replacements, including PTAC and through-wall systems. For occupied buildings, we can assess existing equipment, identify recurring failures, and discuss a phased replacement approach.\n\nIs [Building/Association] reviewing aging equipment or planning a capital budget for HVAC?\n\nAna\nMechanical Enterprise LLC",
  },
  contractors: {
    label: "General contractors and developers",
    subject: "HVAC subcontractor availability for [Project/Company]",
    body: "Hi [First Name],\n\nI'm with Mechanical Enterprise, a NJ HVAC contractor supporting commercial and multifamily installation, retrofit, and replacement scopes.\n\nIf [Company] has upcoming mechanical bid packages or occupied-building HVAC projects, we'd welcome the opportunity to review drawings, schedule, and scope. Is there an estimator or project manager we should coordinate with?\n\nAna\nMechanical Enterprise LLC",
  },
  brokers: {
    label: "Commercial brokers and referral partners",
    subject: "HVAC resource for [Company]'s NJ commercial properties",
    body: "Hi [First Name],\n\nMechanical Enterprise works with NJ commercial properties on HVAC service, equipment assessments, maintenance, and replacements.\n\nIf a client is evaluating a building, preparing for tenant improvements, or dealing with aging mechanical equipment, we'd be happy to review the situation and outline options.\n\nWould it be useful to have a local HVAC contact for those requests?\n\nAna\nMechanical Enterprise LLC",
  },
} as const;
export type OutreachCampaignKey = keyof typeof outreachCampaignTemplates;

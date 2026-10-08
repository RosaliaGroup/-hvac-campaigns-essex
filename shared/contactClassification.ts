import type { Relationship } from "./leadPipeline";

/** Email correspondence alone is not evidence of a sales relationship. */
export function contactClassification(
  contact: {
    source?: string | null;
    email?: string | null;
    type: string;
    convertedFromLeadId?: number | null;
    convertedFromCaptureId?: number | null;
  },
  relationship: Relationship,
  hasLeadStages: boolean
) {
  const imported = contact.source === "Gmail Sent";
  const team =
    imported &&
    contact.email?.trim().toLowerCase().endsWith("@mechanicalenterprise.com");
  const unclassified =
    imported &&
    relationship === "lead" &&
    !hasLeadStages &&
    !contact.convertedFromLeadId &&
    !contact.convertedFromCaptureId;
  return {
    lifecycle: team
      ? "Team"
      : unclassified
        ? "Contact"
        : relationship === "customer"
          ? "Customer"
          : relationship === "prospect"
            ? "Prospect"
            : "Lead",
    contactRole: team ? "Team" : "Unclassified",
    serviceType: imported && unclassified ? "Unclassified" : contact.type,
  };
}

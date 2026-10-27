/**
 * Editable, prewritten customer SMS messages for the CRM contact selection tool.
 * Sent content always gets the Mechanical Enterprise sender name and STOP
 * instructions on the SERVER. Presets alone never authorize a send.
 */
export const CUSTOMER_SMS_TEMPLATES = [
  {
    id: "replace-upgrade",
    label: "HVAC replacement or upgrade",
    message: "Hi! Are you considering replacing or upgrading your heating or cooling system? We can review your options and provide an estimate. Reply YES if you'd like us to follow up, or call (862) 423-9396.",
  },
  {
    id: "installation-estimate",
    label: "Request an installation estimate",
    message: "Hi! We help property owners with new AC, furnace and heat-pump installations. Would you like to discuss an estimate for a new system? Reply ESTIMATE and our team can assist, or call (862) 423-9396.",
  },
  {
    id: "efficiency-heat-pump",
    label: "High-efficiency system options",
    message: "Hi! If you're considering a high-efficiency HVAC upgrade or heat pump, our team can discuss suitable systems and review incentives that may apply. Reply INFO if you'd like to talk, or call (862) 423-9396.",
  },
  {
    id: "service-maintenance",
    label: "Heating and cooling service",
    message: "Hi! Need service or maintenance for your heating or cooling equipment? Mechanical Enterprise can help you discuss service options and scheduling. Reply SERVICE if you'd like a callback, or call (862) 423-9396.",
  },
  {
    id: "existing-inquiry-followup",
    label: "Follow-up — prior inquiry only",
    message: "Hi! We're following up on your earlier HVAC service or installation inquiry with Mechanical Enterprise. Are you still looking for help with an estimate or appointment? Reply YES, or call (862) 423-9396.",
  },
] as const;

export function getCustomerSmsTemplate(id: string) {
  return CUSTOMER_SMS_TEMPLATES.find(template => template.id === id);
}

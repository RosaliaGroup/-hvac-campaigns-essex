/**
 * Visibility rule for the inbox "Add to SMS Contacts" prompt.
 *
 *   IF conversation has a linked Customer → hide
 *   ELSE IF conversation has a linked Lead  → hide
 *   ELSE IF phone is already a saved SMS Contact → hide
 *   ELSE → show
 *
 * When a conversation is already tied to a CRM Customer/Lead (or is a saved SMS
 * contact), a separate SMS-contact record is redundant, so the prompt is hidden.
 * Derived from `conversationSendState`.
 */
export type SmsSendStateFlags = {
  hasLinkedCustomer?: boolean | null;
  hasLinkedLead?: boolean | null;
  isContact?: boolean | null;
};

export function shouldOfferAddToSmsContacts(
  state: SmsSendStateFlags | null | undefined,
): boolean {
  if (!state) return false; // send-state not loaded yet → don't flash the prompt
  if (state.hasLinkedCustomer) return false;
  if (state.hasLinkedLead) return false;
  if (state.isContact) return false;
  return true;
}

import { describe, expect, it } from "vitest";
import { CUSTOMER_SMS_TEMPLATES, getCustomerSmsTemplate } from "./customerSmsTemplates";

describe("Mechanical customer text templates", () => {
  it("offers multiple distinct editable HVAC text options", () => {
    expect(CUSTOMER_SMS_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(CUSTOMER_SMS_TEMPLATES.map(t => t.id)).size).toBe(CUSTOMER_SMS_TEMPLATES.length);
    expect(getCustomerSmsTemplate("replace-upgrade")?.label).toMatch(/replacement or upgrade/i);
  });
  it("uses the corrected business number and leaves STOP branding to the server", () => {
    for (const template of CUSTOMER_SMS_TEMPLATES) {
      expect(template.message).toContain("(862) 423-9396");
      expect(template.message).not.toContain("201-449-6850");
      expect(template.message).not.toMatch(/reply STOP/i);
      expect(template.message.length).toBeLessThanOrEqual(1200);
    }
  });
  it("explicitly identifies follow-up wording as only for previous inquiries", () => {
    expect(getCustomerSmsTemplate("existing-inquiry-followup")?.label).toMatch(/prior inquiry/i);
    expect(getCustomerSmsTemplate("missing")).toBeUndefined();
  });
});

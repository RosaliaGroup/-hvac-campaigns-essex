import { describe, expect, it } from "vitest";
import { quoteNotificationContact } from "./quoteNotification";
const body =
  "CONTACT INFO\nNameSample Contact Emailclient@example.com Phone(201) 555-0100\nREQUEST DETAILS\nService RequestedHeat Pump Installation";
describe("website quote notification attribution", () => {
  it("recognizes the generated template and extracts the requester", () =>
    expect(
      quoteNotificationContact(
        "noreply@mechanicalenterprise.com",
        "New Quote Request – Sample Contact",
        body
      )
    ).toEqual({ email: "client@example.com", name: "Sample Contact" }));
  it("does not reattribute ordinary forwarded email or external senders", () => {
    expect(
      quoteNotificationContact(
        "other@example.com",
        "New Quote Request – Sample Contact",
        body
      )
    ).toBeNull();
    expect(
      quoteNotificationContact(
        "noreply@mechanicalenterprise.com",
        "Other message",
        body
      )
    ).toBeNull();
    expect(
      quoteNotificationContact(
        "noreply@mechanicalenterprise.com",
        "New Quote Request – Sample Contact",
        "hello client@example.com"
      )
    ).toBeNull();
  });
});

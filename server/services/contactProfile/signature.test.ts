import { expect, it } from "vitest";
import { signatureCompany } from "./signature";
const contact = {
  name: "Sample Person",
  email: "sample@examplepropertymanagement.com",
};
const message = {
  fromAddress: contact.email,
  providerMessageId: "abc123",
  body: "Thank you\nSample Person\nManaging Member\nExample Property Management\nEmail: sample@examplepropertymanagement.com",
};
it("uses a sender signature and matching company domain", () => {
  expect(signatureCompany(contact, message).name?.value).toBe(
    "Example Property Management"
  );
});
it("rejects another sender, quoted signatures, and personal email domains", () => {
  expect(
    signatureCompany(contact, { ...message, fromAddress: "other@example.com" })
  ).toEqual({});
  expect(
    signatureCompany(contact, {
      ...message,
      body: `On Monday someone wrote:\n${message.body}`,
    })
  ).toEqual({});
  expect(
    signatureCompany(
      { ...contact, email: "sample@gmail.com" },
      { ...message, fromAddress: "sample@gmail.com" }
    )
  ).toEqual({});
});

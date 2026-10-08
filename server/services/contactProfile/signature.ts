import { businessDomain } from "./research";
import type { ContactProfile } from "../../../shared/contactProfile";

// Only inspect the sender's current message, never quoted correspondence.
export function signatureCompany(
  contact: { name: string; email?: string | null },
  message: {
    fromAddress?: string | null;
    body?: string | null;
    providerMessageId?: string | null;
  }
): ContactProfile["company"] {
  if (
    !contact.email ||
    message.fromAddress?.toLowerCase() !== contact.email.toLowerCase()
  )
    return {};
  const domain = businessDomain(contact.email);
  if (
    !domain ||
    !message.providerMessageId ||
    !/^[a-zA-Z0-9_-]+$/.test(message.providerMessageId)
  )
    return {};
  const lines = (message.body || "").split(/\r?\n/);
  const quote = lines.findIndex(line =>
    /^\s*(>|On .+wrote:|From:|-----Original Message)/i.test(line)
  );
  const own = (quote < 0 ? lines : lines.slice(0, quote))
    .map(line => line.replace(/[*\u200b]/g, "").trim())
    .filter(Boolean);
  const compact = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nameIndex = own.findIndex(
    line => compact(line) === compact(contact.name)
  );
  if (nameIndex < 0) return {};
  const company = own
    .slice(nameIndex + 1, nameIndex + 5)
    .find(
      line =>
        line.length <= 150 &&
        /^[a-zA-Z][a-zA-Z0-9 &,.'()-]+$/.test(line) &&
        compact(line) ===
          compact(domain.replace(/^www\./, "").replace(/\.[^.]+$/, ""))
    );
  if (!company) return {};
  const source = `https://mail.google.com/mail/u/?authuser=sales%40mechanicalenterprise.com#all/${message.providerMessageId}`;
  const evidence = `Email signature from ${contact.email}: ${contact.name}, ${company}`;
  return {
    name: { value: company, source, evidence },
    website: { value: `https://${domain}`, source, evidence },
  };
}

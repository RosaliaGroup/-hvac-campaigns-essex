/** Only recognize the application's own quote-notification template. */
export function quoteNotificationContact(
  from: string,
  subject: string,
  body: string
) {
  if (
    from.trim().toLowerCase() !== "noreply@mechanicalenterprise.com" ||
    !/^New Quote Request\s*[–—-]\s*/i.test(subject) ||
    !/CONTACT INFO/i.test(body) ||
    !/REQUEST DETAILS/i.test(body)
  )
    return null;
  const email = body
    .match(
      /\bEmail\s*:?\s*([A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,})(?=\s|$)/i
    )?.[1]
    .toLowerCase();
  if (!email || email.endsWith("@mechanicalenterprise.com")) return null;
  const name = subject.replace(/^New Quote Request\s*[–—-]\s*/i, "").trim();
  return { email, name: name || email };
}

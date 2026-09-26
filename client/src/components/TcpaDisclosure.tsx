/**
 * Shared TCPA/consent disclosure line, rendered under every lead-capture form's
 * submit button. One component so the wording can't drift between forms — see
 * shared/leadFormVersion.ts's TCPA_FORM_VERSION, which every form's submit
 * payload must also carry (server/routers.ts's leadCaptures.create only seeds
 * consentStatus="opt_in" when the two agree).
 */
export function TcpaDisclosure({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-[10px] text-center text-muted-foreground leading-tight"}>
      By submitting, you consent to receive calls and text messages (including by
      automated technology) from Mechanical Enterprise about your request, at the
      number/email provided. Consent is not a condition of purchase. Msg &amp; data
      rates may apply. Reply STOP to opt out, HELP for help.{" "}
      <a href="/privacy" className="underline hover:text-foreground">
        Privacy Policy
      </a>
      .
    </p>
  );
}

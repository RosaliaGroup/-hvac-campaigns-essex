import { useLocation } from "wouter";
import { recordNavPath } from "@/lib/recordNav";

/**
 * Renders a Lead / Contact / Customer name that navigates to the canonical
 * record (Customer when linked, else Lead) — or plain text when no stable id
 * exists. Never navigates by phone/email. Reused across every surface that
 * shows a person/company name (appointments, inbox, jobs, estimates, invoices).
 */
export function ClickableRecordName({
  customerId,
  leadId,
  name,
  className,
}: {
  customerId?: number | null;
  leadId?: number | null;
  name: string;
  className?: string;
}) {
  const [, navigate] = useLocation();
  const path = recordNavPath({ customerId, leadId });
  if (!path) return <>{name}</>;
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        navigate(path);
      }}
      title="Open customer record"
      className={
        className ??
        "text-left p-0 m-0 bg-transparent border-0 cursor-pointer text-[#1e3a5f] hover:underline font-[inherit]"
      }
    >
      {name}
    </button>
  );
}

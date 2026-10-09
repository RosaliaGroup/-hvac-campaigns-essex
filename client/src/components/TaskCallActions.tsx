import { useState } from "react";
import { Phone, Save } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Outcome = "attempted_no_answer" | "connected" | "not_interested";
type Props = {
  contactId: number;
  contactName: string;
  phone: string | null;
  phoneType?: "business" | "cell" | "unknown" | null;
  disabled?: boolean;
  onOutcome: (outcome: Outcome, note?: string) => void;
  onRefresh: () => void;
};
function dialable(phone: string) {
  const normalized = phone.replace(/[^+0-9]/g, "");
  return /^\+?\d{10,15}$/.test(normalized) ? normalized : null;
}

/** Opens the device's dialer, then logs an explicit human-reported call outcome.
 *  This does not claim the browser has placed or recorded a provider call. */
export default function TaskCallActions({
  contactId, contactName, phone, phoneType, disabled, onOutcome, onRefresh,
}: Props) {
  const [showLog, setShowLog] = useState(false);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [error, setError] = useState("");
  const utils = trpc.useUtils();
  const save = trpc.crmCommunications.saveContactCard.useMutation({
    onSuccess: async () => {
      try {
        const card = await utils.crmCommunications.contactCard.fetch({ id: contactId });
        if (!card.phone || card.phone.replace(/\D/g, "") !== newPhone.replace(/\D/g, "")) {
          throw new Error("Saved number could not be verified in CRM.");
        }
        setEditing(false);
        setError("");
        onRefresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not verify the saved phone number.");
      }
    },
    onError: e => setError(e.message),
  });
  const number = phone ? dialable(phone) : null;
  const record = (outcome: Outcome) => {
    if (!number) return;
    if (!window.confirm("Confirm that you actually called this contact and want to record this outcome in CRM.")) return;
    onOutcome(outcome, note.trim() || undefined);
  };
  return <div className="flex w-full flex-col gap-2 items-start">
    {number ? <>
      <div className="flex flex-wrap items-center gap-2 w-full">
        <span className="text-sm font-medium tabular-nums" aria-label="Contact phone number">{phone}</span>
        <span className="text-xs text-slate-600">{phoneType === "cell" ? "Verified cell" : phoneType === "business" ? "Business phone" : "Type unverified"}</span>
        <a href={`tel:${number}`} onClick={() => setShowLog(true)}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
          <Phone className="mr-1 h-4 w-4"/>Call
        </a>
        <Button size="sm" variant="outline" className="min-h-11" onClick={() => setShowLog(v => !v)}>
          {showLog ? "Hide call log" : "Log call"}
        </Button>
      </div>
      {showLog && <div className="flex w-full flex-col gap-2 rounded-lg border bg-slate-50 p-3 max-w-md">
        <p className="text-xs text-slate-600">The Call button opens your device dialer. Record the result after your attempt; no call is automatically logged or recorded.</p>
        <Input aria-label="Optional call notes" placeholder="Call notes (optional)" maxLength={1000}
          value={note} onChange={e => setNote(e.target.value)}/>
        <div className="flex flex-wrap gap-2 [&>button]:min-h-11">
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => record("attempted_no_answer")}>No answer</Button>
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => record("connected")}>Spoke · handoff</Button>
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => record("not_interested")}>Not interested</Button>
        </div>
      </div>}
    </> : <>
      <span className="text-xs text-amber-700">No valid phone number saved in CRM</span>
      {!editing ? <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Add phone number</Button> :
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="Contact phone number" placeholder="Verified business phone number"
            value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-52"/>
          <Button size="sm" disabled={save.isPending || !dialable(newPhone)}
            onClick={() => save.mutate({ id: contactId, name: contactName || "CRM contact", phone: newPhone })}>
            <Save className="h-4 w-4 mr-1"/>Save
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
        </div>}
      {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
    </>}
  </div>;
}

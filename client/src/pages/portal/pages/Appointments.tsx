import { useState, type FormEvent } from "react";
import { CalendarClock, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { AsyncSection, PortalPageHeader, StatusBadge, InlineSpinner } from "../components/common";
import { formatDate, humanize, apptStatusTone } from "../lib/format";

const REQUESTABLE_TYPES = [
  "service_call",
  "maintenance",
  "estimate",
  "inspection",
  "installation",
  "warranty",
  "free_consultation",
  "other",
] as const;

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "rescheduled", "arrived"]);

export default function PortalAppointments() {
  const query = trpc.portal.appointments.list.useQuery(undefined, { retry: false });
  const { toast } = useToast();

  const cancel = trpc.portal.appointments.cancel.useMutation({
    onSuccess: () => {
      toast({ title: "Appointment cancelled" });
      query.refetch();
    },
    onError: (err) => toast({ variant: "destructive", title: "Couldn't cancel", description: err.message }),
  });

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Appointments"
        description="Your scheduled and past visits."
        actions={<RequestDialog onDone={() => query.refetch()} />}
      />
      <AsyncSection
        query={query}
        isEmpty={(rows) => rows.length === 0}
        emptyTitle="No appointments yet"
        emptyDescription="Request a visit and it'll appear here once scheduled."
      >
        {(rows) => (
          <div className="space-y-2">
            {rows.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[#1e3a5f] dark:bg-slate-800 dark:text-slate-200">
                      <CalendarClock className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{humanize(a.appointmentType)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {a.scheduledAt ? formatDate(a.scheduledAt) : `${a.preferredDate} · ${a.preferredTime}`}
                      </p>
                      {a.issueDescription ? (
                        <p className="mt-1 max-w-md truncate text-xs text-slate-400">{a.issueDescription}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge label={humanize(a.status)} tone={apptStatusTone(a.status)} />
                    {ACTIVE_STATUSES.has(a.status) ? (
                      <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" disabled={cancel.isPending} onClick={() => cancel.mutate({ id: a.id })}>
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}

function RequestDialog({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("service_call");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [issue, setIssue] = useState("");

  const request = trpc.portal.appointments.request.useMutation({
    onSuccess: () => {
      toast({ title: "Request sent", description: "We'll confirm your appointment shortly." });
      setOpen(false);
      setPreferredDate("");
      setPreferredTime("");
      setIssue("");
      onDone();
    },
    onError: (err) => toast({ variant: "destructive", title: "Couldn't send request", description: err.message }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    request.mutate({
      appointmentType: type as (typeof REQUESTABLE_TYPES)[number],
      preferredDate,
      preferredTime,
      issueDescription: issue || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
          <Plus className="mr-1.5 h-4 w-4" /> Request visit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request an appointment</DialogTitle>
          <DialogDescription>Tell us what you need and your preferred timing.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="appt-type">Type of visit</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="appt-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REQUESTABLE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {humanize(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="appt-date">Preferred date</Label>
              <Input id="appt-date" type="date" required value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-time">Preferred time</Label>
              <Input id="appt-time" type="text" placeholder="Morning, 2pm…" required value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appt-issue">What's going on? (optional)</Label>
            <Textarea id="appt-issue" rows={3} value={issue} onChange={(e) => setIssue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90" disabled={request.isPending}>
              {request.isPending ? <InlineSpinner className="mr-2" /> : null} Send request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

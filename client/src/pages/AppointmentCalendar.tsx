/**
 * /calendar — Appointment Calendar (Phase 1, Task 4)
 * Month grid built on the existing react-day-picker v9 shadcn wrapper (no new deps).
 * Day cells show status-colored count dots; clicking a day opens a detail Sheet.
 * Unscheduled legacy appointments live in a collapsible backlog with "Set date".
 */
import { useMemo, useState } from "react";
import type { ComponentProps } from "react";
import type { DayButton } from "react-day-picker";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import AppointmentDialog, { type EditableAppointment } from "@/components/AppointmentDialog";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  CalendarClock, CalendarPlus, ChevronDown, Clock, Inbox, Pencil, Phone, UserRound,
} from "lucide-react";

// Status → dot & badge colors (matches badge palette used across dashboards)
const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-green-500",
  completed: "bg-gray-400",
  cancelled: "bg-red-500",
  rescheduled: "bg-blue-500",
};
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  rescheduled: "bg-blue-100 text-blue-700",
};
const TYPE_LABELS: Record<string, string> = {
  free_consultation: "Free Consultation",
  technician_dispatch: "Service Visit",
  maintenance_plan: "Maintenance",
  commercial_assessment: "Commercial Assessment",
};

type Appt = EditableAppointment & {
  customerId?: number | null;
  preferredDate: string;
  preferredTime: string;
  bookedBy?: string | null;
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function timeLabel(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
function dayTitle(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function AppointmentCalendar() {
  const [month, setMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Filters
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<EditableAppointment | null>(null);
  const [createDefaults, setCreateDefaults] = useState<{ scheduledAt?: Date } | undefined>();

  const { data: assignees = [] } = trpc.appointments.assignees.useQuery();

  // Fetch the visible month (pad a week each side so outside days render counts too)
  const from = useMemo(() => new Date(month.getFullYear(), month.getMonth(), -7).toISOString(), [month]);
  const to = useMemo(() => new Date(month.getFullYear(), month.getMonth() + 1, 8).toISOString(), [month]);

  const { data: monthAppts = [], refetch: refetchMonth } = trpc.appointments.list.useQuery({
    from, to, limit: 500,
  });
  const { data: backlog = [], refetch: refetchBacklog } = trpc.appointments.list.useQuery({
    unscheduledOnly: true, limit: 200,
  });

  const refetchAll = () => { refetchMonth(); refetchBacklog(); };

  // Apply filters client-side (a month is small; keeps one fetch per view)
  const matchesFilters = (a: Appt) => {
    if (assigneeFilter !== "all") {
      if (assigneeFilter === "unassigned" ? a.assignedToId != null : String(a.assignedToId) !== assigneeFilter) return false;
    }
    if (statusFilter.length > 0 && !statusFilter.includes(a.status)) return false;
    if (typeFilter !== "all" && a.appointmentType !== typeFilter) return false;
    return true;
  };

  const filtered = useMemo(
    () => (monthAppts as Appt[]).filter(a => a.scheduledAt && matchesFilters(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthAppts, assigneeFilter, statusFilter, typeFilter],
  );
  const filteredBacklog = useMemo(
    () => (backlog as Appt[]).filter(matchesFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [backlog, assigneeFilter, statusFilter, typeFilter],
  );

  // day → status counts
  const byDay = useMemo(() => {
    const map = new Map<string, { total: number; statuses: Record<string, number>; appts: Appt[] }>();
    for (const a of filtered) {
      const key = dayKey(new Date(a.scheduledAt!));
      const entry = map.get(key) ?? { total: 0, statuses: {}, appts: [] };
      entry.total++;
      entry.statuses[a.status] = (entry.statuses[a.status] ?? 0) + 1;
      entry.appts.push(a);
      map.set(key, entry);
    }
    map.forEach(entry => {
      entry.appts.sort((x: Appt, y: Appt) => new Date(x.scheduledAt!).getTime() - new Date(y.scheduledAt!).getTime());
    });
    return map;
  }, [filtered]);

  const selectedDayAppts = selectedDay ? byDay.get(dayKey(selectedDay))?.appts ?? [] : [];

  const assigneeName = (id: number | null | undefined) =>
    id ? assignees.find(a => a.id === id)?.name ?? `#${id}` : "Unassigned";

  // Custom day cell: number + colored count dots. Delegates styling to CalendarDayButton.
  const DayWithCounts = (props: ComponentProps<typeof DayButton>) => {
    const entry = byDay.get(dayKey(props.day.date));
    return (
      <CalendarDayButton {...props}>
        {props.day.date.getDate()}
        {entry && (
          <span className="flex gap-0.5 justify-center">
            {Object.entries(entry.statuses).slice(0, 4).map(([status, count]) => (
              <span key={status} className="flex items-center gap-px">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status] ?? "bg-gray-400"}`} />
                {count > 1 && <span className="text-[9px] leading-none text-muted-foreground">{count}</span>}
              </span>
            ))}
          </span>
        )}
      </CalendarDayButton>
    );
  };

  const openCreate = (day?: Date) => {
    setEditingAppt(null);
    const base = day ?? new Date();
    const at = new Date(base);
    at.setHours(9, 0, 0, 0);
    setCreateDefaults({ scheduledAt: at });
    setDialogOpen(true);
  };
  const openEdit = (a: Appt) => {
    setEditingAppt(a);
    setCreateDefaults(undefined);
    setDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <InternalNav />
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarClock className="h-6 w-6 text-[#1e3a5f]" /> Appointment Calendar
            </h1>
            <p className="text-sm text-muted-foreground">Jessica's bookings and staff bookings, in one view.</p>
          </div>
          <Button className="bg-[#1e3a5f] hover:bg-[#16304f]" onClick={() => openCreate(selectedDay ?? undefined)}>
            <CalendarPlus className="h-4 w-4 mr-1" /> New Appointment
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {assignees.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <ToggleGroup
            type="multiple"
            value={statusFilter}
            onValueChange={setStatusFilter}
            className="flex-wrap"
          >
            {Object.keys(STATUS_DOT).map(s => (
              <ToggleGroupItem key={s} value={s} className="gap-1.5 capitalize text-xs px-2.5" aria-label={s}>
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} /> {s}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Month grid */}
        <Card>
          <CardContent className="pt-6 flex justify-center">
            <Calendar
              mode="single"
              month={month}
              onMonthChange={setMonth}
              selected={selectedDay ?? undefined}
              onSelect={d => setSelectedDay(d ?? null)}
              components={{ DayButton: DayWithCounts }}
              className="[--cell-size:--spacing(14)] md:[--cell-size:--spacing(16)]"
            />
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {Object.entries(STATUS_DOT).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1.5 capitalize">
              <span className={`h-2 w-2 rounded-full ${c}`} /> {s}
            </span>
          ))}
        </div>

        {/* Unscheduled backlog */}
        <Collapsible defaultOpen={filteredBacklog.length > 0}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-amber-600" />
                  Unscheduled ({filteredBacklog.length})
                  <span className="text-xs font-normal text-muted-foreground">— legacy bookings whose date couldn't be parsed</span>
                </CardTitle>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-2">
                {filteredBacklog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing in the backlog. 🎉</p>
                ) : (
                  filteredBacklog.map(a => (
                    <div key={a.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
                      <div>
                        <div className="font-medium">{a.fullName} <span className="text-muted-foreground font-normal">· {TYPE_LABELS[a.appointmentType] ?? a.appointmentType}</span></div>
                        <div className="text-muted-foreground">Wanted: {a.preferredDate} · {a.preferredTime}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={STATUS_BADGE[a.status] ?? ""}>{a.status}</Badge>
                        <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                          <Clock className="h-3.5 w-3.5 mr-1" /> Set date
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Day detail sheet */}
      <Sheet open={selectedDay != null} onOpenChange={v => !v && setSelectedDay(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedDay ? dayTitle(selectedDay) : ""}</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 p-4 pt-2">
            <Button size="sm" variant="outline" className="w-full" onClick={() => openCreate(selectedDay ?? undefined)}>
              <CalendarPlus className="h-4 w-4 mr-1" /> Book on this day
            </Button>
            {selectedDayAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground pt-2">No appointments{statusFilter.length || assigneeFilter !== "all" || typeFilter !== "all" ? " matching the current filters" : ""}.</p>
            ) : (
              selectedDayAppts.map(a => (
                <div key={a.id} className="border rounded-lg p-3 text-sm space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{timeLabel(a.scheduledAt!)}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className={STATUS_BADGE[a.status] ?? ""}>{a.status}</Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="font-medium">{a.fullName}</div>
                  <div className="text-muted-foreground">{TYPE_LABELS[a.appointmentType] ?? a.appointmentType} · {a.durationMinutes ?? 60} min</div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" /><a href={`tel:${a.phone}`} className="hover:underline">{a.phone}</a></span>
                    <span className="flex items-center gap-1"><UserRound className="h-3 w-3" />{assigneeName(a.assignedToId)}</span>
                  </div>
                  {a.bookedBy === "jessica" && <Badge variant="outline" className="text-[10px]">Booked by Jessica</Badge>}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AppointmentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={refetchAll}
        appointment={editingAppt}
        defaults={createDefaults}
      />
    </DashboardLayout>
  );
}

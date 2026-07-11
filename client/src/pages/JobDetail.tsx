/**
 * /jobs/:id — Job detail (Phase 2, Task 6).
 * The single pane for a job: status pipeline, customer/property, labor & parts
 * line items (the future QuickBooks estimate's raw material), and its visits.
 * QuickBooks badges are display-only placeholders — no sync exists yet.
 */
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import AppointmentDialog, { type EditableAppointment } from "@/components/AppointmentDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Briefcase, Calendar, MapPin, Pencil, Phone, Plus, Trash2, UserRound, Wrench,
} from "lucide-react";
import { JOB_STATUS_META, LINE_ITEM_TYPE_LABELS, formatMoney } from "@/lib/jobPresentation";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

const APPT_STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  rescheduled: "bg-blue-100 text-blue-700",
};

const EMPTY_LINE = { type: "labor", description: "", quantity: "1", unitPrice: "" };

export default function JobDetail() {
  const params = useParams<{ id: string }>();
  const jobId = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, refetch } = trpc.jobs.getById.useQuery({ id: jobId }, { enabled: jobId > 0, retry: false });
  const { data: assignees = [] } = trpc.appointments.assignees.useQuery();

  // Edit job dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", equipmentServiced: "", internalNotes: "", assignedToId: "none", priority: "normal" as "normal" | "urgent" | "emergency" });

  // Line item dialog
  const [lineOpen, setLineOpen] = useState(false);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [lineForm, setLineForm] = useState({ ...EMPTY_LINE });

  // Appointment dialog
  const [apptOpen, setApptOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<EditableAppointment | null>(null);

  const updateStatus = trpc.jobs.updateStatus.useMutation({
    onSuccess: () => { toast({ title: "Status updated" }); refetch(); },
    onError: e => toast({ title: "Status update failed", description: e.message, variant: "destructive" }),
  });
  const updateJob = trpc.jobs.update.useMutation({
    onSuccess: () => { toast({ title: "Job updated" }); setEditOpen(false); refetch(); },
    onError: e => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });
  const addLine = trpc.jobs.addLineItem.useMutation({
    onSuccess: () => { setLineOpen(false); refetch(); },
    onError: e => toast({ title: "Could not add line item", description: e.message, variant: "destructive" }),
  });
  const updateLine = trpc.jobs.updateLineItem.useMutation({
    onSuccess: () => { setLineOpen(false); refetch(); },
    onError: e => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });
  const deleteLine = trpc.jobs.deleteLineItem.useMutation({
    onSuccess: () => refetch(),
    onError: e => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <DashboardLayout><InternalNav /><p className="p-8 text-sm text-muted-foreground">Loading job…</p></DashboardLayout>;
  }
  if (!data) {
    return (
      <DashboardLayout><InternalNav />
        <div className="p-8 space-y-3">
          <p className="text-sm text-muted-foreground">Job not found.</p>
          <Button variant="outline" onClick={() => navigate("/jobs")}><ArrowLeft className="h-4 w-4 mr-1" /> Back to Jobs</Button>
        </div>
      </DashboardLayout>
    );
  }

  const { job, customer, property, lineItems, appointments, assignee, opportunity, lineTotal } = data;
  const statusMeta = JOB_STATUS_META.find(m => m.value === job.status);

  const qbLabel: Record<string, string> = { not_synced: "Not synced", pending: "Sync pending", synced: "Synced", error: "Sync error" };

  const openEdit = () => {
    setEditForm({
      title: job.title,
      description: job.description || "",
      equipmentServiced: job.equipmentServiced || "",
      internalNotes: job.internalNotes || "",
      assignedToId: job.assignedToId ? String(job.assignedToId) : "none",
      priority: job.priority,
    });
    setEditOpen(true);
  };

  const openAddLine = () => { setEditingLineId(null); setLineForm({ ...EMPTY_LINE }); setLineOpen(true); };
  const openEditLine = (li: (typeof lineItems)[number]) => {
    setEditingLineId(li.id);
    setLineForm({ type: li.type, description: li.description, quantity: String(Number(li.quantity)), unitPrice: String(Number(li.unitPrice)) });
    setLineOpen(true);
  };
  const saveLine = () => {
    const quantity = parseFloat(lineForm.quantity);
    const unitPrice = parseFloat(lineForm.unitPrice);
    if (!lineForm.description.trim() || isNaN(quantity) || isNaN(unitPrice)) {
      toast({ title: "Description, quantity, and price are required", variant: "destructive" });
      return;
    }
    const payload = { type: lineForm.type as never, description: lineForm.description.trim(), quantity, unitPrice };
    if (editingLineId) updateLine.mutate({ id: editingLineId, ...payload });
    else addLine.mutate({ jobId, ...payload, sortOrder: lineItems.length });
  };

  return (
    <DashboardLayout>
      <InternalNav />
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/jobs")} className="-ml-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Jobs
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-[#1e3a5f]" />
              <span className="font-mono text-lg text-muted-foreground">{job.jobNumber}</span>
              {job.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {job.priority !== "normal" && (
                <Badge variant="secondary" className={job.priority === "emergency" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>
                  {job.priority === "emergency" ? "🚨 Emergency" : "⚠️ Urgent"}
                </Badge>
              )}
              {job.jobType && <Badge variant="secondary" className="capitalize">{job.jobType.replace(/_/g, " ")}</Badge>}
              {/* Phase A: link back to the originating opportunity, if converted */}
              {opportunity && (
                <button
                  onClick={() => navigate(`/opportunities?opportunityId=${opportunity.id}`)}
                  className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs text-[#1e3a5f] hover:bg-muted"
                >
                  From Opportunity #{opportunity.id}
                  <Badge variant="secondary" className="text-[10px] capitalize">{opportunity.stage.replace(/_/g, " ")}</Badge>
                </button>
              )}
              {/* QuickBooks — display-only until the sync task */}
              <Badge variant="outline" className="text-muted-foreground">QuickBooks: {qbLabel[job.quickbooksSyncStatus]}</Badge>
              {job.completedAt && <span className="text-muted-foreground">Completed {formatDate(job.completedAt)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={job.status} onValueChange={s => updateStatus.mutate({ id: jobId, status: s as never })}>
              <SelectTrigger className={`w-44 ${statusMeta?.badge ?? ""}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {JOB_STATUS_META.map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${m.dot}`} />{m.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={openEdit}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
          </div>
        </div>

        {/* Customer / property / assignee */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:bg-muted/30" onClick={() => customer && navigate(`/customers/${customer.id}`)}>
            <CardContent className="pt-6 text-sm space-y-1">
              <div className="font-medium flex items-center gap-2"><UserRound className="h-4 w-4 text-[#1e3a5f]" />{customer?.displayName ?? "—"}</div>
              {customer?.phone && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" />{customer.phone}</div>}
              <div className="text-xs text-muted-foreground">View customer →</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-sm space-y-1">
              <div className="font-medium flex items-center gap-2"><MapPin className="h-4 w-4 text-[#1e3a5f]" />Property</div>
              <div className="text-muted-foreground">
                {property ? `${property.addressLine1}${property.city ? ", " + property.city : ""}` : "No property linked"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-sm space-y-1">
              <div className="font-medium flex items-center gap-2"><Wrench className="h-4 w-4 text-[#1e3a5f]" />Technician</div>
              <div className="text-muted-foreground">{assignee?.name ?? "Unassigned"}</div>
              {job.equipmentServiced && <div className="text-xs text-muted-foreground">Equipment: {job.equipmentServiced}</div>}
            </CardContent>
          </Card>
        </div>

        {job.description && (
          <Card><CardContent className="pt-6 text-sm whitespace-pre-wrap">{job.description}</CardContent></Card>
        )}

        {/* Line items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Labor & Parts</CardTitle>
            <Button size="sm" variant="outline" onClick={openAddLine}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
          </CardHeader>
          <CardContent>
            {lineItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No line items yet — add labor, parts, and services here. These become the estimate.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map(li => (
                    <TableRow key={li.id}>
                      <TableCell><Badge variant="secondary">{LINE_ITEM_TYPE_LABELS[li.type] ?? li.type}</Badge></TableCell>
                      <TableCell className="max-w-md">{li.description}</TableCell>
                      <TableCell className="text-right">{Number(li.quantity)}</TableCell>
                      <TableCell className="text-right">{formatMoney(Number(li.unitPrice))}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(Number(li.total))}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditLine(li)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteLine.mutate({ id: li.id })}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={4} className="text-right font-semibold">Job total</TableCell>
                    <TableCell className="text-right font-bold text-[#1e3a5f]">{formatMoney(lineTotal)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Appointments under this job */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-[#1e3a5f]" /> Visits ({appointments.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setEditingAppt(null); setApptOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Visit
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visits scheduled under this job yet.</p>
            ) : (
              appointments.map(a => (
                <div key={a.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
                  <div>
                    <div className="font-medium">{a.scheduledAt ? formatDate(a.scheduledAt) : `${a.preferredDate} · ${a.preferredTime} (unscheduled)`}</div>
                    <div className="text-muted-foreground capitalize">{a.appointmentType.replace(/_/g, " ")} · {a.durationMinutes ?? 60} min{a.bookedBy === "jessica" ? " · Booked by Jessica" : ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={APPT_STATUS[a.status] ?? ""}>{a.status}</Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingAppt(a as unknown as EditableAppointment); setApptOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            {job.internalNotes && (
              <div className="text-sm text-muted-foreground border-t pt-3 whitespace-pre-wrap"><span className="font-medium text-foreground">Internal notes: </span>{job.internalNotes}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit job dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Job {job.jobNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select value={editForm.priority} onValueChange={v => setEditForm(f => ({ ...f, priority: v as typeof f.priority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Technician</Label>
                <Select value={editForm.assignedToId} onValueChange={v => setEditForm(f => ({ ...f, assignedToId: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {assignees.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Equipment serviced</Label>
              <Input placeholder="e.g. Carrier 58SB furnace, 2019" value={editForm.equipmentServiced} onChange={e => setEditForm(f => ({ ...f, equipmentServiced: e.target.value }))} />
            </div>
            <div>
              <Label>Internal notes</Label>
              <Textarea rows={2} value={editForm.internalNotes} onChange={e => setEditForm(f => ({ ...f, internalNotes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#16304f]"
              disabled={updateJob.isPending}
              onClick={() => updateJob.mutate({
                id: jobId,
                title: editForm.title,
                description: editForm.description || null,
                priority: editForm.priority,
                assignedToId: editForm.assignedToId === "none" ? null : parseInt(editForm.assignedToId),
                equipmentServiced: editForm.equipmentServiced || null,
                internalNotes: editForm.internalNotes || null,
              })}
            >
              {updateJob.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Line item dialog */}
      <Dialog open={lineOpen} onOpenChange={setLineOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingLineId ? "Edit Line Item" : "Add Line Item"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={lineForm.type} onValueChange={v => setLineForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LINE_ITEM_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input placeholder="e.g. Replace inducer motor" value={lineForm.description} onChange={e => setLineForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <Label>Quantity</Label>
                <Input type="number" step="0.25" min="0" value={lineForm.quantity} onChange={e => setLineForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <Label>Unit price ($)</Label>
                <Input type="number" step="0.01" min="0" value={lineForm.unitPrice} onChange={e => setLineForm(f => ({ ...f, unitPrice: e.target.value }))} />
              </div>
              <div className="text-sm text-muted-foreground pb-2">
                = {formatMoney((parseFloat(lineForm.quantity) || 0) * (parseFloat(lineForm.unitPrice) || 0))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineOpen(false)}>Cancel</Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#16304f]" disabled={addLine.isPending || updateLine.isPending} onClick={saveLine}>
              {addLine.isPending || updateLine.isPending ? "Saving…" : "Save Line"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/edit visit under this job */}
      <AppointmentDialog
        open={apptOpen}
        onClose={() => setApptOpen(false)}
        onSaved={() => refetch()}
        appointment={editingAppt}
        defaults={{
          customerId: job.customerId,
          jobId: job.id,
          fullName: customer?.displayName || "",
          phone: customer?.phone || "",
          email: customer?.email || "",
          propertyType: customer?.type || "residential",
          propertyAddress: property?.addressLine1 || "",
          propertyId: property?.id,
        }}
      />
    </DashboardLayout>
  );
}

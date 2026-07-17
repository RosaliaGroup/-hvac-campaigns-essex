/**
 * /jobs/:id — Job detail (Phase 2, Task 6).
 * The single operational pane for a job: status pipeline, customer/property,
 * schedule/actuals, labor & parts (normalized), notes, attachments, additional
 * technicians, related opportunity/estimates/invoices, visits, and status
 * history. QuickBooks references are display-only — no sync exists here.
 */
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import AppointmentDialog, { type EditableAppointment } from "@/components/AppointmentDialog";
import { OfficeFieldSummary } from "@/components/field/OfficeFieldSummary";
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
  ArrowLeft, Briefcase, Calendar, Clock, FileText, MapPin, Paperclip, Pencil, Phone, Plus,
  Receipt, Target, Trash2, UserRound, Users, Wrench, Archive, RotateCcw, StickyNote, Package, Hash,
} from "lucide-react";
import { JOB_STATUS_META, LINE_ITEM_TYPE_LABELS, WARRANTY_LABELS, formatMoney } from "@/lib/jobPresentation";
import { formatDisplayName, formatAddress } from "@shared/nameFormat";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}
function shortDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function toDateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 16);
}

const APPT_STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  rescheduled: "bg-blue-100 text-blue-700",
};
const DOC_STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
  rejected: "bg-red-100 text-red-700",
};

const EMPTY_LINE = { type: "labor", description: "", quantity: "1", unitPrice: "" };
const EMPTY_LABOR = { technicianId: "none", workDate: "", durationMinutes: "", description: "", billable: true };
const EMPTY_PART = { itemName: "", description: "", quantity: "1", unit: "", unitCost: "", unitPrice: "", billable: true };
const EMPTY_NOTE = { body: "", visibility: "internal" as "internal" | "customer" };
const EMPTY_ATTACH = { kind: "photo" as "photo" | "document" | "other", fileName: "", url: "" };

export default function JobDetail() {
  const params = useParams<{ id: string }>();
  const jobId = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, refetch } = trpc.jobs.getById.useQuery({ id: jobId }, { enabled: jobId > 0, retry: false });
  const { data: assignees = [] } = trpc.appointments.assignees.useQuery();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "", description: "", equipmentServiced: "", internalNotes: "", customerVisibleNotes: "",
    completionSummary: "", assignedToId: "none", priority: "normal" as "normal" | "urgent" | "emergency",
    warrantyStatus: "none" as string, scheduledStartAt: "", scheduledEndAt: "",
  });

  const [lineOpen, setLineOpen] = useState(false);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [lineForm, setLineForm] = useState({ ...EMPTY_LINE });

  const [laborOpen, setLaborOpen] = useState(false);
  const [editingLaborId, setEditingLaborId] = useState<number | null>(null);
  const [laborForm, setLaborForm] = useState({ ...EMPTY_LABOR });

  const [partOpen, setPartOpen] = useState(false);
  const [editingPartId, setEditingPartId] = useState<number | null>(null);
  const [partForm, setPartForm] = useState({ ...EMPTY_PART });

  const [noteForm, setNoteForm] = useState({ ...EMPTY_NOTE });
  const [attachForm, setAttachForm] = useState({ ...EMPTY_ATTACH });
  const [techForm, setTechForm] = useState({ technicianId: "none", role: "" });

  const [apptOpen, setApptOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<EditableAppointment | null>(null);

  const onDone = (msg?: string) => { if (msg) toast({ title: msg }); refetch(); };
  const onErr = (e: { message: string }) => toast({ title: "Action failed", description: e.message, variant: "destructive" });

  const updateStatus = trpc.jobs.updateStatus.useMutation({ onSuccess: () => onDone("Status updated"), onError: onErr });
  const updateJob = trpc.jobs.update.useMutation({ onSuccess: () => { setEditOpen(false); onDone("Job updated"); }, onError: onErr });
  const archive = trpc.jobs.archive.useMutation({ onSuccess: () => onDone("Job archived"), onError: onErr });
  const restore = trpc.jobs.restore.useMutation({ onSuccess: () => onDone("Job restored"), onError: onErr });
  const addLine = trpc.jobs.addLineItem.useMutation({ onSuccess: () => { setLineOpen(false); onDone(); }, onError: onErr });
  const updateLine = trpc.jobs.updateLineItem.useMutation({ onSuccess: () => { setLineOpen(false); onDone(); }, onError: onErr });
  const deleteLine = trpc.jobs.deleteLineItem.useMutation({ onSuccess: () => onDone(), onError: onErr });
  const addLabor = trpc.jobs.addLabor.useMutation({ onSuccess: () => { setLaborOpen(false); onDone(); }, onError: onErr });
  const updateLabor = trpc.jobs.updateLabor.useMutation({ onSuccess: () => { setLaborOpen(false); onDone(); }, onError: onErr });
  const deleteLabor = trpc.jobs.deleteLabor.useMutation({ onSuccess: () => onDone(), onError: onErr });
  const addPart = trpc.jobs.addPart.useMutation({ onSuccess: () => { setPartOpen(false); onDone(); }, onError: onErr });
  const updatePart = trpc.jobs.updatePart.useMutation({ onSuccess: () => { setPartOpen(false); onDone(); }, onError: onErr });
  const deletePart = trpc.jobs.deletePart.useMutation({ onSuccess: () => onDone(), onError: onErr });
  const addNote = trpc.jobs.addNote.useMutation({ onSuccess: () => { setNoteForm({ ...EMPTY_NOTE }); onDone(); }, onError: onErr });
  const deleteNote = trpc.jobs.deleteNote.useMutation({ onSuccess: () => onDone(), onError: onErr });
  const addAttachment = trpc.jobs.addAttachment.useMutation({ onSuccess: () => { setAttachForm({ ...EMPTY_ATTACH }); onDone(); }, onError: onErr });
  const deleteAttachment = trpc.jobs.deleteAttachment.useMutation({ onSuccess: () => onDone(), onError: onErr });
  const addTechnician = trpc.jobs.addTechnician.useMutation({ onSuccess: () => { setTechForm({ technicianId: "none", role: "" }); onDone(); }, onError: onErr });
  const removeTechnician = trpc.jobs.removeTechnician.useMutation({ onSuccess: () => onDone(), onError: onErr });

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

  const {
    job, customer, property, lineItems, appointments, assignee, opportunity,
    labor, parts, notes, attachments, additionalTechnicians, statusHistory, estimates, invoices,
    lineTotal, partsTotal,
  } = data;
  const statusMeta = JOB_STATUS_META.find(m => m.value === job.status);
  const qbLabel: Record<string, string> = { not_synced: "Not synced", pending: "Sync pending", synced: "Synced", error: "Sync error" };

  const openEdit = () => {
    setEditForm({
      title: job.title,
      description: job.description || "",
      equipmentServiced: job.equipmentServiced || "",
      internalNotes: job.internalNotes || "",
      customerVisibleNotes: job.customerVisibleNotes || "",
      completionSummary: job.completionSummary || "",
      assignedToId: job.assignedToId ? String(job.assignedToId) : "none",
      priority: job.priority,
      warrantyStatus: job.warrantyStatus || "none",
      scheduledStartAt: toDateInput(job.scheduledStartAt),
      scheduledEndAt: toDateInput(job.scheduledEndAt),
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

  const openAddLabor = () => { setEditingLaborId(null); setLaborForm({ ...EMPTY_LABOR }); setLaborOpen(true); };
  const openEditLabor = (l: (typeof labor)[number]) => {
    setEditingLaborId(l.labor.id);
    setLaborForm({
      technicianId: l.labor.technicianId ? String(l.labor.technicianId) : "none",
      workDate: l.labor.workDate ? new Date(l.labor.workDate).toISOString().slice(0, 10) : "",
      durationMinutes: l.labor.durationMinutes != null ? String(l.labor.durationMinutes) : "",
      description: l.labor.description,
      billable: l.labor.billable,
    });
    setLaborOpen(true);
  };
  const saveLabor = () => {
    if (!laborForm.description.trim()) { toast({ title: "Description is required", variant: "destructive" }); return; }
    const payload = {
      technicianId: laborForm.technicianId === "none" ? null : parseInt(laborForm.technicianId),
      workDate: laborForm.workDate ? new Date(laborForm.workDate) : null,
      durationMinutes: laborForm.durationMinutes ? parseInt(laborForm.durationMinutes) : null,
      description: laborForm.description.trim(),
      billable: laborForm.billable,
    };
    if (editingLaborId) updateLabor.mutate({ id: editingLaborId, ...payload });
    else addLabor.mutate({ jobId, ...payload });
  };

  const openAddPart = () => { setEditingPartId(null); setPartForm({ ...EMPTY_PART }); setPartOpen(true); };
  const openEditPart = (p: (typeof parts)[number]) => {
    setEditingPartId(p.id);
    setPartForm({
      itemName: p.itemName, description: p.description || "", quantity: String(Number(p.quantity)),
      unit: p.unit || "", unitCost: String(Number(p.unitCost)), unitPrice: String(Number(p.unitPrice)), billable: p.billable,
    });
    setPartOpen(true);
  };
  const savePart = () => {
    if (!partForm.itemName.trim()) { toast({ title: "Item name is required", variant: "destructive" }); return; }
    const payload = {
      itemName: partForm.itemName.trim(), description: partForm.description || null,
      quantity: parseFloat(partForm.quantity) || 0, unit: partForm.unit || null,
      unitCost: parseFloat(partForm.unitCost) || 0, unitPrice: parseFloat(partForm.unitPrice) || 0, billable: partForm.billable,
    };
    if (editingPartId) updatePart.mutate({ id: editingPartId, ...payload });
    else addPart.mutate({ jobId, ...payload });
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
              {job.archivedAt && <Badge variant="outline" className="text-muted-foreground">Archived {shortDate(job.archivedAt)}</Badge>}
              {job.priority !== "normal" && (
                <Badge variant="secondary" className={job.priority === "emergency" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>
                  {job.priority === "emergency" ? "🚨 Emergency" : "⚠️ Urgent"}
                </Badge>
              )}
              {job.jobType && <Badge variant="secondary" className="capitalize">{job.jobType.replace(/_/g, " ")}</Badge>}
              {job.warrantyStatus && job.warrantyStatus !== "none" && (
                <Badge variant="secondary" className="bg-violet-100 text-violet-700">Warranty: {WARRANTY_LABELS[job.warrantyStatus] ?? job.warrantyStatus}</Badge>
              )}
              {opportunity && (
                <button
                  onClick={() => navigate(`/opportunities/${opportunity.id}`)}
                  className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs text-[#1e3a5f] hover:bg-muted"
                >
                  <Target className="h-3 w-3" /> From Opportunity #{opportunity.id}
                  <Badge variant="secondary" className="text-[10px] capitalize">{opportunity.stage.replace(/_/g, " ")}</Badge>
                </button>
              )}
              <Badge variant="outline" className="text-muted-foreground">QuickBooks: {qbLabel[job.quickbooksSyncStatus]}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={job.status} onValueChange={s => updateStatus.mutate({ id: jobId, status: s as never })}>
              <SelectTrigger className={`w-48 ${statusMeta?.badge ?? ""}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {JOB_STATUS_META.map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${m.dot}`} />{m.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={openEdit}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
            {job.archivedAt
              ? <Button variant="outline" onClick={() => restore.mutate({ id: jobId })}><RotateCcw className="h-4 w-4 mr-1" /> Restore</Button>
              : <Button variant="outline" onClick={() => archive.mutate({ id: jobId })}><Archive className="h-4 w-4 mr-1" /> Archive</Button>}
          </div>
        </div>

        {/* Customer / property / assignee */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:bg-muted/30" onClick={() => customer && navigate(`/customers/${customer.id}`)}>
            <CardContent className="pt-6 text-sm space-y-1">
              <div className="font-medium flex items-center gap-2"><UserRound className="h-4 w-4 text-[#1e3a5f]" />{customer?.displayName ? formatDisplayName(customer.displayName) : "—"}</div>
              {customer?.phone && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" />{customer.phone}</div>}
              <div className="text-xs text-muted-foreground">View customer →</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-sm space-y-1">
              <div className="font-medium flex items-center gap-2"><MapPin className="h-4 w-4 text-[#1e3a5f]" />Property</div>
              <div className="text-muted-foreground">
                {property ? `${formatAddress(property.addressLine1)}${property.city ? ", " + formatDisplayName(property.city) : ""}` : "No property linked"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-sm space-y-1">
              <div className="font-medium flex items-center gap-2"><Wrench className="h-4 w-4 text-[#1e3a5f]" />Technician</div>
              <div className="text-muted-foreground">{assignee?.name ?? "Unassigned"}</div>
              {additionalTechnicians.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  + {additionalTechnicians.map(t => t.name ?? `#${t.link.technicianId}`).join(", ")}
                </div>
              )}
              {job.equipmentServiced && <div className="text-xs text-muted-foreground">Equipment: {job.equipmentServiced}</div>}
            </CardContent>
          </Card>
        </div>

        {/* Schedule & actuals */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-[#1e3a5f]" /> Schedule</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><div className="text-xs text-muted-foreground">Scheduled start</div><div>{formatDate(job.scheduledStartAt)}</div></div>
            <div><div className="text-xs text-muted-foreground">Scheduled end</div><div>{formatDate(job.scheduledEndAt)}</div></div>
            <div><div className="text-xs text-muted-foreground">Actual arrival</div><div>{formatDate(job.actualArrivalAt)}</div></div>
            <div><div className="text-xs text-muted-foreground">Completed</div><div>{formatDate(job.actualCompletionAt ?? job.completedAt)}</div></div>
          </CardContent>
        </Card>

        {job.description && (
          <Card><CardContent className="pt-6 text-sm whitespace-pre-wrap">{job.description}</CardContent></Card>
        )}

        {/* Related opportunity / estimates / invoices */}
        {(opportunity || estimates.length > 0 || invoices.length > 0) && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-[#1e3a5f]" /> Related records</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {opportunity && (
                <button className="flex w-full items-center justify-between rounded border p-2 hover:bg-muted/50" onClick={() => navigate(`/opportunities/${opportunity.id}`)}>
                  <span className="inline-flex items-center gap-2"><Target className="h-3.5 w-3.5 text-[#1e3a5f]" /> {opportunity.title}</span>
                  <Badge variant="secondary" className="capitalize">{opportunity.stage.replace(/_/g, " ")}</Badge>
                </button>
              )}
              {estimates.map(d => (
                <button key={`e${d.id}`} className="flex w-full items-center justify-between rounded border p-2 hover:bg-muted/50" onClick={() => opportunity && navigate(`/opportunities/${opportunity.id}`)}>
                  <span className="inline-flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Estimate {d.docNumber ? `#${d.docNumber}` : d.quickbooksId} <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Hash className="h-3 w-3" />QBO {d.quickbooksId}</span></span>
                  <span className="inline-flex items-center gap-2"><Badge variant="secondary" className={DOC_STATUS[d.status] ?? ""}>{d.status}</Badge><span className="font-medium">{formatMoney(Number(d.totalAmount))}</span></span>
                </button>
              ))}
              {invoices.map(d => (
                <button key={`i${d.id}`} className="flex w-full items-center justify-between rounded border p-2 hover:bg-muted/50" onClick={() => opportunity && navigate(`/opportunities/${opportunity.id}`)}>
                  <span className="inline-flex items-center gap-2"><Receipt className="h-3.5 w-3.5" /> Invoice {d.docNumber ? `#${d.docNumber}` : d.quickbooksId} <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Hash className="h-3 w-3" />QBO {d.quickbooksId}</span></span>
                  <span className="inline-flex items-center gap-2"><Badge variant="secondary" className={DOC_STATUS[d.status] ?? ""}>{d.status}</Badge><span className="font-medium">{formatMoney(Number(d.totalAmount))}</span></span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Labor (normalized) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4 text-[#1e3a5f]" /> Labor ({labor.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={openAddLabor}><Plus className="h-4 w-4 mr-1" /> Add Labor</Button>
          </CardHeader>
          <CardContent>
            {labor.length === 0 ? <p className="text-sm text-muted-foreground">No labor logged yet.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Technician</TableHead><TableHead>Date</TableHead><TableHead>Description</TableHead>
                  <TableHead className="text-right">Minutes</TableHead><TableHead>Billable</TableHead><TableHead className="w-16" />
                </TableRow></TableHeader>
                <TableBody>
                  {labor.map(l => (
                    <TableRow key={l.labor.id}>
                      <TableCell>{l.technicianName ?? "—"}</TableCell>
                      <TableCell>{shortDate(l.labor.workDate)}</TableCell>
                      <TableCell className="max-w-md">{l.labor.description}</TableCell>
                      <TableCell className="text-right">{l.labor.durationMinutes ?? "—"}</TableCell>
                      <TableCell>{l.labor.billable ? "Yes" : "No"}</TableCell>
                      <TableCell><div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditLabor(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteLabor.mutate({ id: l.labor.id })}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                      </div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Parts / materials (normalized) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-[#1e3a5f]" /> Parts / Materials ({parts.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={openAddPart}><Plus className="h-4 w-4 mr-1" /> Add Part</Button>
          </CardHeader>
          <CardContent>
            {parts.length === 0 ? <p className="text-sm text-muted-foreground">No parts recorded yet.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Unit</TableHead>
                  <TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Line</TableHead><TableHead className="w-16" />
                </TableRow></TableHeader>
                <TableBody>
                  {parts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-xs"><div className="font-medium">{p.itemName}</div>{p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}{!p.billable && <Badge variant="outline" className="text-muted-foreground mt-1">non-billable</Badge>}</TableCell>
                      <TableCell className="text-right">{Number(p.quantity)}</TableCell>
                      <TableCell>{p.unit ?? "—"}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatMoney(Number(p.unitCost))}</TableCell>
                      <TableCell className="text-right">{formatMoney(Number(p.unitPrice))}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(Number(p.quantity) * Number(p.unitPrice))}</TableCell>
                      <TableCell><div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditPart(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deletePart.mutate({ id: p.id })}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                      </div></TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-semibold">Parts total</TableCell>
                    <TableCell className="text-right font-bold text-[#1e3a5f]">{formatMoney(partsTotal)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Estimate line items (existing jobLineItems — unchanged table) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Estimate Line Items</CardTitle>
            <Button size="sm" variant="outline" onClick={openAddLine}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
          </CardHeader>
          <CardContent>
            {lineItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No line items yet — the raw material for a future estimate.</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="w-20" />
                </TableRow></TableHeader>
                <TableBody>
                  {lineItems.map(li => (
                    <TableRow key={li.id}>
                      <TableCell><Badge variant="secondary">{LINE_ITEM_TYPE_LABELS[li.type] ?? li.type}</Badge></TableCell>
                      <TableCell className="max-w-md">{li.description}</TableCell>
                      <TableCell className="text-right">{Number(li.quantity)}</TableCell>
                      <TableCell className="text-right">{formatMoney(Number(li.unitPrice))}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(Number(li.total))}</TableCell>
                      <TableCell><div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditLine(li)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteLine.mutate({ id: li.id })}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                      </div></TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={4} className="text-right font-semibold">Line items total</TableCell>
                    <TableCell className="text-right font-bold text-[#1e3a5f]">{formatMoney(lineTotal)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Additional technicians */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-[#1e3a5f]" /> Additional Technicians ({additionalTechnicians.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {additionalTechnicians.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {additionalTechnicians.map(t => (
                  <Badge key={t.link.id} variant="secondary" className="gap-1">
                    {t.name ?? `#${t.link.technicianId}`}{t.link.role ? ` · ${t.link.role}` : ""}
                    <button onClick={() => removeTechnician.mutate({ id: t.link.id })} className="ml-1 text-red-500">✕</button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={techForm.technicianId} onValueChange={v => setTechForm(f => ({ ...f, technicianId: v }))}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Add technician" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select technician…</SelectItem>
                  {assignees.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Role (optional)" value={techForm.role} onChange={e => setTechForm(f => ({ ...f, role: e.target.value }))} className="w-40" />
              <Button size="sm" variant="outline" disabled={techForm.technicianId === "none"} onClick={() => addTechnician.mutate({ jobId, technicianId: parseInt(techForm.technicianId), role: techForm.role || null })}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notes (multiple) */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><StickyNote className="h-4 w-4 text-[#1e3a5f]" /> Notes ({notes.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(job.internalNotes || job.customerVisibleNotes) && (
              <div className="space-y-1 border-b pb-3 text-sm">
                {job.internalNotes && <div><span className="font-medium">Internal: </span><span className="text-muted-foreground whitespace-pre-wrap">{job.internalNotes}</span></div>}
                {job.customerVisibleNotes && <div><span className="font-medium">Customer-visible: </span><span className="text-muted-foreground whitespace-pre-wrap">{job.customerVisibleNotes}</span></div>}
              </div>
            )}
            {notes.map(n => (
              <div key={n.id} className="flex items-start justify-between gap-2 border rounded-lg p-2 text-sm">
                <div>
                  <Badge variant="secondary" className={n.visibility === "customer" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}>{n.visibility}</Badge>
                  <span className="ml-2 whitespace-pre-wrap">{n.body}</span>
                  <div className="text-xs text-muted-foreground mt-0.5">{formatDate(n.createdAt)}</div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteNote.mutate({ id: n.id })}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Input placeholder="Add a note…" value={noteForm.body} onChange={e => setNoteForm(f => ({ ...f, body: e.target.value }))} className="flex-1 min-w-[200px]" />
              <Select value={noteForm.visibility} onValueChange={v => setNoteForm(f => ({ ...f, visibility: v as never }))}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="customer">Customer-visible</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" disabled={!noteForm.body.trim()} onClick={() => addNote.mutate({ jobId, body: noteForm.body.trim(), visibility: noteForm.visibility })}>
                <Plus className="h-4 w-4 mr-1" /> Add Note
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Attachments / photos (reference metadata) */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Paperclip className="h-4 w-4 text-[#1e3a5f]" /> Attachments ({attachments.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {attachments.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-2 border rounded-lg p-2 text-sm">
                <a href={a.url ?? undefined} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[#1e3a5f] hover:underline">
                  <Paperclip className="h-3.5 w-3.5" /> {a.fileName} <Badge variant="secondary">{a.kind}</Badge>
                </a>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteAttachment.mutate({ id: a.id })}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={attachForm.kind} onValueChange={v => setAttachForm(f => ({ ...f, kind: v as never }))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="photo">Photo</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="File name" value={attachForm.fileName} onChange={e => setAttachForm(f => ({ ...f, fileName: e.target.value }))} className="w-40" />
              <Input placeholder="URL" value={attachForm.url} onChange={e => setAttachForm(f => ({ ...f, url: e.target.value }))} className="flex-1 min-w-[200px]" />
              <Button size="sm" variant="outline" disabled={!attachForm.fileName.trim() || !attachForm.url.trim()} onClick={() => addAttachment.mutate({ jobId, kind: attachForm.kind, fileName: attachForm.fileName.trim(), url: attachForm.url.trim() })}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Visits (appointments under this job) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-[#1e3a5f]" /> Visits ({appointments.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setEditingAppt(null); setApptOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add Visit</Button>
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
          </CardContent>
        </Card>

        {/* Completion summary */}
        {job.completionSummary && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Completion Summary</CardTitle></CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap">{job.completionSummary}</CardContent>
          </Card>
        )}

        {/* Field completion (PR #41) — read-only time/parts/signature */}
        <OfficeFieldSummary jobId={jobId} />

        {/* Status history */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-[#1e3a5f]" /> Status History ({statusHistory.length})</CardTitle></CardHeader>
          <CardContent>
            {statusHistory.length === 0 ? <p className="text-sm text-muted-foreground">No history yet.</p> : (
              <ol className="space-y-2 text-sm">
                {statusHistory.map(h => {
                  const to = JOB_STATUS_META.find(m => m.value === h.toStatus);
                  const from = h.fromStatus ? JOB_STATUS_META.find(m => m.value === h.fromStatus) : null;
                  return (
                    <li key={h.id} className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${to?.dot ?? "bg-slate-400"}`} />
                      <span>{from ? `${from.label} → ` : ""}<span className="font-medium">{to?.label ?? h.toStatus}</span></span>
                      {h.note && <span className="text-muted-foreground">· {h.note}</span>}
                      <span className="text-xs text-muted-foreground ml-auto">{formatDate(h.createdAt)}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit job dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Job {job.jobNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} /></div>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Warranty</Label>
                <Select value={editForm.warrantyStatus} onValueChange={v => setEditForm(f => ({ ...f, warrantyStatus: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(WARRANTY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Equipment serviced</Label>
                <Input value={editForm.equipmentServiced} onChange={e => setEditForm(f => ({ ...f, equipmentServiced: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Scheduled start</Label><Input type="datetime-local" value={editForm.scheduledStartAt} onChange={e => setEditForm(f => ({ ...f, scheduledStartAt: e.target.value }))} /></div>
              <div><Label>Scheduled end</Label><Input type="datetime-local" value={editForm.scheduledEndAt} onChange={e => setEditForm(f => ({ ...f, scheduledEndAt: e.target.value }))} /></div>
            </div>
            <div><Label>Internal notes</Label><Textarea rows={2} value={editForm.internalNotes} onChange={e => setEditForm(f => ({ ...f, internalNotes: e.target.value }))} /></div>
            <div><Label>Customer-visible notes</Label><Textarea rows={2} value={editForm.customerVisibleNotes} onChange={e => setEditForm(f => ({ ...f, customerVisibleNotes: e.target.value }))} /></div>
            <div><Label>Completion summary</Label><Textarea rows={2} value={editForm.completionSummary} onChange={e => setEditForm(f => ({ ...f, completionSummary: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#16304f]"
              disabled={updateJob.isPending || !editForm.title.trim()}
              onClick={() => updateJob.mutate({
                id: jobId,
                title: editForm.title,
                description: editForm.description || null,
                priority: editForm.priority,
                assignedToId: editForm.assignedToId === "none" ? null : parseInt(editForm.assignedToId),
                equipmentServiced: editForm.equipmentServiced || null,
                internalNotes: editForm.internalNotes || null,
                customerVisibleNotes: editForm.customerVisibleNotes || null,
                completionSummary: editForm.completionSummary || null,
                warrantyStatus: editForm.warrantyStatus === "none" ? null : (editForm.warrantyStatus as never),
                scheduledStartAt: editForm.scheduledStartAt ? new Date(editForm.scheduledStartAt) : null,
                scheduledEndAt: editForm.scheduledEndAt ? new Date(editForm.scheduledEndAt) : null,
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
                <SelectContent>{Object.entries(LINE_ITEM_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Input value={lineForm.description} onChange={e => setLineForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div><Label>Quantity</Label><Input type="number" step="0.25" min="0" value={lineForm.quantity} onChange={e => setLineForm(f => ({ ...f, quantity: e.target.value }))} /></div>
              <div><Label>Unit price ($)</Label><Input type="number" step="0.01" min="0" value={lineForm.unitPrice} onChange={e => setLineForm(f => ({ ...f, unitPrice: e.target.value }))} /></div>
              <div className="text-sm text-muted-foreground pb-2">= {formatMoney((parseFloat(lineForm.quantity) || 0) * (parseFloat(lineForm.unitPrice) || 0))}</div>
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

      {/* Labor dialog */}
      <Dialog open={laborOpen} onOpenChange={setLaborOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingLaborId ? "Edit Labor" : "Add Labor"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Technician</Label>
              <Select value={laborForm.technicianId} onValueChange={v => setLaborForm(f => ({ ...f, technicianId: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {assignees.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Work date</Label><Input type="date" value={laborForm.workDate} onChange={e => setLaborForm(f => ({ ...f, workDate: e.target.value }))} /></div>
              <div><Label>Minutes</Label><Input type="number" min="0" value={laborForm.durationMinutes} onChange={e => setLaborForm(f => ({ ...f, durationMinutes: e.target.value }))} /></div>
            </div>
            <div><Label>Description</Label><Input value={laborForm.description} onChange={e => setLaborForm(f => ({ ...f, description: e.target.value }))} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={laborForm.billable} onChange={e => setLaborForm(f => ({ ...f, billable: e.target.checked }))} /> Billable</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLaborOpen(false)}>Cancel</Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#16304f]" disabled={addLabor.isPending || updateLabor.isPending} onClick={saveLabor}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Part dialog */}
      <Dialog open={partOpen} onOpenChange={setPartOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingPartId ? "Edit Part" : "Add Part"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Item name</Label><Input value={partForm.itemName} onChange={e => setPartForm(f => ({ ...f, itemName: e.target.value }))} /></div>
            <div><Label>Description</Label><Input value={partForm.description} onChange={e => setPartForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantity</Label><Input type="number" step="0.01" min="0" value={partForm.quantity} onChange={e => setPartForm(f => ({ ...f, quantity: e.target.value }))} /></div>
              <div><Label>Unit</Label><Input placeholder="ea, ft, lb…" value={partForm.unit} onChange={e => setPartForm(f => ({ ...f, unit: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Unit cost ($, internal)</Label><Input type="number" step="0.01" min="0" value={partForm.unitCost} onChange={e => setPartForm(f => ({ ...f, unitCost: e.target.value }))} /></div>
              <div><Label>Unit price ($, customer)</Label><Input type="number" step="0.01" min="0" value={partForm.unitPrice} onChange={e => setPartForm(f => ({ ...f, unitPrice: e.target.value }))} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={partForm.billable} onChange={e => setPartForm(f => ({ ...f, billable: e.target.checked }))} /> Billable</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartOpen(false)}>Cancel</Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#16304f]" disabled={addPart.isPending || updatePart.isPending} onClick={savePart}>Save</Button>
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

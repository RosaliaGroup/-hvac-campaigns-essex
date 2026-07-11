import { useState, type ReactNode } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import AppointmentDialog, { type EditableAppointment } from "@/components/AppointmentDialog";
import { JOB_STATUS_META, formatMoney } from "@/lib/jobPresentation";
import { resolveCustomerIdentity } from "@/lib/customerIdentity";
import { jobRoute, opportunityRoute } from "@/lib/customerNavigation";
import { Briefcase } from "lucide-react";
import {
  ArrowLeft, Building2, Calendar, Home, Mail, MapPin, Pencil, Phone, PhoneCall,
  Plus, Star, Trash2, UserRound, Zap, RefreshCw, CheckCircle2, XCircle, Plug, Link2, Loader2,
  Target, FileText, Receipt, Hash, Tag, DollarSign, Wallet, Clock,
} from "lucide-react";

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

const APPT_STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  rescheduled: "bg-blue-100 text-blue-700",
};

const OPP_STAGE: Record<string, string> = {
  new: "bg-gray-100 text-gray-700",
  proposal_sent: "bg-blue-100 text-blue-700",
  pending: "bg-amber-100 text-amber-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

const DOC_STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-orange-100 text-orange-700",
};

/** Compact meta line used by the QBO-relationship tabs (project ref + QBO ref + address). */
function MetaLine({ items }: { items: Array<{ icon: ReactNode; label: string } | null> }) {
  const shown = items.filter(Boolean) as Array<{ icon: ReactNode; label: string }>;
  if (shown.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {shown.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1">{it.icon}{it.label}</span>
      ))}
    </div>
  );
}

const EMPTY_PROPERTY = {
  label: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "NJ",
  zip: "",
  propertyType: "residential" as "residential" | "commercial",
  squareFeet: "",
  existingSystem: "",
  isPrimary: false,
};

export default function CustomerDetail() {
  const params = useParams<{ id: string }>();
  const customerId = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, refetch } = trpc.customers.getById.useQuery(
    { id: customerId },
    { enabled: customerId > 0, retry: false },
  );

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", companyName: "", email: "", phone: "", altPhone: "", notes: "", status: "active" as "active" | "inactive" | "archived", type: "residential" as "residential" | "commercial" });

  const [propOpen, setPropOpen] = useState(false);
  const [editingPropId, setEditingPropId] = useState<number | null>(null);
  const [propForm, setPropForm] = useState({ ...EMPTY_PROPERTY });
  const [apptOpen, setApptOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<EditableAppointment | null>(null);

  const updateCustomer = trpc.customers.update.useMutation({
    onSuccess: () => { toast({ title: "Customer updated" }); setEditOpen(false); refetch(); },
    onError: err => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });
  const addProperty = trpc.customers.addProperty.useMutation({
    onSuccess: () => { toast({ title: "Property added" }); setPropOpen(false); refetch(); },
    onError: err => toast({ title: "Could not add property", description: err.message, variant: "destructive" }),
  });
  const updateProperty = trpc.customers.updateProperty.useMutation({
    onSuccess: () => { toast({ title: "Property updated" }); setPropOpen(false); refetch(); },
    onError: err => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });
  const deleteProperty = trpc.customers.deleteProperty.useMutation({
    onSuccess: () => { toast({ title: "Property deleted" }); refetch(); },
    onError: err => toast({ title: "Cannot delete property", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <InternalNav />
        <p className="p-8 text-sm text-muted-foreground">Loading customer…</p>
      </DashboardLayout>
    );
  }
  if (!data) {
    return (
      <DashboardLayout>
        <InternalNav />
        <div className="p-8 space-y-3">
          <p className="text-sm text-muted-foreground">Customer not found.</p>
          <Button variant="outline" onClick={() => navigate("/customers")}><ArrowLeft className="h-4 w-4 mr-1" /> Back to Customers</Button>
        </div>
      </DashboardLayout>
    );
  }

  const { customer, properties, appointments, leads, captures, callLogs, rebateCalculations, opportunities, estimates, invoices, counts, summary } = data;

  // Display-only identity: prefers structured fields, falls back to the composite
  // QBO name parser. Never writes back to the stored customer record.
  const identity = resolveCustomerIdentity(customer);
  const primaryProp = properties.find(p => p.isPrimary) ?? properties[0];
  const primaryAddress = primaryProp
    ? [primaryProp.addressLine1, primaryProp.city, primaryProp.state, primaryProp.zip].filter(Boolean).join(", ")
    : identity.serviceAddress;

  const openEdit = () => {
    setEditForm({
      firstName: customer.firstName || "",
      lastName: customer.lastName || "",
      companyName: customer.companyName || "",
      email: customer.email || "",
      phone: customer.phone || "",
      altPhone: customer.altPhone || "",
      notes: customer.notes || "",
      status: customer.status,
      type: customer.type,
    });
    setEditOpen(true);
  };

  const openAddProperty = () => {
    setEditingPropId(null);
    setPropForm({ ...EMPTY_PROPERTY, propertyType: customer.type, isPrimary: properties.length === 0 });
    setPropOpen(true);
  };

  const openEditProperty = (p: (typeof properties)[number]) => {
    setEditingPropId(p.id);
    setPropForm({
      label: p.label || "",
      addressLine1: p.addressLine1,
      addressLine2: p.addressLine2 || "",
      city: p.city || "",
      state: p.state || "NJ",
      zip: p.zip || "",
      propertyType: p.propertyType,
      squareFeet: p.squareFeet ? String(p.squareFeet) : "",
      existingSystem: p.existingSystem || "",
      isPrimary: p.isPrimary,
    });
    setPropOpen(true);
  };

  const saveProperty = () => {
    if (!propForm.addressLine1.trim()) {
      toast({ title: "Address is required", variant: "destructive" });
      return;
    }
    const payload = {
      label: propForm.label || null,
      addressLine1: propForm.addressLine1,
      addressLine2: propForm.addressLine2 || null,
      city: propForm.city || null,
      state: propForm.state || null,
      zip: propForm.zip || null,
      propertyType: propForm.propertyType,
      squareFeet: propForm.squareFeet ? parseInt(propForm.squareFeet) : null,
      existingSystem: propForm.existingSystem || null,
      isPrimary: propForm.isPrimary,
    };
    if (editingPropId) updateProperty.mutate({ id: editingPropId, ...payload });
    else addProperty.mutate({ customerId, ...payload });
  };

  const qbLabel: Record<string, string> = {
    not_synced: "Not synced",
    pending: "Sync pending",
    synced: "Synced",
    error: "Sync error",
  };

  return (
    <DashboardLayout>
      <InternalNav />
      <div className="space-y-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/customers")} className="-ml-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Customers
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {customer.type === "commercial" ? <Building2 className="h-6 w-6 text-[#1e3a5f]" /> : <UserRound className="h-6 w-6 text-[#1e3a5f]" />}
              {identity.name}
            </h1>
            {(identity.projectReference || (identity.derivedFromComposite && identity.serviceAddress)) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {identity.projectReference && <span className="inline-flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> Project {identity.projectReference}</span>}
                {identity.serviceAddress && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {identity.serviceAddress}</span>}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary" className="capitalize">{customer.type}</Badge>
              <Badge variant="secondary" className={customer.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>{customer.status}</Badge>
              {/* QuickBooks status — display only until Phase 2 */}
              <Badge variant="outline" className="text-muted-foreground">
                QuickBooks: {qbLabel[customer.quickbooksSyncStatus] ?? customer.quickbooksSyncStatus}
              </Badge>
              {customer.source && <span className="text-muted-foreground">Source: {customer.source}</span>}
            </div>
          </div>
          <Button variant="outline" onClick={openEdit}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
        </div>

        {/* Summary cards — the customer dashboard at a glance */}
        <SummaryCards summary={summary} customer={customer} qbLabel={qbLabel} />

        {/* Sections */}
        <Tabs defaultValue="summary">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="properties">Properties ({counts.properties})</TabsTrigger>
            <TabsTrigger value="jobs">Jobs ({counts.jobs})</TabsTrigger>
            <TabsTrigger value="opportunities">Opportunities ({counts.opportunities})</TabsTrigger>
            <TabsTrigger value="estimates">Estimates / Proposals ({counts.estimates})</TabsTrigger>
            <TabsTrigger value="invoices">Invoices ({counts.invoices})</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <QuickBooksCard customer={customer} customerId={customerId} onChange={refetch} />
            <Card>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[#1e3a5f]" />
                  {customer.phone ? <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a> : <span className="text-muted-foreground">No phone</span>}
                  {customer.altPhone && <span className="text-muted-foreground">· alt {customer.altPhone}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#1e3a5f]" />
                  {customer.email ? <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a> : <span className="text-muted-foreground">No email</span>}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" /> Customer since {formatDate(customer.createdAt)}
                </div>
                {customer.notes && (
                  <div className="md:col-span-3 text-muted-foreground whitespace-pre-wrap border-t pt-3">{customer.notes}</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="properties">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-[#1e3a5f]" /> Properties ({properties.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={openAddProperty}><Plus className="h-4 w-4 mr-1" /> Add Property</Button>
              </CardHeader>
          <CardContent className="space-y-3">
            {properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">No properties on file yet.</p>
            ) : (
              properties.map(p => (
                <div key={p.id} className="flex items-start justify-between gap-3 border rounded-lg p-3">
                  <div className="text-sm space-y-0.5">
                    <div className="font-medium flex items-center gap-2">
                      {p.propertyType === "commercial" ? <Building2 className="h-4 w-4 text-muted-foreground" /> : <Home className="h-4 w-4 text-muted-foreground" />}
                      {p.label || (p.propertyType === "commercial" ? "Commercial site" : "Residence")}
                      {p.isPrimary && <Badge variant="secondary" className="bg-blue-100 text-blue-700"><Star className="h-3 w-3 mr-0.5" /> Primary</Badge>}
                    </div>
                    <div className="text-muted-foreground">
                      {p.addressLine1}{p.addressLine2 ? `, ${p.addressLine2}` : ""}{p.city ? `, ${p.city}` : ""}{p.state ? `, ${p.state}` : ""} {p.zip || ""}
                    </div>
                    {(p.squareFeet || p.existingSystem) && (
                      <div className="text-xs text-muted-foreground">
                        {p.squareFeet ? `${p.squareFeet.toLocaleString()} sq ft` : ""}{p.squareFeet && p.existingSystem ? " · " : ""}{p.existingSystem || ""}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => openEditProperty(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteProperty.mutate({ id: p.id })}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </div>
              ))
            )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs">
            <CustomerJobsTab customerId={customerId} />
          </TabsContent>

          <TabsContent value="opportunities">
            <Card><CardContent className="pt-6 space-y-3">
              {opportunities.length === 0 ? <p className="text-sm text-muted-foreground">No opportunities linked to this customer.</p> :
                opportunities.map(o => (
                  <div
                    key={o.id}
                    className="flex items-start justify-between gap-3 border rounded-lg p-3 text-sm cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(opportunityRoute(o))}
                  >
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-2"><Target className="h-3.5 w-3.5 text-[#1e3a5f] shrink-0" /><span className="truncate">{o.title}</span></div>
                      <MetaLine items={[
                        { icon: <Calendar className="h-3.5 w-3.5" />, label: formatDate(o.closedAt ?? o.createdAt) },
                        o.projectReference ? { icon: <Tag className="h-3.5 w-3.5" />, label: o.projectReference } : null,
                        o.quickbooksReference ? { icon: <Hash className="h-3.5 w-3.5" />, label: `QBO Estimate ${o.quickbooksReference}` } : null,
                        primaryAddress ? { icon: <MapPin className="h-3.5 w-3.5" />, label: primaryAddress } : null,
                      ]} />
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="secondary" className={OPP_STAGE[o.stage] ?? ""}>{o.stage.replace(/_/g, " ")}</Badge>
                      <span className="font-semibold">{formatMoney(Number(o.amount))}</span>
                    </div>
                  </div>
                ))}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="estimates">
            <SalesDocList docs={estimates} kind="estimate" primaryAddress={primaryAddress} onOpenOpportunity={id => navigate(opportunityRoute({ id }))} />
          </TabsContent>

          <TabsContent value="invoices">
            <SalesDocList docs={invoices} kind="invoice" primaryAddress={primaryAddress} onOpenOpportunity={id => navigate(opportunityRoute({ id }))} />
          </TabsContent>

          <TabsContent value="timeline">
            <TimelineTab
              appointments={appointments}
              leads={leads}
              captures={captures}
              callLogs={callLogs}
              rebates={rebateCalculations}
              onNewAppointment={() => { setEditingAppt(null); setApptOpen(true); }}
              onEditAppointment={a => { setEditingAppt(a as unknown as EditableAppointment); setApptOpen(true); }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit customer dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={editForm.type} onValueChange={v => setEditForm(f => ({ ...f, type: v as typeof f.type }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v as typeof f.status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>First name</Label>
              <Input value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Company name</Label>
              <Input value={editForm.companyName} onChange={e => setEditForm(f => ({ ...f, companyName: e.target.value }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Alt phone</Label>
              <Input value={editForm.altPhone} onChange={e => setEditForm(f => ({ ...f, altPhone: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#16304f]"
              disabled={updateCustomer.isPending}
              onClick={() => updateCustomer.mutate({
                id: customerId,
                type: editForm.type,
                status: editForm.status,
                firstName: editForm.firstName || null,
                lastName: editForm.lastName || null,
                companyName: editForm.companyName || null,
                email: editForm.email || null,
                phone: editForm.phone || null,
                altPhone: editForm.altPhone || null,
                notes: editForm.notes || null,
              })}
            >
              {updateCustomer.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/edit property dialog */}
      <Dialog open={propOpen} onOpenChange={setPropOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPropId ? "Edit Property" : "Add Property"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Label</Label>
              <Input placeholder="Home, Warehouse…" value={propForm.label} onChange={e => setPropForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={propForm.propertyType} onValueChange={v => setPropForm(f => ({ ...f, propertyType: v as typeof f.propertyType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Address line 1 *</Label>
              <Input value={propForm.addressLine1} onChange={e => setPropForm(f => ({ ...f, addressLine1: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Address line 2</Label>
              <Input value={propForm.addressLine2} onChange={e => setPropForm(f => ({ ...f, addressLine2: e.target.value }))} />
            </div>
            <div>
              <Label>City</Label>
              <Input value={propForm.city} onChange={e => setPropForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>State</Label>
                <Input value={propForm.state} onChange={e => setPropForm(f => ({ ...f, state: e.target.value }))} />
              </div>
              <div>
                <Label>Zip</Label>
                <Input value={propForm.zip} onChange={e => setPropForm(f => ({ ...f, zip: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Square feet</Label>
              <Input type="number" value={propForm.squareFeet} onChange={e => setPropForm(f => ({ ...f, squareFeet: e.target.value }))} />
            </div>
            <div>
              <Label>Existing system</Label>
              <Input placeholder="gas furnace, oil boiler…" value={propForm.existingSystem} onChange={e => setPropForm(f => ({ ...f, existingSystem: e.target.value }))} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                id="prop-primary"
                type="checkbox"
                checked={propForm.isPrimary}
                onChange={e => setPropForm(f => ({ ...f, isPrimary: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="prop-primary">Primary property</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPropOpen(false)}>Cancel</Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#16304f]" disabled={addProperty.isPending || updateProperty.isPending} onClick={saveProperty}>
              {addProperty.isPending || updateProperty.isPending ? "Saving…" : "Save Property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AppointmentDialog
        open={apptOpen}
        onClose={() => setApptOpen(false)}
        onSaved={() => refetch()}
        appointment={editingAppt}
        defaults={{
          customerId,
          fullName: customer.displayName,
          phone: customer.phone || "",
          email: customer.email || "",
          propertyType: customer.type,
          propertyAddress: properties.find(p => p.isPrimary)?.addressLine1 || properties[0]?.addressLine1 || "",
          propertyId: properties.find(p => p.isPrimary)?.id ?? properties[0]?.id,
        }}
      />
    </DashboardLayout>
  );
}


/** Jobs tab on the customer 360 view (Task 6). */
function CustomerJobsTab({ customerId }: { customerId: number }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data, refetch } = trpc.jobs.list.useQuery({ customerId, limit: 50, offset: 0 });
  const createJob = trpc.jobs.create.useMutation({
    onSuccess: res => { toast({ title: `Job ${res.jobNumber} created` }); refetch(); navigate(jobRoute(res)); },
    onError: e => toast({ title: "Could not create job", description: e.message, variant: "destructive" }),
  });
  const items = data?.items ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4 text-[#1e3a5f]" /> Jobs ({items.length})</CardTitle>
        <Button
          size="sm"
          variant="outline"
          disabled={createJob.isPending}
          onClick={() => createJob.mutate({ customerId, title: "New job", priority: "normal" })}
        >
          <Plus className="h-4 w-4 mr-1" /> New Job
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs for this customer yet.</p>
        ) : (
          items.map(({ job, lineTotal }) => {
            const meta = JOB_STATUS_META.find(m => m.value === job.status);
            return (
              <div
                key={job.id}
                className="flex items-center justify-between border rounded-lg p-3 text-sm cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(jobRoute(job))}
              >
                <div>
                  <div className="font-medium"><span className="font-mono text-muted-foreground mr-2">{job.jobNumber}</span>{job.title}</div>
                  <div className="text-muted-foreground">{formatMoney(Number(lineTotal))}</div>
                </div>
                <Badge variant="secondary" className={meta?.badge ?? ""}>{meta?.label ?? job.status}</Badge>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

type CustomerSummary = {
  activeJobs: number;
  openOpportunities: number;
  estimates: number;
  invoices: number;
  properties: number;
  lifetimeRevenue: number;
  outstandingBalance: number;
  lastActivityAt: string | null;
};

/** The nine at-a-glance metric cards at the top of the customer dashboard. */
function SummaryCards({
  summary, customer, qbLabel,
}: {
  summary: CustomerSummary;
  customer: { quickbooksSyncStatus: string; quickbooksCustomerId: string | null };
  qbLabel: Record<string, string>;
}) {
  const cards: Array<{ label: string; value: string; icon: ReactNode; hint?: string }> = [
    { label: "Active Jobs", value: String(summary.activeJobs), icon: <Briefcase className="h-4 w-4" /> },
    { label: "Open Opportunities", value: String(summary.openOpportunities), icon: <Target className="h-4 w-4" /> },
    { label: "Estimates", value: String(summary.estimates), icon: <FileText className="h-4 w-4" /> },
    { label: "Invoices", value: String(summary.invoices), icon: <Receipt className="h-4 w-4" /> },
    { label: "Properties", value: String(summary.properties), icon: <MapPin className="h-4 w-4" /> },
    { label: "Lifetime Revenue", value: formatMoney(summary.lifetimeRevenue), icon: <DollarSign className="h-4 w-4" /> },
    { label: "Outstanding Balance", value: formatMoney(summary.outstandingBalance), icon: <Wallet className="h-4 w-4" /> },
    { label: "Last Activity", value: summary.lastActivityAt ? formatDate(summary.lastActivityAt) : "—", icon: <Clock className="h-4 w-4" /> },
    {
      label: "QuickBooks",
      value: qbLabel[customer.quickbooksSyncStatus] ?? customer.quickbooksSyncStatus,
      hint: customer.quickbooksCustomerId ? `#${customer.quickbooksCustomerId}` : "Not linked",
      icon: <Building2 className="h-4 w-4" />,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map(c => (
        <Card key={c.label}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{c.icon}<span className="truncate">{c.label}</span></div>
            <div className="mt-1 text-lg font-bold text-[#1e3a5f] truncate">{c.value}</div>
            {c.hint && <div className="text-[11px] text-muted-foreground truncate">{c.hint}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface TLAppt { id: number; appointmentType: string; scheduledAt: Date | string | null; preferredDate: string; preferredTime: string; durationMinutes: number | null; status: string }
interface TLLead { id: number; service: string | null; source: string | null; convertedAt: Date | string | null; status: string }
interface TLCapture { id: number; captureType: string; createdAt: Date | string | null; convertedAt: Date | string | null; status: string }
interface TLCall { id: number; direction: string | null; phoneNumber: string | null; createdAt: Date | string | null; duration: number | null; leadQuality: string | null }
interface TLRebate { id: number; address: string | null; createdAt: Date | string | null }

/** Timeline section: appointments, leads/captures, calls and rebate calcs for this customer. */
function TimelineTab({
  appointments, leads, captures, callLogs, rebates, onNewAppointment, onEditAppointment,
}: {
  appointments: TLAppt[];
  leads: TLLead[];
  captures: TLCapture[];
  callLogs: TLCall[];
  rebates: TLRebate[];
  onNewAppointment: () => void;
  onEditAppointment: (a: TLAppt) => void;
}) {
  const isEmpty = appointments.length + leads.length + captures.length + callLogs.length + rebates.length === 0;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-[#1e3a5f]" /> Appointments ({appointments.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={onNewAppointment}><Plus className="h-4 w-4 mr-1" /> New Appointment</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {appointments.length === 0 ? <p className="text-sm text-muted-foreground">No appointments yet.</p> :
            appointments.map(a => (
              <div key={a.id} className="flex items-center justify-between border rounded-lg p-3 text-sm cursor-pointer hover:bg-muted/50" onClick={() => onEditAppointment(a)}>
                <div>
                  <div className="font-medium capitalize">{a.appointmentType.replace(/_/g, " ")}</div>
                  <div className="text-muted-foreground">
                    {a.scheduledAt ? formatDate(a.scheduledAt) : `${a.preferredDate} · ${a.preferredTime} (unscheduled)`}
                    {a.durationMinutes ? ` · ${a.durationMinutes} min` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={APPT_STATUS[a.status] || ""}>{a.status}</Badge>
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {(leads.length + captures.length > 0) && (
        <Card><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> Leads ({leads.length + captures.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {leads.map(l => (
              <div key={`lead-${l.id}`} className="flex items-center justify-between border rounded-lg p-3 text-sm">
                <div>
                  <div className="font-medium flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-amber-500" /> {l.service} <span className="text-muted-foreground">via {l.source}</span></div>
                  <div className="text-muted-foreground">Converted {formatDate(l.convertedAt)}</div>
                </div>
                <Badge variant="secondary" className="capitalize">{l.status}</Badge>
              </div>
            ))}
            {captures.map(c => (
              <div key={`cap-${c.id}`} className="flex items-center justify-between border rounded-lg p-3 text-sm">
                <div>
                  <div className="font-medium">{c.captureType.replace(/_/g, " ")}</div>
                  <div className="text-muted-foreground">Captured {formatDate(c.createdAt)} · Converted {formatDate(c.convertedAt)}</div>
                </div>
                <Badge variant="secondary" className="capitalize">{c.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {callLogs.length > 0 && (
        <Card><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><PhoneCall className="h-4 w-4 text-[#1e3a5f]" /> Calls ({callLogs.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {callLogs.map(cl => (
              <div key={cl.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-[#1e3a5f]" />
                  <div>
                    <div className="font-medium capitalize">{cl.direction} · {cl.phoneNumber}</div>
                    <div className="text-muted-foreground">{formatDate(cl.createdAt)}{cl.duration ? ` · ${Math.round(cl.duration / 60)} min` : ""}</div>
                  </div>
                </div>
                {cl.leadQuality && <Badge variant="secondary" className="capitalize">{cl.leadQuality}</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {rebates.length > 0 && (
        <Card><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-green-600" /> Rebate Calculations ({rebates.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {rebates.map(r => (
              <div key={r.id} className="border rounded-lg p-3 text-sm">
                <div className="font-medium">{r.address}</div>
                <div className="text-muted-foreground">{formatDate(r.createdAt)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isEmpty && <p className="text-sm text-muted-foreground">No activity recorded for this customer yet.</p>}
    </div>
  );
}

type ProfileSalesDoc = {
  id: number;
  docNumber: string | null;
  quickbooksId: string;
  quickbooksCustomerId: string | null;
  status: string;
  totalAmount: string;
  txnDate: Date | string | null;
  opportunityId: number | null;
  projectReference: string | null;
  opportunityTitle: string | null;
};

/** Estimates / Proposals and Invoices list on the customer 360 view. */
function SalesDocList({
  docs, kind, primaryAddress, onOpenOpportunity,
}: {
  docs: ProfileSalesDoc[];
  kind: "estimate" | "invoice";
  primaryAddress: string | null;
  onOpenOpportunity: (opportunityId: number) => void;
}) {
  const empty = kind === "estimate"
    ? "No estimates or proposals linked to this customer."
    : "No invoices synced for this customer yet.";
  return (
    <Card><CardContent className="pt-6 space-y-3">
      {docs.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> :
        docs.map(d => (
          <div
            key={d.id}
            className={`flex items-start justify-between gap-3 border rounded-lg p-3 text-sm ${d.opportunityId ? "cursor-pointer hover:bg-muted/50" : ""}`}
            onClick={() => d.opportunityId && onOpenOpportunity(d.opportunityId)}
          >
            <div className="min-w-0">
              <div className="font-medium flex items-center gap-2">
                {kind === "estimate" ? <FileText className="h-3.5 w-3.5 text-[#1e3a5f] shrink-0" /> : <Receipt className="h-3.5 w-3.5 text-[#1e3a5f] shrink-0" />}
                <span className="truncate">{d.docNumber ? `#${d.docNumber}` : `QBO ${d.quickbooksId}`}</span>
                {d.opportunityTitle && <span className="text-muted-foreground truncate hidden sm:inline">· {d.opportunityTitle}</span>}
              </div>
              <MetaLine items={[
                { icon: <Calendar className="h-3.5 w-3.5" />, label: formatDate(d.txnDate) },
                d.projectReference ? { icon: <Tag className="h-3.5 w-3.5" />, label: d.projectReference } : null,
                { icon: <Hash className="h-3.5 w-3.5" />, label: `QBO ${kind === "estimate" ? "Estimate" : "Invoice"} ${d.quickbooksId}` },
                d.quickbooksCustomerId ? { icon: <UserRound className="h-3.5 w-3.5" />, label: `QBO Customer ${d.quickbooksCustomerId}` } : null,
                primaryAddress ? { icon: <MapPin className="h-3.5 w-3.5" />, label: primaryAddress } : null,
              ]} />
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant="secondary" className={DOC_STATUS[d.status] ?? ""}>{d.status}</Badge>
              <span className="font-semibold">{formatMoney(Number(d.totalAmount))}</span>
            </div>
          </div>
        ))}
    </CardContent></Card>
  );
}

/**
 * QuickBooks sync panel (Task 7). Live once QuickBooks is connected:
 * push/link/update a customer with merge protection, pull current QBO values,
 * and resolve duplicate-name / match conflicts inline.
 */
function QuickBooksCard({
  customer,
  customerId,
  onChange,
}: {
  customer: {
    quickbooksCustomerId: string | null;
    quickbooksSyncStatus: string;
    quickbooksSyncedAt: Date | string | null;
    quickbooksSyncError: string | null;
  };
  customerId: number;
  onChange: () => void;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const statusQ = trpc.quickbooks.getStatus.useQuery();
  const [conflict, setConflict] = useState<
    | { matchedBy: string; candidate: { qbId: string; displayName: string; email?: string | null; phone?: string | null } }
    | null
  >(null);

  const push = trpc.quickbooks.pushCustomer.useMutation({
    onSuccess: res => {
      if (res.outcome === "conflict") {
        setConflict({ matchedBy: res.matchedBy, candidate: res.candidate });
        toast({ title: "Possible duplicate in QuickBooks", description: `Matched by ${res.matchedBy}` });
      } else {
        setConflict(null);
        toast({ title: `QuickBooks: ${res.outcome}` });
        onChange();
      }
    },
    onError: e => toast({ title: "Push failed", description: e.message, variant: "destructive" }),
  });
  const pull = trpc.quickbooks.pullCustomer.useMutation({
    onSuccess: () => { toast({ title: "Synced from QuickBooks" }); onChange(); },
    onError: e => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });
  const resolve = trpc.quickbooks.resolveConflict.useMutation({
    onSuccess: res => { setConflict(null); toast({ title: `Resolved: ${res.outcome}` }); onChange(); },
    onError: e => toast({ title: "Resolve failed", description: e.message, variant: "destructive" }),
  });

  const connected = statusQ.data?.connected;
  const linked = Boolean(customer.quickbooksCustomerId);
  const busy = push.isPending || pull.isPending || resolve.isPending;

  if (!connected) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" /> QuickBooks not connected
          </span>
          <Button variant="outline" size="sm" onClick={() => navigate("/settings/integrations")}>
            <Plug className="h-4 w-4 mr-1" /> Connect
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-[#1e3a5f]">
          <Building2 className="h-4 w-4" /> QuickBooks
        </CardTitle>
        {linked
          ? <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" /> Linked · {customer.quickbooksCustomerId}</Badge>
          : <Badge variant="secondary" className="text-muted-foreground">Not linked</Badge>}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {linked && (
          <div className="text-muted-foreground">Last sync: {formatDate(customer.quickbooksSyncedAt)}</div>
        )}
        {customer.quickbooksSyncStatus === "error" && customer.quickbooksSyncError && (
          <div className="flex items-start gap-2 text-red-600"><XCircle className="h-4 w-4 mt-0.5 shrink-0" />{customer.quickbooksSyncError}</div>
        )}

        {conflict ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
            <div className="font-medium text-amber-800">Matched an existing QuickBooks customer (by {conflict.matchedBy})</div>
            <div className="text-amber-900">
              {conflict.candidate.displayName}
              {conflict.candidate.email && <span className="text-muted-foreground"> · {conflict.candidate.email}</span>}
              {conflict.candidate.phone && <span className="text-muted-foreground"> · {conflict.candidate.phone}</span>}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={() => resolve.mutate({ customerId, resolution: "link" })} disabled={busy}>
                <Link2 className="h-4 w-4 mr-1" /> Link to existing
              </Button>
              <Button size="sm" variant="outline" onClick={() => resolve.mutate({ customerId, resolution: "update" })} disabled={busy}>
                Update existing
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { resolve.mutate({ customerId, resolution: "skip" }); setConflict(null); }} disabled={busy}>
                Skip
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => push.mutate({ customerId })} disabled={busy}>
              {push.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              {linked ? "Re-push" : "Push to QuickBooks"}
            </Button>
            {linked && (
              <Button size="sm" variant="outline" onClick={() => pull.mutate({ customerId })} disabled={busy}>
                {pull.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Sync from QuickBooks
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

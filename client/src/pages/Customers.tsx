import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, ChevronRight, Home, Mail, Phone, Plus, Search, UserRound, Users,
} from "lucide-react";
import { relationshipLabel } from "@shared/leadPipeline";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-100 text-gray-600",
};

const RELATIONSHIP_BADGE: Record<string, string> = {
  Lead: "bg-slate-100 text-slate-700",
  Prospect: "bg-amber-100 text-amber-800",
  Customer: "bg-green-100 text-green-800",
};

export default function Customers() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "residential" | "commercial">("all");
  const [statusFilter, setStatusFilter] = useState<"default" | "active" | "inactive" | "archived">("default");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: stats } = trpc.customers.stats.useQuery();
  const { data, isLoading, refetch } = trpc.customers.list.useQuery({
    search: search || undefined,
    type: typeFilter === "all" ? undefined : typeFilter,
    status: statusFilter === "default" ? undefined : statusFilter,
    limit: 100,
    offset: 0,
  });

  // Create form state
  const [form, setForm] = useState({
    type: "residential" as "residential" | "commercial",
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    phone: "",
  });

  const createCustomer = trpc.customers.create.useMutation({
    onSuccess: res => {
      toast({ title: "Customer created" });
      setCreateOpen(false);
      setForm({ type: "residential", firstName: "", lastName: "", companyName: "", email: "", phone: "" });
      refetch();
      navigate(`/customers/${res.id}`);
    },
    onError: err => toast({ title: "Could not create customer", description: err.message, variant: "destructive" }),
  });

  const handleCreate = () => {
    if (!form.firstName && !form.lastName && !form.companyName && !form.email && !form.phone) {
      toast({ title: "Add at least a name, email, or phone", variant: "destructive" });
      return;
    }
    createCustomer.mutate({
      type: form.type,
      firstName: form.firstName || null,
      lastName: form.lastName || null,
      companyName: form.companyName || null,
      email: form.email || null,
      phone: form.phone || null,
    });
  };

  const items = data?.items ?? [];

  return (
    <DashboardLayout>
      <InternalNav />
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-[#1e3a5f]" /> Contacts
            </h1>
            <p className="text-sm text-muted-foreground">
              One record per person — Lead, Prospect, or Customer. No duplicates.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="bg-[#1e3a5f] hover:bg-[#16304f]">
            <Plus className="h-4 w-4 mr-1" /> Add Contact
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold">{stats?.total ?? 0}</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Home className="h-3.5 w-3.5" /> Residential</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold">{stats?.residential ?? 0}</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Commercial</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold">{stats?.commercial ?? 0}</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold">{stats?.active ?? 0}</span></CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, or phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="residential">Residential</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Active + Inactive</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Contacts ({data?.total ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading customers…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No contacts yet. New leads become contacts automatically, or add one manually.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(c => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/customers/${c.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          {c.type === "commercial"
                            ? <Building2 className="h-4 w-4 text-muted-foreground" />
                            : <UserRound className="h-4 w-4 text-muted-foreground" />}
                          {c.displayName}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          // Relationship is derived server-side from real signals
                          // (lead stage, won jobs, appointments) — Lead by default,
                          // never assumed Customer.
                          const label = relationshipLabel(c.relationship ?? "lead");
                          return <Badge className={RELATIONSHIP_BADGE[label]} variant="secondary">{label}</Badge>;
                        })()}
                      </TableCell>
                      <TableCell className="capitalize text-sm">{c.type}</TableCell>
                      <TableCell>
                        <div className="text-sm space-y-0.5">
                          {c.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" />{c.phone}</div>}
                          {c.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" />{c.email}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.source || "—"}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGE[c.status] || STATUS_BADGE.active} variant="secondary">
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as typeof form.type }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>First name</Label>
              <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
            {form.type === "commercial" && (
              <div className="col-span-2">
                <Label>Company name</Label>
                <Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
              </div>
            )}
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createCustomer.isPending} className="bg-[#1e3a5f] hover:bg-[#16304f]">
              {createCustomer.isPending ? "Creating…" : "Create Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

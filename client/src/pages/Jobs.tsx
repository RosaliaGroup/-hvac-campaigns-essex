/**
 * /jobs — Jobs list (Phase 2, Task 6).
 * The operational pipeline view: filter by status/type/priority/technician/date,
 * sort, paginate, and toggle archived. Rows open the job detail.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Briefcase, ChevronRight, ChevronLeft, Search, ArrowUpDown, Plus } from "lucide-react";
import { JOB_STATUS_META, JOB_TYPE_LABELS, formatMoney } from "@/lib/jobPresentation";

const PAGE_SIZE = 25;
const SORTABLE = [
  { key: "createdAt", label: "Created" },
  { key: "scheduledStartAt", label: "Scheduled" },
  { key: "jobNumber", label: "Job #" },
  { key: "status", label: "Status" },
] as const;

export default function Jobs() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [archived, setArchived] = useState<"active" | "archived" | "all">("active");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const { data: stats = {} } = trpc.jobs.stats.useQuery();
  const { data: assignees = [] } = trpc.appointments.assignees.useQuery();
  const { data, isLoading } = trpc.jobs.list.useQuery({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : (statusFilter as never),
    jobType: typeFilter === "all" ? undefined : (typeFilter as never),
    priority: priorityFilter === "all" ? undefined : (priorityFilter as never),
    assignedToId: assigneeFilter === "all" ? undefined : parseInt(assigneeFilter),
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    archived,
    sortBy,
    sortDir,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const openCount = Object.entries(stats)
    .filter(([s]) => !["closed", "cancelled", "paid"].includes(s))
    .reduce((n, [, c]) => n + c, 0);

  const resetPage = () => setPage(0);
  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("desc"); }
    resetPage();
  };
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <DashboardLayout>
      <InternalNav />
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-[#1e3a5f]" /> Jobs
            </h1>
            <p className="text-sm text-muted-foreground">
              The operational record — {openCount} open job{openCount === 1 ? "" : "s"}. Create jobs from a customer, opportunity, or a calendar appointment.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/customers")}>
            <Plus className="h-4 w-4 mr-1" /> New Job
          </Button>
        </div>

        {/* Pipeline chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setStatusFilter("all"); resetPage(); }}
            className={`text-xs px-2.5 py-1 rounded-full border ${statusFilter === "all" ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-white hover:bg-muted"}`}
          >
            All ({Object.values(stats).reduce((a, b) => a + b, 0)})
          </button>
          {JOB_STATUS_META.map(m => (
            <button
              key={m.value}
              onClick={() => { setStatusFilter(statusFilter === m.value ? "all" : m.value); resetPage(); }}
              className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${statusFilter === m.value ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-white hover:bg-muted"}`}
            >
              <span className={`h-2 w-2 rounded-full ${m.dot}`} />
              {m.label} ({stats[m.value] ?? 0})
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search job #, title, or customer…" value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} className="pl-8" />
          </div>
          <Select value={assigneeFilter} onValueChange={v => { setAssigneeFilter(v); resetPage(); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Technician" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All technicians</SelectItem>
              {assignees.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); resetPage(); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(JOB_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={v => { setPriorityFilter(v); resetPage(); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any priority</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
            </SelectContent>
          </Select>
          <Select value={archived} onValueChange={v => { setArchived(v as never); resetPage(); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground text-xs">Scheduled</span>
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); resetPage(); }} className="w-36" />
            <span className="text-muted-foreground">–</span>
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); resetPage(); }} className="w-36" />
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading jobs…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {archived === "archived"
                  ? "No archived jobs match these filters."
                  : "No jobs match these filters. Open a customer and click \"New Job\", or use \"Create Job\" on a calendar appointment."}
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {SORTABLE.filter(s => s.key === "jobNumber").map(s => (
                        <TableHead key={s.key} className="cursor-pointer select-none" onClick={() => toggleSort(s.key)}>
                          <span className="inline-flex items-center gap-1">Job # <ArrowUpDown className="h-3 w-3 opacity-60" /></span>
                        </TableHead>
                      ))}
                      <TableHead>Title</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("scheduledStartAt")}>
                        <span className="inline-flex items-center gap-1">Scheduled <ArrowUpDown className="h-3 w-3 opacity-60" /></span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")}>
                        <span className="inline-flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3 opacity-60" /></span>
                      </TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(({ job, customerName, assigneeName, lineTotal }) => {
                      const meta = JOB_STATUS_META.find(m => m.value === job.status);
                      return (
                        <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/jobs/${job.id}`)}>
                          <TableCell className="font-mono text-sm">{job.jobNumber}</TableCell>
                          <TableCell className="font-medium max-w-xs truncate">
                            {job.title}
                            {job.priority !== "normal" && (
                              <Badge variant="secondary" className={`ml-2 ${job.priority === "emergency" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                {job.priority}
                              </Badge>
                            )}
                            {job.archivedAt && <Badge variant="outline" className="ml-2 text-muted-foreground">Archived</Badge>}
                          </TableCell>
                          <TableCell className="text-sm">{customerName ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {job.scheduledStartAt ? new Date(job.scheduledStartAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={meta?.badge ?? ""}>{meta?.label ?? job.status}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{assigneeName ?? "Unassigned"}</TableCell>
                          <TableCell className="text-right font-medium">{formatMoney(Number(lineTotal))}</TableCell>
                          <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
                  <span>
                    {total === 0 ? "0" : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)}`} of {total}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </Button>
                    <span>Page {page + 1} / {pageCount}</span>
                    <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage(p => p + 1)}>
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

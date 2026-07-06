/**
 * /jobs — Jobs list (Phase 2, Task 6).
 * The operational pipeline view: every job, filterable by status/assignee/search.
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
import { Briefcase, ChevronRight, Search } from "lucide-react";
import { JOB_STATUS_META, formatMoney } from "@/lib/jobPresentation";

export default function Jobs() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const { data: stats = {} } = trpc.jobs.stats.useQuery();
  const { data: assignees = [] } = trpc.appointments.assignees.useQuery();
  const { data, isLoading } = trpc.jobs.list.useQuery({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : (statusFilter as never),
    assignedToId: assigneeFilter === "all" ? undefined : parseInt(assigneeFilter),
    limit: 200,
    offset: 0,
  });

  const items = data?.items ?? [];
  const openCount = Object.entries(stats)
    .filter(([s]) => !["closed", "cancelled", "paid"].includes(s))
    .reduce((n, [, c]) => n + c, 0);

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
              The operational record — {openCount} open job{openCount === 1 ? "" : "s"}. Create jobs from a customer or from an appointment on the calendar.
            </p>
          </div>
        </div>

        {/* Pipeline chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter("all")}
            className={`text-xs px-2.5 py-1 rounded-full border ${statusFilter === "all" ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-white hover:bg-muted"}`}
          >
            All ({Object.values(stats).reduce((a, b) => a + b, 0)})
          </button>
          {JOB_STATUS_META.map(m => (
            <button
              key={m.value}
              onClick={() => setStatusFilter(statusFilter === m.value ? "all" : m.value)}
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
            <Input placeholder="Search job #, title, or customer…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All technicians</SelectItem>
              {assignees.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading jobs…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No jobs yet. Open a customer and click "New Job", or use "Create Job" on a calendar appointment.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
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
                        </TableCell>
                        <TableCell className="text-sm">{customerName ?? "—"}</TableCell>
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
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import AddContactModal from "@/components/AddContactModal";
import ContactIntakePanel from "@/components/ContactIntakePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { formatDisplayName } from "@shared/nameFormat";
import { useAuth } from "@/_core/hooks/useAuth";

type Filters = {
  search: string;
  source: "all" | "gmail" | "other";
  status: "default" | "active" | "inactive" | "archived";
  sort: "newest" | "name";
};
type SavedView = { name: string; filters: Filters };
const initial: Filters = {
  search: "",
  source: "all",
  status: "default",
  sort: "newest",
};
const columns = [
  "Email",
  "Phone",
  "Company",
  "Lifecycle stage",
  "Contact role",
  "Service type",
  "Source",
  "Status",
  "Created",
];
function readStored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* View still works without browser storage. */
  }
}
export default function Customers() {
  const { user } = useAuth();
  const key = `crm-contact-views:${user?.id ?? "guest"}`;
  const [, navigate] = useLocation();
  const [filters, setFilters] = useState<Filters>(initial);
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [contactNotice,setContactNotice] = useState("");
  const approveContact=trpc.crmCommunications.addSelectedContact.useMutation();
  const [columnOpen, setColumnOpen] = useState(false);
  const [visible, setVisible] = useState<string[]>(columns);
  const [saved, setSaved] = useState<SavedView[]>([]);

  const [viewName, setViewName] = useState("");
  // Reload preferences when the signed-in account changes.
  useEffect(() => {
    setSaved(readStored(key, []));
    setVisible(readStored(`${key}:columns`, columns));
  }, [key]);
  const change = (patch: Partial<Filters>) => {
    setFilters(f => ({ ...f, ...patch }));
    setPage(0);
  };
  const { data, isLoading, error, refetch, isFetching } =
    trpc.customers.list.useQuery(
      {
        search: filters.search || undefined,
        source: filters.source === "all" ? undefined : filters.source,
        completedOnly: true,
        status: filters.status === "default" ? undefined : filters.status,
        sort: filters.sort,
        limit: 50,
        offset: page * 50,
      },
      { refetchInterval: 30000 }
    );
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  return (
    <DashboardLayout>
      <InternalNav />
      <div className="min-h-screen bg-[#f5f8fa] p-4 md:p-6 space-y-4 text-[#33475b]">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">
              CRM
            </p>
            <h1 className="text-2xl font-semibold">
              Contacts{" "}
              <span className="text-sm font-normal text-slate-500">
                {total} records
              </span>
            </h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/contacts/communications")}
            >
              Communications
            </Button>
            <Button
              className="bg-[#ff7a59] hover:bg-[#e66e50] text-white"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create contact + property
            </Button>
          </div>
        </header>
        <ContactIntakePanel />
        {contactNotice&&<p role="status" className="text-sm rounded border bg-white p-3">{contactNotice}</p>}
        <div className="rounded-md border bg-white overflow-hidden">
          <nav
            aria-label="Contact views"
            className="flex flex-wrap border-b bg-[#fafcfd] gap-1 px-4 pt-3"
          >
            {[
              { name: "All contacts", filters: initial },
              {
                name: "Selected Gmail / Tasks",
                filters: { ...initial, source: "gmail" as const },
              },
              ...saved,
            ].map((view, i) => (
              <Button
                key={`${view.name}-${i}`}
                variant="ghost"
                className="rounded-b-none border-b-2 border-transparent hover:border-[#00a4bd]"
                onClick={() => {
                  setFilters(view.filters);
                  setPage(0);
                }}
              >
                {view.name}
              </Button>
            ))}
          </nav>
          <div className="p-4 flex flex-wrap items-center gap-2 border-b">
            <div className="relative min-w-60 flex-1">
              <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
              <Input
                aria-label="Search contacts"
                placeholder="Search name, email, phone or company"
                className="pl-9"
                value={filters.search}
                onChange={e => change({ search: e.target.value })}
              />
            </div>
            <select
              aria-label="Source filter"
              className="border rounded p-2 text-sm"
              value={filters.source}
              onChange={e =>
                change({ source: e.target.value as Filters["source"] })
              }
            >
              <option value="all">All sources</option>
              <option value="gmail">Gmail Sent</option>
              <option value="other">Other sources</option>
            </select>
            <select
              aria-label="Status filter"
              className="border rounded p-2 text-sm"
              value={filters.status}
              onChange={e =>
                change({ status: e.target.value as Filters["status"] })
              }
            >
              <option value="default">Active + inactive</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
            <select
              aria-label="Sort contacts"
              className="border rounded p-2 text-sm"
              value={filters.sort}
              onChange={e =>
                change({ sort: e.target.value as Filters["sort"] })
              }
            >
              <option value="newest">Newest first</option>
              <option value="name">Name A–Z</option>
            </select>
            <Button
              variant="outline"
              onClick={() => setColumnOpen(!columnOpen)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Columns
            </Button>
            <Button
              variant="ghost"
              aria-label="Refresh contacts"
              onClick={() => refetch()}
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          {columnOpen && (
            <fieldset className="p-4 border-b flex flex-wrap gap-4">
              <legend className="sr-only">Visible columns</legend>
              {columns.map(c => (
                <label key={c} className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={visible.includes(c)}
                    onChange={e => {
                      const next = e.target.checked
                        ? [...visible, c]
                        : visible.filter(x => x !== c);
                      setVisible(next);
                      persist(`${key}:columns`, next);
                    }}
                  />
                  {c}
                </label>
              ))}
            </fieldset>
          )}
          <div className="px-4 py-2 flex flex-wrap items-center gap-2 border-b text-xs text-slate-500">
            <span>Save these filters as a view:</span>
            <Input
              aria-label="Saved view name"
              className="h-8 w-44"
              placeholder="View name"
              maxLength={60}
              value={viewName}
              onChange={e => setViewName(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!viewName.trim()}
              onClick={() => {
                const next = [
                  ...saved.filter(v => v.name !== viewName.trim()),
                  { name: viewName.trim(), filters },
                ];
                setSaved(next);
                persist(key, next);
                setViewName("");
              }}
            >
              Save view
            </Button>
            {saved.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSaved([]);
                  persist(key, []);
                }}
              >
                Clear saved views
              </Button>
            )}
            <span className="ml-auto">
              Views and columns are saved in this browser.
            </span>
          </div>
          {error ? (
            <p role="alert" className="p-6 text-red-700">
              {error.message}
            </p>
          ) : isLoading ? (
            <p className="p-8 text-center">Loading contacts…</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f5f8fa]">
                    <TableHead className="min-w-52">Contact name</TableHead>
                    {columns
                      .filter(c => visible.includes(c))
                      .map(c => (
                        <TableHead key={c} className="whitespace-nowrap">
                          {c}
                        </TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(c => {
                    const values: Record<string, ReactNode> = {
                      Email: c.email ? (
                        <a
                          className="text-[#007a8c]"
                          href={`mailto:${c.email}`}
                          onClick={e => e.stopPropagation()}
                        >
                          {c.email}
                        </a>
                      ) : (
                        "—"
                      ),
                      Phone: c.phone || "—",
                      Company: c.companyName || "—",
                      "Lifecycle stage": (
                        <Badge variant="secondary">{c.lifecycle}</Badge>
                      ),
                      "Contact role": c.contactRole,
                      "Service type": c.serviceType,
                      Source: c.source || "—",
                      Status: c.status,
                      Created: new Date(c.createdAt).toLocaleDateString(),
                    };
                    return (
                      <TableRow key={c.id} className="hover:bg-[#f0f7fa]">
                        <TableCell>
                          <button
                            className="text-[#007a8c] font-medium text-left hover:underline"
                            onClick={() => navigate(`/customers/${c.id}`)}
                          >
                            {formatDisplayName(c.displayName)}
                          </button>
                        </TableCell>
                        {columns
                          .filter(x => visible.includes(x))
                          .map(x => (
                            <TableCell
                              key={x}
                              className="text-sm whitespace-nowrap capitalize"
                            >
                              {values[x]}
                            </TableCell>
                          ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {items.length === 0 && (
                <p className="p-8 text-center text-slate-500">
                  No contacts match these filters.
                </p>
              )}
            </div>
          )}
          <footer className="p-3 border-t flex items-center justify-between text-sm">
            <span>
              {total
                ? `${page * 50 + 1}–${Math.min((page + 1) * 50, total)} of ${total}`
                : "0 contacts"}
            </span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span>Page {page + 1}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * 50 >= total}
                onClick={() => setPage(p => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </footer>
        </div>
      </div>
      <AddContactModal
        open={createOpen}
        requireComplete
        onClose={() => setCreateOpen(false)}
        onCreated={async c => {
          const customer=c.customer;
          if(customer?.email&&customer.phone){
            try{
              await approveContact.mutateAsync({
                from:"manual",name:customer.displayName,
                email:customer.email,phone:customer.phone,
              });
              setContactNotice("Contact saved and automatic enrichment queued.");
            }catch(error){
              setContactNotice("Contact was created with email and phone, but enrichment needs review: "+
                (error instanceof Error?error.message:"Unknown error"));
            }
          }else{
            setContactNotice("Contact was created but enrichment requires a valid name, email and phone.");
          }
          void refetch();
          navigate(`/customers/${c.customerId}`);
        }}
      />
    </DashboardLayout>
  );
}

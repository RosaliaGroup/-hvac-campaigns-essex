import { useMemo } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { iconFor } from "@/components/navIcons";
import {
  getVisibleDepartments,
  resolveNavRole,
  type NavDepartment,
} from "@/lib/navigation";
import { normalizeStage } from "@shared/leadPipeline";
import { LayoutDashboard, ChevronRight, Users, Star, Phone, Trophy, TrendingUp } from "lucide-react";

/** Subtle per-department accent (kept within the ME palette). */
const DEPT_COLORS: Record<string, string> = {
  sales: "#1e3a5f",
  dispatch: "#0f766e",
  marketing: "#ff6b35",
  accounting: "#7c3aed",
  ai: "#2563eb",
  analytics: "#059669",
  admin: "#dc2626",
};

/**
 * Dashboard — the internal business overview and department hub (route:
 * /command-center; user-facing name: "Dashboard"). Shows key lead metrics and
 * one card per department for quick access. Public header/footer and the Jessica
 * chatbot are not rendered here — this page is mounted inside <DashboardLayout>.
 */
export default function CommandCenter() {
  const { user } = useAuth();
  const role = useMemo(() => resolveNavRole(user), [user]);
  const departments = useMemo(
    () => getVisibleDepartments(role).filter((d) => d.id !== "home"),
    [role]
  );

  // Lightweight business overview from the existing lead endpoints (no new logic).
  const { data: stats } = trpc.leadCaptures.stats.useQuery(undefined, { retry: false });
  const { data: leads = [] } = trpc.leadCaptures.list.useQuery({ limit: 200 }, { retry: false });
  const countOf = (stages: string[]) =>
    leads.filter((l: any) => stages.includes(normalizeStage(l.status))).length;
  const totalLeads = stats?.total ?? leads.length;
  const newCount = countOf(["new"]);
  const wonCount = countOf(["won"]);
  const conversion = totalLeads ? Math.round((wonCount / totalLeads) * 100) : 0;

  const kpis = [
    { label: "Total Leads", value: totalLeads, icon: Users, color: "text-[#1e3a5f]" },
    { label: "New", value: newCount, icon: Star, color: "text-blue-600" },
    { label: "Won", value: wonCount, icon: Trophy, color: "text-green-600" },
    { label: "Conversion", value: `${conversion}%`, icon: TrendingUp, color: "text-[#ff6b35]" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-3">
          <LayoutDashboard className="h-7 w-7 text-[#ff6b35]" />
          <h1 className="text-3xl font-bold text-[#1e3a5f]">Dashboard</h1>
        </div>
        <p className="text-muted-foreground">
          Business overview and quick access to every department.
        </p>
      </div>

      {/* Business overview — key lead metrics */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
          >
            <div>
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </div>
            <k.icon className={`h-7 w-7 opacity-20 ${k.color}`} />
          </div>
        ))}
      </div>

      {/* Department cards */}
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Phone className="h-4 w-4" /> Departments
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => (
          <DepartmentCard key={dept.id} dept={dept} />
        ))}
      </div>
    </div>
  );
}

function DepartmentCard({ dept }: { dept: NavDepartment }) {
  const color = DEPT_COLORS[dept.id] ?? "#1e3a5f";
  const DeptIcon = iconFor(dept.icon);

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Card header/title — clickable, opens the department's primary page.
          It is a SIBLING of the item links (not a wrapper), so clicking an item
          can never also trigger this navigation. */}
      <Link
        href={dept.primaryPath}
        className="group flex items-center gap-3 rounded-t-xl border-b border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b35]"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}15`, color }}
        >
          <DeptIcon className="h-5 w-5" />
        </span>
        <h3 className="flex-1 text-left text-base font-bold text-[#1e3a5f]">{dept.label}</h3>
        <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 transition-colors group-hover:text-[#ff6b35]" />
      </Link>

      {/* Individually clickable items — each navigates to its own real route. */}
      <ul className="flex flex-col p-2">
        {dept.items.map((item) => {
          const ItemIcon = iconFor(item.icon);
          return (
            <li key={item.label}>
              <Link
                href={item.path}
                className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-normal text-muted-foreground transition-colors hover:bg-gray-50 hover:text-[#ff6b35] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b35]"
              >
                <ItemIcon className="h-4 w-4 shrink-0 opacity-70" />
                <span className="flex-1 truncate">{item.label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-[#ff6b35]" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

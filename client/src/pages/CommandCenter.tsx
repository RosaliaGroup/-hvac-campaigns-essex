import { useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { iconFor } from "@/components/navIcons";
import {
  getVisibleDepartments,
  resolveNavRole,
  type NavDepartment,
  type NavItem,
} from "@/lib/navigation";
import { LayoutDashboard, ChevronRight } from "lucide-react";

/** Accent colour per department card. */
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
 * Command Center — the internal dashboard home. Shows one card per department
 * (instead of every individual tool). Clicking a card opens that department's
 * primary tool; individual tools are listed inside the card as quick links.
 *
 * The public website header, footer and Jessica chatbot are intentionally NOT
 * rendered here — this page is mounted inside <DashboardLayout> (via
 * ProtectedRoute), which provides the only internal navigation chrome.
 */
export default function CommandCenter() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const role = useMemo(() => resolveNavRole(user), [user]);
  // Department cards exclude "home" (this page itself).
  const departments = useMemo(
    () => getVisibleDepartments(role).filter((d) => d.id !== "home"),
    [role]
  );

  const firstEnabled = (dept: NavDepartment): NavItem | undefined =>
    dept.items.find((i) => !i.disabled && i.path);

  const openDepartment = (dept: NavDepartment) => {
    const target = firstEnabled(dept);
    if (target) setLocation(target.path);
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <LayoutDashboard className="h-7 w-7 text-[#ff6b35]" />
          <h1 className="text-3xl font-bold text-[#1e3a5f]">Command Center</h1>
        </div>
        <p className="text-muted-foreground">
          Jump into any department. Each card opens that team's tools.
        </p>
      </div>

      {/* Department cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => {
          const color = DEPT_COLORS[dept.id] ?? "#1e3a5f";
          const DeptIcon = iconFor(dept.icon);
          const target = firstEnabled(dept);
          return (
            <div
              key={dept.id}
              role="button"
              tabIndex={0}
              onClick={() => openDepartment(dept)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openDepartment(dept);
                }
              }}
              className={`group flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b35] ${
                target ? "cursor-pointer hover:border-[#ff6b35]" : "cursor-default"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${color}15`, color }}
                >
                  <DeptIcon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-5 w-5 text-gray-300 transition-colors group-hover:text-[#ff6b35]" />
              </div>

              <h2 className="mb-1 text-lg font-bold text-[#1e3a5f]">{dept.label}</h2>

              <ul className="mt-2 space-y-1.5">
                {dept.items.map((item) => (
                  <li key={item.label}>
                    <button
                      type="button"
                      disabled={item.disabled || !item.path}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!item.disabled && item.path) setLocation(item.path);
                      }}
                      className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm transition-colors ${
                        item.disabled || !item.path
                          ? "cursor-default text-muted-foreground/60"
                          : "text-muted-foreground hover:text-[#ff6b35]"
                      }`}
                    >
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.disabled && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                          Soon
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

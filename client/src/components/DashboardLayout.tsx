import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import {
  DEPARTMENTS,
  NAV_COLLAPSE_STORAGE_KEY,
  getActiveDepartmentId,
  getActiveItemPath,
  getVisibleDepartments,
  isDepartmentOpen,
  loadDepartmentOpenState,
  resolveNavRole,
  serializeDepartmentOpenState,
  type DepartmentOpenState,
  type NavDepartment,
  type NavItem,
} from "@/lib/navigation";
import { ChevronRight, LayoutDashboard, LogOut } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { iconFor } from "./navIcons";
import { Button } from "./ui/button";

/**
 * Signals that dashboard chrome (sidebar + header) is already mounted higher in
 * the tree. Pages that historically wrapped themselves in <DashboardLayout>
 * become passthroughs instead of double-rendering the sidebar, so the layout
 * can be applied centrally (via ProtectedRoute) without touching every page.
 */
const DashboardChromeContext = createContext(false);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const alreadyInsideChrome = useContext(DashboardChromeContext);
  const { loading, user } = useAuth();

  // Nested usage (page still self-wraps) — render content only, no 2nd sidebar.
  if (alreadyInsideChrome) {
    return <>{children}</>;
  }

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DashboardChromeContext.Provider value={true}>
      <SidebarProvider>
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
      </SidebarProvider>
    </DashboardChromeContext.Provider>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  const role = useMemo(() => resolveNavRole(user), [user]);
  const departments = useMemo(() => getVisibleDepartments(role), [role]);
  const activeDeptId = getActiveDepartmentId(location);
  const activeItemPath = getActiveItemPath(location);
  const activeLabel =
    DEPARTMENTS.flatMap((d) => d.items).find((i) => i.path === activeItemPath)?.label ??
    "Dashboard";

  // Persisted per-department open/closed state.
  const [openState, setOpenState] = useState<DepartmentOpenState>(() =>
    typeof window === "undefined"
      ? {}
      : loadDepartmentOpenState(localStorage.getItem(NAV_COLLAPSE_STORAGE_KEY))
  );

  useEffect(() => {
    localStorage.setItem(NAV_COLLAPSE_STORAGE_KEY, serializeDepartmentOpenState(openState));
  }, [openState]);

  // Always expand the department that owns the current page on navigation.
  useEffect(() => {
    if (!activeDeptId) return;
    setOpenState((prev) =>
      prev[activeDeptId] === true ? prev : { ...prev, [activeDeptId]: true }
    );
  }, [activeDeptId]);

  const toggleDept = (deptId: string, open: boolean) =>
    setOpenState((prev) => ({ ...prev, [deptId]: open }));

  const navigate = (item: NavItem) => {
    if (item.disabled || !item.path) return;
    setLocation(item.path);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <>
      <Sidebar collapsible="offcanvas" className="border-r">
        <SidebarHeader className="h-16 justify-center border-b">
          <Link
            href="/command-center"
            className="flex items-center gap-2 px-2 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          >
            <LayoutDashboard className="h-5 w-5 text-[#ff6b35] shrink-0" />
            <span className="font-semibold tracking-tight truncate text-[#1e3a5f]">
              ME Dashboard
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent className="gap-0 py-2">
          {departments.map((dept) => (
            <DepartmentSection
              key={dept.id}
              dept={dept}
              open={isDepartmentOpen(dept.id, activeDeptId, openState)}
              onOpenChange={(open) => toggleDept(dept.id, open)}
              activeItemPath={activeItemPath}
              onNavigate={navigate}
            />
          ))}
        </SidebarContent>

        <SidebarFooter className="p-3 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-9 w-9 border shrink-0">
                  <AvatarFallback className="text-xs font-medium">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate leading-none">
                    {user?.name || "-"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-1.5">
                    {user?.email || "-"}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-x-hidden">
        {/* Header: hamburger on mobile, breadcrumb on all sizes. */}
        <header className="flex border-b h-14 items-center gap-2 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
          <SidebarTrigger className="h-9 w-9 rounded-lg" aria-label="Toggle navigation" />
          <span className="font-medium tracking-tight text-foreground truncate">
            {activeLabel}
          </span>
        </header>
        <main className="flex-1 p-4 min-w-0 overflow-x-hidden">{children}</main>
      </SidebarInset>
    </>
  );
}

/* ── One collapsible department section ─────────────────────────────────── */
function DepartmentSection({
  dept,
  open,
  onOpenChange,
  activeItemPath,
  onNavigate,
}: {
  dept: NavDepartment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeItemPath: string | null;
  onNavigate: (item: NavItem) => void;
}) {
  const DeptIcon = iconFor(dept.icon);
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="px-2">
      <CollapsibleTrigger className="group/dept flex w-full items-center gap-2 rounded-md px-2 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 hover:text-foreground hover:bg-accent/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <DeptIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left">{dept.label}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]/dept:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenu className="py-0.5">
          {dept.items.map((item) => {
            const ItemIcon = iconFor(item.icon);
            const isActive = !!item.path && item.path === activeItemPath;
            return (
              <SidebarMenuItem key={`${dept.id}-${item.label}`}>
                <SidebarMenuButton
                  isActive={isActive}
                  aria-disabled={item.disabled || undefined}
                  onClick={() => onNavigate(item)}
                  tooltip={item.disabled ? `${item.label} (coming soon)` : item.label}
                  className={`h-9 font-normal ${
                    item.disabled
                      ? "opacity-50 cursor-default hover:bg-transparent"
                      : ""
                  }`}
                >
                  <ItemIcon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                  <span className="flex-1">{item.label}</span>
                  {item.disabled && (
                    <span className="text-[9px] font-medium uppercase tracking-wide rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                      Soon
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  );
}

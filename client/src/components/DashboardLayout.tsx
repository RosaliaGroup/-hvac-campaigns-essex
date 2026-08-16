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
  DropdownMenuSeparator,
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
  getActiveDepartmentId,
  getActiveItemKey,
  getVisibleDepartments,
  initialDepartmentOpenState,
  isDepartmentOpen,
  resolveNavRole,
  type DepartmentOpenState,
  type NavDepartment,
  type NavItem,
} from "@/lib/navigation";
import { Bell, ChevronRight, Inbox, LayoutDashboard, LogOut, Menu, Target, UserRound } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
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

/**
 * Alert bell. Polls rather than holding a socket open — a CRM this size doesn't justify
 * the infrastructure, and a minute of latency on "someone commented" is not material.
 */
function NotificationBell() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const { data: unread = 0 } = trpc.notifications.unreadCount.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: items = [] } = trpc.notifications.list.useQuery({ limit: 20 }, { enabled: open });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => { utils.notifications.invalidate(); },
  });
  const markAll = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => { utils.notifications.invalidate(); },
  });

  const openItem = (n: { id: number; link: string | null; readAt: Date | string | null }) => {
    if (!n.readAt) markRead.mutate({ id: n.id });
    setOpen(false);
    if (n.link) setLocation(n.link);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-lg p-2 hover:bg-accent/50" aria-label={`Alerts${unread ? ` (${unread} unread)` : ""}`}>
          <Bell className="h-5 w-5" />
          {unread > 0 ? (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff6b35] px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-semibold">Alerts</span>
          {unread > 0 ? (
            <button className="text-xs text-muted-foreground hover:underline" onClick={() => markAll.mutate()}>
              Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {items.map(n => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={`flex w-full flex-col items-start gap-0.5 px-2 py-2 text-left hover:bg-accent/50 ${n.readAt ? "opacity-60" : ""}`}
              >
                <span className="text-sm font-medium">{n.title}</span>
                {n.body ? <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span> : null}
                <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Destinations worth a thumb on a phone. Everything else lives behind More. */
const MOBILE_TABS = [
  { label: "Home", path: "/command-center", Icon: LayoutDashboard },
  { label: "Leads", path: "/lead-dashboard", Icon: Inbox },
  { label: "Bids", path: "/opportunities", Icon: Target },
  { label: "Contacts", path: "/customers", Icon: UserRound },
] as const;

function MobileTabBar({
  activeItemKey, onNavigate, onMore,
}: { activeItemKey: string | null; onNavigate: (path: string) => void; onMore: () => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      {MOBILE_TABS.map(({ label, path, Icon }) => {
        const active = activeItemKey === path;
        return (
          <button
            key={path}
            onClick={() => onNavigate(path)}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              active ? "text-[#ff6b35]" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        );
      })}
      <button
        onClick={onMore}
        className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground"
      >
        <Menu className="h-5 w-5" />
        More
      </button>
    </nav>
  );
}

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
  const activeItemKey = useMemo(
    () => getActiveItemKey(departments, location),
    [departments, location]
  );
  // Breadcrumb label derived from the canonical active item key (`deptId::label`).
  const activeLabel = activeItemKey
    ? activeItemKey.slice(activeItemKey.indexOf("::") + 2)
    : "Dashboard";

  // Accordion open-state: only the active department is expanded by default.
  // Recomputed whenever the active department changes (navigation), so the
  // sidebar never accumulates a long list of open sections. Not persisted.
  const [openState, setOpenState] = useState<DepartmentOpenState>(() =>
    initialDepartmentOpenState(activeDeptId)
  );

  useEffect(() => {
    setOpenState(initialDepartmentOpenState(activeDeptId));
  }, [activeDeptId]);

  const setDeptOpen = (deptId: string, open: boolean) =>
    setOpenState((prev) => ({ ...prev, [deptId]: open }));

  const navigate = (item: NavItem) => {
    if (!item.path) return;
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

        <SidebarContent className="gap-0 py-1.5">
          {departments.map((dept) => (
            <DepartmentSection
              key={dept.id}
              dept={dept}
              open={isDepartmentOpen(dept.id, openState)}
              onOpenChange={(open) => setDeptOpen(dept.id, open)}
              activeItemKey={activeItemKey}
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
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>
        {/* pb-24 on mobile keeps content clear of the fixed tab bar and the iOS home bar. */}
        <main className="flex-1 min-w-0 overflow-x-hidden p-4 pb-24 md:pb-4">{children}</main>
        <MobileTabBar activeItemKey={activeItemKey} onNavigate={p => setLocation(p)} onMore={() => setOpenMobile(true)} />
      </SidebarInset>
    </>
  );
}

/* ── One collapsible department section ─────────────────────────────────── */
function DepartmentSection({
  dept,
  open,
  onOpenChange,
  activeItemKey,
  onNavigate,
}: {
  dept: NavDepartment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeItemKey: string | null;
  onNavigate: (item: NavItem) => void;
}) {
  const DeptIcon = iconFor(dept.icon);
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="px-2">
      {/* Whole row is the trigger — clicking anywhere on it expands/collapses. */}
      <CollapsibleTrigger className="group/dept flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/70 hover:text-foreground hover:bg-accent/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <DeptIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{dept.label}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/dept:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Child links: normal weight, indented under the heading for hierarchy. */}
        <SidebarMenu className="mb-0.5 ml-3.5 gap-0 border-l border-border/60 pl-1.5">
          {dept.items.map((item) => {
            const ItemIcon = iconFor(item.icon);
            const isActive = `${dept.id}::${item.label}` === activeItemKey;
            return (
              <SidebarMenuItem key={`${dept.id}-${item.label}`}>
                <SidebarMenuButton
                  isActive={isActive}
                  onClick={() => onNavigate(item)}
                  tooltip={item.label}
                  className="h-8 font-normal text-[13px]"
                >
                  <ItemIcon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                  <span className="flex-1">{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  );
}

import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Menu, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { PORTAL_NAV } from "../lib/nav";
import type { PortalMe } from "../hooks/usePortalAuth";

/**
 * Customer Portal shell: responsive sidebar (persistent on desktop, slide-over
 * on mobile) + top bar. Deliberately separate from the team `DashboardLayout`
 * so the customer surface never inherits internal navigation or team auth.
 */
export function PortalLayout({ me, children }: { me: PortalMe; children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const logout = trpc.portal.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.portal.auth.me.reset();
      window.location.href = "/portal/login";
    },
    onError: () => toast({ variant: "destructive", title: "Couldn't sign out", description: "Please try again." }),
  });

  const isActive = (path: string) =>
    path === "/portal" ? location === "/portal" || location === "/portal/" : location.startsWith(path);

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav aria-label="Portal sections" className="flex flex-col gap-1 px-3">
      {PORTAL_NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b35] focus-visible:ring-offset-1",
              active
                ? "bg-[#1e3a5f] text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const Brand = () => (
    <div className="flex items-center gap-2 px-6 py-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#ff6b35] text-sm font-bold text-white">
        ME
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Customer Portal</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Mechanical Enterprise</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto pb-4">
          <NavList />
        </div>
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <SignedInAs me={me} />
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start text-slate-600 dark:text-slate-300"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile slide-over */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Portal navigation"
            className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <Brand />
              <Button variant="ghost" size="icon" className="mr-2" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto pb-4">
              <NavList onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="border-t border-slate-200 p-3 dark:border-slate-800">
              <SignedInAs me={me} />
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-start"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> Sign out
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main column */}
      <div className="lg:pl-64">
        {/* Top bar (mobile trigger + brand) */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">Customer Portal</span>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function SignedInAs({ me }: { me: PortalMe }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{me.name}</p>
      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{me.email}</p>
    </div>
  );
}

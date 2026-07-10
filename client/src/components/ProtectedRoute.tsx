import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";

interface ProtectedRouteProps {
  component: React.ComponentType;
}

/**
 * Wraps a page component and redirects unauthenticated visitors to the team
 * login page. Also mounts the single internal dashboard chrome (left sidebar +
 * mobile drawer) around every protected page, so the public website header,
 * footer and Jessica chatbot never appear inside the CRM. Pages that still
 * self-wrap in <DashboardLayout> are detected and passed through (no double
 * sidebar) — see DashboardChromeContext in DashboardLayout.
 *
 * Usage in App.tsx:
 *   <Route path="/marketing-autopilot" component={() => <ProtectedRoute component={MarketingAutopilot} />} />
 */
export default function ProtectedRoute({ component: Component }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff6b35]" />
          <p className="text-sm">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to team login, preserving the current path as a return destination
    const returnPath = encodeURIComponent(location);
    window.location.href = `/team-login?return=${returnPath}`;
    return null;
  }

  return (
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  );
}

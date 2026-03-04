import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  component: React.ComponentType;
}

/**
 * Wraps a page component and redirects unauthenticated visitors to the Manus login page.
 * Usage in App.tsx:
 *   <Route path="/marketing-autopilot" component={() => <ProtectedRoute component={MarketingAutopilot} />} />
 */
export default function ProtectedRoute({ component: Component }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();

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
    // Redirect to Manus OAuth login, return to current page after auth
    window.location.href = getLoginUrl();
    return null;
  }

  return <Component />;
}

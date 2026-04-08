import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";

/**
 * Slim single-line footer for internal dashboard pages.
 * Replaces the full public Footer to save vertical space.
 */
export default function DashboardFooter() {
  const { isAuthenticated } = useAuth();

  return (
    <footer className="border-t border-gray-200 bg-white py-2 px-4 flex items-center justify-between text-xs text-muted-foreground flex-shrink-0">
      <span>© 2026 Mechanical Enterprise LLC · Newark, NJ · (862) 423-9396</span>
      <div className="flex items-center gap-4">
        <Link href="/" className="hover:text-[#ff6b35] transition-colors">Public Site</Link>
        <Link href="/contact" className="hover:text-[#ff6b35] transition-colors">Contact</Link>
        {isAuthenticated && (
          <Link href="/admin" className="hover:text-[#ff6b35] transition-colors flex items-center gap-1">
            Admin Portal
          </Link>
        )}
      </div>
    </footer>
  );
}

/**
 * Maps the string icon keys used in the framework-free navigation model
 * (`@/lib/navigation`) to lucide-react components. Kept separate from the nav
 * data so that module stays serializable and node-testable.
 */
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  Calculator,
  Facebook,
  FileText,
  Home,
  Inbox,
  LayoutDashboard,
  MapPin,
  Megaphone,
  MessageSquare,
  Plug,
  Receipt,
  RefreshCw,
  Ruler,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
  UserRound,
  Users,
  Zap,
} from "lucide-react";

export const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  AlertTriangle, BarChart3, Bot, Briefcase, CalendarCheck, CalendarClock,
  Calculator, Facebook, FileText, Home, Inbox, LayoutDashboard, MapPin,
  Megaphone, MessageSquare, Plug, Receipt, RefreshCw, Ruler, Search, Settings,
  ShieldCheck, Star, Target, TrendingUp, UserRound, Users, Zap,
};

export function iconFor(name: string): React.ComponentType<{ className?: string }> {
  return NAV_ICONS[name] ?? LayoutDashboard;
}

import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  Users,
  Star,
  Bot,
  BarChart3,
  ChevronRight,
  Search,
  Facebook,
} from "lucide-react";

const navItems = [
  { label: "Command Center", href: "/command-center", icon: LayoutDashboard },
  { label: "SMS Campaigns", href: "/sms-campaigns", icon: MessageSquare },
  { label: "Marketing", href: "/marketing-dashboard", icon: Megaphone },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Lead Scoring", href: "/lead-scoring", icon: Star },
  { label: "AI VA", href: "/ai-va-dashboard", icon: Bot },
  { label: "Performance", href: "/campaign-performance", icon: BarChart3 },
  { label: "Google Ads", href: "/google-ads-campaigns", icon: Search },
  { label: "Facebook Ads", href: "/facebook-campaigns", icon: Facebook },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

export default function InternalNav() {
  const [location] = useLocation();

  return (
    <div className="bg-[#1e3a5f]/95 backdrop-blur border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1.5">
          {navItems.map((item, idx) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-[#ff6b35] text-white"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                {item.label}
                {idx < navItems.length - 1 && !isActive && (
                  <ChevronRight className="h-3 w-3 text-white/30 ml-0.5 hidden sm:block" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

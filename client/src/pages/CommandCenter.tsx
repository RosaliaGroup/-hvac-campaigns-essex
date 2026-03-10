import { useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import InternalNav from "@/components/InternalNav";
import Navigation from "@/components/Navigation";
import DashboardFooter from "@/components/DashboardFooter";
import {
  BarChart3,
  Facebook,
  Instagram,
  Globe,
  TrendingUp,
  MessageSquare,
  Settings,
  Users,
  Zap,
  Bot,
  FileText,
  Star,
  Mail,
  Phone,
  Target,
  ShieldCheck,
  Megaphone,
  LayoutDashboard,
  ChevronRight,
  Handshake,
  Wrench,
  Building2,
} from "lucide-react";

type Tool = {
  label: string;
  href: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
};

type Category = {
  title: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  tools: Tool[];
};

const categories: Category[] = [
  {
    title: "Campaigns & Ads",
    color: "#ff6b35",
    icon: Megaphone,
    tools: [
      { label: "Marketing Dashboard", href: "/marketing-dashboard", description: "Campaign library, social posts, budget calculator", icon: LayoutDashboard, badge: "Hub", badgeColor: "bg-[#ff6b35] text-white" },
      { label: "Google Ads Campaigns", href: "/google-ads-campaigns", description: "Create & manage Google Search and Display campaigns", icon: BarChart3 },
      { label: "Facebook Campaigns", href: "/facebook-campaigns", description: "Facebook & Instagram ad campaigns", icon: Facebook },
      { label: "Email & SMS Campaigns", href: "/email-sms-campaigns", description: "Drip sequences and broadcast messages", icon: Mail },
      { label: "SMS Campaign Manager", href: "/sms-campaigns", description: "TextBelt contact list, 3-message drip, send history", icon: MessageSquare, badge: "Live", badgeColor: "bg-green-100 text-green-800" },
      { label: "Campaign Generator", href: "/campaign-generator", description: "AI-powered ad copy and campaign builder", icon: Zap, badge: "AI", badgeColor: "bg-purple-100 text-purple-800" },
      { label: "Marketing Autopilot", href: "/marketing-autopilot", description: "Automated campaign recommendations and scheduling", icon: TrendingUp },
    ],
  },
  {
    title: "Lead Management",
    color: "#1e3a5f",
    icon: Users,
    tools: [
      { label: "Lead Dashboard", href: "/lead-dashboard", description: "All leads with status, source, and follow-up tracking", icon: LayoutDashboard, badge: "Hub", badgeColor: "bg-[#1e3a5f] text-white" },
      { label: "Lead Tracker", href: "/leads", description: "Log and manage individual leads manually", icon: Target },
      { label: "Lead Scoring", href: "/lead-scoring", description: "Hot / Warm / Cold scoring with priority queue", icon: Star },
      { label: "Campaign Performance", href: "/campaign-performance", description: "ROI, cost-per-lead, and conversion analytics", icon: TrendingUp },
    ],
  },
  {
    title: "AI Virtual Assistant",
    color: "#7c3aed",
    icon: Bot,
    tools: [
      { label: "AI VA Dashboard", href: "/ai-va-dashboard", description: "Call logs, SMS conversations, social interactions", icon: Bot, badge: "Live", badgeColor: "bg-green-100 text-green-800" },
      { label: "AI VA Settings", href: "/ai-va-settings", description: "Configure Vapi, Twilio, Facebook, Google credentials", icon: Settings },
      { label: "AI Assistant Prompts", href: "/ai-assistant-prompts", description: "Master prompt library for all lead scenarios", icon: MessageSquare },
      { label: "AI Script Manager", href: "/ai-script-manager", description: "Create and manage custom conversation scripts", icon: FileText },
    ],
  },
  {
    title: "Landing Pages",
    color: "#059669",
    icon: Globe,
    tools: [
      { label: "Heat Pump Rebates LP", href: "/lp/heat-pump-rebates", description: "Up to $16,000 in rebates — residential", icon: Zap, badge: "Live", badgeColor: "bg-green-100 text-green-800" },
      { label: "Commercial VRV/VRF LP", href: "/lp/commercial-vrv", description: "VRV/VRF systems for commercial properties", icon: Building2, badge: "Live", badgeColor: "bg-green-100 text-green-800" },
      { label: "Emergency HVAC LP", href: "/lp/emergency-hvac", description: "24/7 emergency service — fast response", icon: Phone, badge: "Live", badgeColor: "bg-green-100 text-green-800" },
      { label: "Facebook Residential LP", href: "/lp/fb-residential", description: "Facebook ad landing page — residential", icon: Facebook, badge: "Live", badgeColor: "bg-green-100 text-green-800" },
      { label: "Facebook Commercial LP", href: "/lp/fb-commercial", description: "Facebook ad landing page — commercial", icon: Building2, badge: "Live", badgeColor: "bg-green-100 text-green-800" },
      { label: "Rebate Guide LP", href: "/lp/rebate-guide", description: "PSE&G rebate guide with lead capture", icon: FileText, badge: "Live", badgeColor: "bg-green-100 text-green-800" },
      { label: "Maintenance Subscription LP", href: "/lp/maintenance-offer", description: "3-tier plan selector — first month FREE", icon: Wrench, badge: "New", badgeColor: "bg-blue-100 text-blue-800" },
      { label: "Referral Partner LP", href: "/lp/referral-partner", description: "Earn income by referring HVAC customers", icon: Handshake, badge: "New", badgeColor: "bg-blue-100 text-blue-800" },
    ],
  },
  {
    title: "Public Pages",
    color: "#64748b",
    icon: Globe,
    tools: [
      { label: "Home", href: "/", description: "Main website homepage", icon: Globe },
      { label: "Services", href: "/services", description: "Full services overview", icon: Wrench },
      { label: "Residential", href: "/residential", description: "Residential HVAC campaigns", icon: Globe },
      { label: "Commercial", href: "/commercial", description: "Commercial HVAC campaigns", icon: Building2 },
      { label: "Maintenance Plans", href: "/maintenance", description: "Subscription plan overview page", icon: Wrench },
      { label: "Partnerships", href: "/partnerships", description: "Referral & partner program info", icon: Handshake },
      { label: "Rebate Guide", href: "/rebate-guide", description: "PSE&G rebate information", icon: FileText },
      { label: "Testimonials", href: "/testimonials", description: "Customer reviews and ratings", icon: Star },
      { label: "About", href: "/about", description: "Company background and certifications", icon: ShieldCheck },
      { label: "Contact", href: "/contact", description: "Contact form and office info", icon: Phone },
    ],
  },
  {
    title: "Admin & Settings",
    color: "#dc2626",
    icon: ShieldCheck,
    tools: [
      { label: "Admin Portal", href: "/admin", description: "Full admin access — all tools in one view", icon: ShieldCheck, badge: "Admin", badgeColor: "bg-red-100 text-red-800" },
      { label: "Team Access", href: "/team-management", description: "Invite team members, manage roles, suspend or remove access", icon: Users, badge: "New", badgeColor: "bg-blue-100 text-blue-800" },
    ],
  },
];

export default function CommandCenter() {
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35]" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <InternalNav />
      <Navigation />

      <div className="flex-1 overflow-y-auto">
        <div className="container py-6">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <LayoutDashboard className="h-8 w-8 text-[#ff6b35]" />
            <h1 className="text-4xl font-bold text-[#1e3a5f]">Command Center</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Every tool, dashboard, and landing page — all in one place.
          </p>
        </div>

        {/* Categories */}
        <div className="space-y-10">
          {categories.map((cat) => (
            <section key={cat.title}>
              {/* Category Header */}
              <div className="flex items-center gap-2 mb-4">
                <cat.icon className="h-5 w-5 text-[#ff6b35]" />
                <h2 className="text-xl font-bold text-[#1e3a5f]">{cat.title}</h2>
                <div className="flex-1 h-px bg-gray-200 ml-2" />
              </div>

              {/* Tool Cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {cat.tools.map((tool) => (
                  <Link key={tool.href} href={tool.href}>
                    <div className="group bg-white rounded-xl border border-gray-200 p-4 hover:border-[#ff6b35] hover:shadow-md transition-all cursor-pointer h-full flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${cat.color}15` }}
                          >
                            <tool.icon className="h-5 w-5" />
                          </div>
                          {tool.badge && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tool.badgeColor}`}>
                              {tool.badge}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-[#1e3a5f] text-sm mb-1 group-hover:text-[#ff6b35] transition-colors">
                          {tool.label}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {tool.description}
                        </p>
                      </div>
                      <div className="flex items-center justify-end mt-3">
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#ff6b35] transition-colors" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
        </div>
      </div>

      <DashboardFooter />
    </div>
  );
}

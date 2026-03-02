import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Bot, 
  Target, 
  FileText, 
  Settings, 
  Users, 
  BarChart3,
  MessageSquare,
  Calendar,
  TrendingUp,
  Shield,
  LogOut,
  Search,
  Mail,
  Zap
} from "lucide-react";
import { getLoginUrl } from "@/const";

export default function AdminPortal() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin portal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-[#ff6b35] mx-auto mb-4" />
            <CardTitle className="text-2xl">Admin Access Required</CardTitle>
            <CardDescription>
              Please log in to access the admin portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
              onClick={() => window.location.href = getLoginUrl()}
            >
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const toolCategories = [
    {
      title: "Marketing & Campaigns",
      description: "Manage marketing campaigns and track performance",
      icon: TrendingUp,
      color: "bg-blue-500",
      tools: [
        {
          name: "Marketing Dashboard",
          description: "Campaign management and analytics",
          icon: LayoutDashboard,
          path: "/marketing-dashboard",
          badge: "Primary"
        },
        {
          name: "Campaign Performance",
          description: "Track ROI and conversion rates",
          icon: BarChart3,
          path: "/campaign-performance"
        },
        {
          name: "Lead Tracker",
          description: "View and manage all captured leads",
          icon: Users,
          path: "/leads"
        }
      ]
    },
    {
      title: "Lead Generation Campaigns",
      description: "Ready-to-launch multi-channel campaigns to get more business",
      icon: Zap,
      color: "bg-orange-500",
      tools: [
        {
          name: "Campaign Generator",
          description: "Multi-channel campaign hub with launch checklists and ROI calculator",
          icon: TrendingUp,
          path: "/campaign-generator",
          badge: "New"
        },
        {
          name: "Google Ads Campaigns",
          description: "Ready-to-launch search ad copy, keywords, and targeting for NJ",
          icon: Search,
          path: "/google-ads-campaigns"
        },
        {
          name: "Facebook & Instagram Ads",
          description: "Social media ad copy, audiences, and creative briefs",
          icon: Users,
          path: "/facebook-campaigns"
        },
        {
          name: "Email & SMS Sequences",
          description: "Automated nurture sequences for residential and commercial leads",
          icon: Mail,
          path: "/email-sms-campaigns"
        }
      ]
    },    {
      title: "AI Virtual Assistant",
      description: "Manage AI-powered lead generation and automation",
      icon: Bot,
      color: "bg-purple-500",
      tools: [
        {
          name: "AI VA Dashboard",
          description: "Monitor calls, SMS, and social media automation",
          icon: Bot,
          path: "/ai-va-dashboard",
          badge: "AI Powered"
        },
        {
          name: "AI VA Settings",
          description: "Configure Vapi, Twilio, and social media credentials",
          icon: Settings,
          path: "/ai-va-settings"
        },
        {
          name: "AI Script Manager",
          description: "Create and edit AI assistant conversation scripts",
          icon: FileText,
          path: "/ai-script-manager"
        },
        {
          name: "AI Assistant Prompts",
          description: "Pre-built HVAC-specific prompt library",
          icon: MessageSquare,
          path: "/ai-assistant-prompts"
        }
      ]
    },
    {
      title: "Lead Management",
      description: "Prioritize and track lead engagement",
      icon: Target,
      color: "bg-green-500",
      tools: [
        {
          name: "Lead Management Dashboard",
          description: "Real-time tracking of all leads from every channel",
          icon: Users,
          path: "/lead-dashboard",
          badge: "New"
        },
        {
          name: "Lead Scoring Dashboard",
          description: "View Hot/Warm/Cold leads with intelligent scoring",
          icon: Target,
          path: "/lead-scoring",
          badge: "Smart"
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Admin Portal</h1>
              <p className="text-muted-foreground mt-1">
                Welcome back, {user?.name || "Admin"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="outline">
                  Back to Website
                </Button>
              </Link>
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-8">
        <div className="space-y-8">
          {toolCategories.map((category, idx) => (
            <div key={idx}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`${category.color} p-2 rounded-lg`}>
                  <category.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#1e3a5f]">{category.title}</h2>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.tools.map((tool, toolIdx) => (
                  <Link key={toolIdx} href={tool.path}>
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full group">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-[#ff6b35]/10 transition-colors">
                              <tool.icon className="h-5 w-5 text-[#1e3a5f] group-hover:text-[#ff6b35] transition-colors" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{tool.name}</CardTitle>
                              {tool.badge && (
                                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold bg-[#ff6b35]/10 text-[#ff6b35] rounded-full">
                                  {tool.badge}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <CardDescription className="mt-2">
                          {tool.description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <Card className="mt-8 bg-gradient-to-r from-[#1e3a5f] to-[#2a5a8f] text-white">
          <CardHeader>
            <CardTitle className="text-white">Quick Access Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>• <strong>Marketing Dashboard:</strong> Start here to launch new campaigns and track performance</p>
            <p>• <strong>AI VA Dashboard:</strong> Monitor your 20+ leads/week goal and view real-time activity</p>
            <p>• <strong>Lead Scoring:</strong> Focus on Hot leads (80+ points) for immediate follow-up</p>
            <p>• <strong>AI Script Manager:</strong> Customize conversation flows for better lead qualification</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

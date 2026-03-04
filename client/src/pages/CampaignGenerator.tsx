import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  ArrowLeft, Search, Users, Mail, MessageSquare, Target, DollarSign,
  TrendingUp, CheckCircle, ExternalLink, Zap, Home, Building2,
  BarChart3, ArrowRight, AlertCircle
} from "lucide-react";
import { getLoginUrl } from "@/const";

interface Channel {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  status: "ready" | "needs-setup" | "active";
  estimatedLeads: string;
  estimatedCost: string;
  roi: string;
  description: string;
  href: string;
  externalUrl?: string;
  setupSteps: string[];
  completedSteps: number;
}

const channels: Channel[] = [
  {
    id: "google-ads",
    name: "Google Search Ads",
    icon: Search,
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
    status: "needs-setup",
    estimatedLeads: "15–30/month",
    estimatedCost: "$800–$1,500/mo",
    roi: "3–5x",
    description: "Capture high-intent buyers actively searching for HVAC services in NJ",
    href: "/google-ads-campaigns",
    externalUrl: "https://ads.google.com",
    setupSteps: [
      "Create Google Ads account",
      "Set up conversion tracking",
      "Create residential campaign",
      "Create commercial campaign",
      "Add negative keywords",
      "Launch and monitor",
    ],
    completedSteps: 0,
  },
  {
    id: "facebook-ads",
    name: "Facebook & Instagram Ads",
    icon: Users,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50 border-indigo-200",
    status: "needs-setup",
    estimatedLeads: "20–40/month",
    estimatedCost: "$1,000–$2,000/mo",
    roi: "2–4x",
    description: "Target NJ homeowners and business owners with rebate awareness campaigns",
    href: "/facebook-campaigns",
    externalUrl: "https://business.facebook.com/adsmanager",
    setupSteps: [
      "Create Meta Business account",
      "Install Facebook Pixel",
      "Create residential audience",
      "Create commercial audience",
      "Launch lead gen campaigns",
      "Set up retargeting",
    ],
    completedSteps: 0,
  },
  {
    id: "email",
    name: "Email Nurture Sequences",
    icon: Mail,
    color: "text-green-600",
    bgColor: "bg-green-50 border-green-200",
    status: "ready",
    estimatedLeads: "5–15/month (from existing leads)",
    estimatedCost: "$0–$50/mo",
    roi: "10–20x",
    description: "Automated email sequences to convert captured leads into booked appointments",
    href: "/email-sms-campaigns",
    setupSteps: [
      "Sign up for Mailchimp or ActiveCampaign",
      "Connect website popup to email platform",
      "Load residential email sequence",
      "Load commercial email sequence",
      "Test sequences with own email",
      "Go live",
    ],
    completedSteps: 2,
  },
  {
    id: "sms",
    name: "SMS Follow-Up Campaigns",
    icon: MessageSquare,
    color: "text-orange-600",
    bgColor: "bg-orange-50 border-orange-200",
    status: "ready",
    estimatedLeads: "3–8/month (from existing leads)",
    estimatedCost: "$20–$50/mo (Twilio)",
    roi: "8–15x",
    description: "Immediate SMS follow-ups and appointment reminders via Twilio integration",
    href: "/email-sms-campaigns",
    setupSteps: [
      "Twilio account configured ✅",
      "AI VA system connected ✅",
      "Load SMS templates",
      "Test with own phone number",
      "Activate automation",
    ],
    completedSteps: 2,
  },
  {
    id: "website-popups",
    name: "Website Exit Popups",
    icon: Target,
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200",
    status: "active",
    estimatedLeads: "5–20/month",
    estimatedCost: "$0",
    roi: "Unlimited",
    description: "Exit intent popups on homepage, residential, and commercial pages capturing leads 24/7",
    href: "/",
    setupSteps: [
      "Homepage exit popup ✅",
      "Residential exit popup ✅",
      "Commercial exit popup ✅",
      "A/B testing active ✅",
      "Lead capture to database ✅",
    ],
    completedSteps: 5,
  },
  {
    id: "ai-va",
    name: "AI Virtual Assistant",
    icon: Zap,
    color: "text-purple-600",
    bgColor: "bg-purple-50 border-purple-200",
    status: "needs-setup",
    estimatedLeads: "10–25/month",
    estimatedCost: "$200–$400/mo (Vapi)",
    roi: "5–10x",
    description: "24/7 AI phone agent qualifying leads and booking appointments automatically",
    href: "/ai-va-dashboard",
    setupSteps: [
      "Vapi account configured ✅",
      "AI assistant created ✅",
      "Connect webhook to production URL",
      "Test inbound call flow",
      "Launch outbound campaign",
    ],
    completedSteps: 2,
  },
];

const budgetPlans = [
  {
    name: "Starter",
    budget: "$1,500/mo",
    channels: ["Website Popups", "Email Sequences", "SMS Follow-ups"],
    expectedLeads: "10–25/month",
    color: "border-green-200 bg-green-50",
    badgeColor: "bg-green-100 text-green-800",
  },
  {
    name: "Growth",
    budget: "$3,500/mo",
    channels: ["Website Popups", "Email + SMS", "Google Ads ($1,500)", "AI VA"],
    expectedLeads: "30–55/month",
    color: "border-blue-200 bg-blue-50",
    badgeColor: "bg-blue-100 text-blue-800",
    recommended: true,
  },
  {
    name: "Scale",
    budget: "$7,000/mo",
    channels: ["All Channels", "Google Ads ($3,000)", "Facebook Ads ($2,000)", "AI VA", "Email + SMS"],
    expectedLeads: "60–100/month",
    color: "border-purple-200 bg-purple-50",
    badgeColor: "bg-purple-100 text-purple-800",
  },
];

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  ready: "bg-blue-100 text-blue-800",
  "needs-setup": "bg-amber-100 text-amber-800",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  ready: "Ready to Launch",
  "needs-setup": "Needs Setup",
};

export default function CampaignGenerator() {
  const { isAuthenticated, loading } = useAuth();
  const [selectedBudget, setSelectedBudget] = useState("Growth");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const activeCount = channels.filter(c => c.status === "active").length;
  const readyCount = channels.filter(c => c.status === "ready").length;
  const needsSetupCount = channels.filter(c => c.status === "needs-setup").length;
  const totalLeadsEstimate = "45–110";

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm flex-shrink-0">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Admin Portal
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-[#1e3a5f] flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-[#ff6b35]" />
                  Campaign Generator
                </h1>
                <p className="text-sm text-muted-foreground">Multi-channel lead generation hub for Mechanical Enterprise</p>
              </div>
            </div>
            <Link href="/marketing-dashboard">
              <Button className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
                <BarChart3 className="h-4 w-4 mr-2" /> View Analytics
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
      <div className="container py-4 space-y-6">
        {/* Status Overview */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Active Channels</p>
              <p className="text-3xl font-bold text-green-600">{activeCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Running 24/7</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Ready to Launch</p>
              <p className="text-3xl font-bold text-blue-600">{readyCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Templates ready</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Needs Setup</p>
              <p className="text-3xl font-bold text-amber-600">{needsSetupCount}</p>
              <p className="text-xs text-muted-foreground mt-1">External accounts needed</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-[#ff6b35]">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Est. Monthly Leads</p>
              <p className="text-3xl font-bold text-[#ff6b35]">{totalLeadsEstimate}</p>
              <p className="text-xs text-muted-foreground mt-1">When all channels active</p>
            </CardContent>
          </Card>
        </div>

        {/* Campaign Channels Grid */}
        <div>
          <h2 className="text-xl font-bold text-[#1e3a5f] mb-4">Lead Generation Channels</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map(channel => (
              <Card key={channel.id} className={`border ${channel.bgColor}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <channel.icon className={`h-6 w-6 ${channel.color}`} />
                      <CardTitle className="text-base">{channel.name}</CardTitle>
                    </div>
                    <Badge className={`text-xs ${statusColors[channel.status]}`}>
                      {statusLabels[channel.status]}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">{channel.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <p className="text-muted-foreground">Leads/mo</p>
                      <p className="font-semibold text-[#1e3a5f]">{channel.estimatedLeads.split("/")[0]}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">Cost/mo</p>
                      <p className="font-semibold text-[#1e3a5f]">{channel.estimatedCost.split("–")[0]}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">ROI</p>
                      <p className="font-semibold text-green-600">{channel.roi}</p>
                    </div>
                  </div>

                  {/* Setup Progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Setup Progress</span>
                      <span className="font-medium">{channel.completedSteps}/{channel.setupSteps.length}</span>
                    </div>
                    <Progress value={(channel.completedSteps / channel.setupSteps.length) * 100} className="h-1.5" />
                  </div>

                  <div className="flex gap-2">
                    <Link href={channel.href} className="flex-1">
                      <Button size="sm" className="w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-xs">
                        View Campaign <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                    {channel.externalUrl && (
                      <Button size="sm" variant="outline" className="text-xs"
                        onClick={() => window.open(channel.externalUrl, "_blank")}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Budget Plans */}
        <div>
          <h2 className="text-xl font-bold text-[#1e3a5f] mb-4">Recommended Budget Plans</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {budgetPlans.map(plan => (
              <Card
                key={plan.name}
                className={`cursor-pointer border-2 transition-all ${selectedBudget === plan.name ? "ring-2 ring-[#ff6b35] shadow-lg" : "hover:shadow-md"} ${plan.color}`}
                onClick={() => setSelectedBudget(plan.name)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.recommended && (
                      <Badge className="bg-[#ff6b35] text-white text-xs">Recommended</Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-[#1e3a5f]">{plan.budget}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">Channels Included:</p>
                    <div className="space-y-1">
                      {plan.channels.map((ch, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                          <span>{ch}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">Expected Monthly Leads</p>
                    <p className="text-xl font-bold text-[#ff6b35]">{plan.expectedLeads}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Launch Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Quick Launch Checklist — Get Leads This Week
            </CardTitle>
            <CardDescription>Complete these steps in order to start generating leads immediately</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3 flex items-center gap-2">
                  <Home className="h-4 w-4" /> Residential Leads
                </h3>
                <div className="space-y-3">
                  {[
                    { done: true, text: "Website exit popups live (homepage + residential page)" },
                    { done: false, text: "Publish website to production domain" },
                    { done: false, text: "Set up Mailchimp — load residential email sequence" },
                    { done: false, text: "Configure Vapi webhook on production URL" },
                    { done: false, text: "Launch Google Ads residential campaign ($30/day)" },
                    { done: false, text: "Launch Facebook residential homeowners campaign ($30/day)" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${item.done ? "bg-green-500 border-green-500" : "border-slate-300"}`}>
                        {item.done && <CheckCircle className="h-3 w-3 text-white" />}
                      </div>
                      <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Commercial Leads
                </h3>
                <div className="space-y-3">
                  {[
                    { done: true, text: "Commercial page exit popup live" },
                    { done: false, text: "Publish website to production domain" },
                    { done: false, text: "Load commercial email sequence in Mailchimp" },
                    { done: false, text: "Launch Google Ads commercial campaign ($40/day)" },
                    { done: false, text: "Launch Facebook commercial business owners campaign ($40/day)" },
                    { done: false, text: "Set up LinkedIn Ads for property managers" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${item.done ? "bg-green-500 border-green-500" : "border-slate-300"}`}>
                        {item.done && <CheckCircle className="h-3 w-3 text-white" />}
                      </div>
                      <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-800">Priority Action: Publish Your Website</p>
                <p className="text-amber-700 mt-1">
                  Your website is built and ready but needs to be published to mechanicalenterprise.com before any paid campaigns can send traffic to it.
                  Click the "Publish" button in the Management UI to deploy. Once live, you can launch all paid channels simultaneously.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dedicated Landing Pages */}
        <div>
          <h2 className="text-xl font-bold text-[#1e3a5f] mb-2">Dedicated Campaign Landing Pages</h2>
          <p className="text-sm text-muted-foreground mb-4">No navigation distractions — each page is optimized for a single conversion goal. Use these URLs in your ad campaigns.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: "Google Ads · Residential", url: "/lp/heat-pump-rebates", desc: "Heat pump rebates up to $16K", color: "border-blue-200 bg-blue-50", badge: "Google Ads" },
              { label: "Google Ads · Commercial", url: "/lp/commercial-vrv", desc: "VRV/VRF systems + 80% incentives", color: "border-blue-200 bg-blue-50", badge: "Google Ads" },
              { label: "Google Ads · Emergency", url: "/lp/emergency-hvac", desc: "24/7 emergency HVAC service", color: "border-blue-200 bg-blue-50", badge: "Google Ads" },
              { label: "Facebook · Residential", url: "/lp/fb-residential", desc: "NJ homeowners — rebate awareness", color: "border-indigo-200 bg-indigo-50", badge: "Facebook" },
              { label: "Facebook · Commercial", url: "/lp/fb-commercial", desc: "Business owners — cost reduction", color: "border-indigo-200 bg-indigo-50", badge: "Facebook" },
              { label: "Email · Rebate Guide", url: "/lp/rebate-guide", desc: "Free 2025 NJ incentive guide download", color: "border-green-200 bg-green-50", badge: "Email" },
              { label: "SMS/Email · Tune-Up", url: "/lp/maintenance-offer", desc: "$89 spring tune-up special", color: "border-orange-200 bg-orange-50", badge: "SMS" },
            ].map((lp) => (
              <div key={lp.url} className={`border rounded-lg p-4 ${lp.color}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <Badge variant="outline" className="text-xs mb-1">{lp.badge}</Badge>
                    <p className="font-semibold text-[#1e3a5f] text-sm">{lp.label}</p>
                    <p className="text-xs text-muted-foreground">{lp.desc}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Link href={lp.url} className="flex-1">
                    <Button size="sm" className="w-full text-xs bg-[#1e3a5f] hover:bg-[#1e3a5f]/90">
                      Preview <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                  <Button size="sm" variant="outline" className="text-xs"
                    onClick={() => { navigator.clipboard.writeText(window.location.origin + lp.url); }}>
                    Copy URL
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ROI Calculator Preview */}
        <Card className="bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[#ff6b35]" />
              Revenue Potential Calculator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6 text-center">
              {[
                { label: "Monthly Leads (Growth Plan)", value: "30–55", sub: "across all channels" },
                { label: "Close Rate", value: "20–30%", sub: "industry average" },
                { label: "Avg. Job Value", value: "$8,000–$15,000", sub: "residential heat pump" },
                { label: "Monthly Revenue Potential", value: "$48K–$247K", sub: "at full capacity" },
              ].map((item, i) => (
                <div key={i} className="bg-white/10 rounded-lg p-4">
                  <p className="text-white/70 text-xs mb-1">{item.label}</p>
                  <p className="text-2xl font-bold text-[#ff6b35]">{item.value}</p>
                  <p className="text-white/60 text-xs mt-1">{item.sub}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}

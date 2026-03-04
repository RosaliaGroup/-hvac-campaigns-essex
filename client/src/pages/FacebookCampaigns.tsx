import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, ExternalLink, Users, DollarSign, Target,
  Home, Building2, TrendingUp, CheckCircle, AlertTriangle, Image, MessageSquare
} from "lucide-react";
import { getLoginUrl } from "@/const";

interface AdVariant {
  name: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  imageDescription: string;
}

interface Audience {
  name: string;
  age: string;
  gender: string;
  locations: string;
  interests: string[];
  behaviors: string[];
  income?: string;
}

interface FBCampaign {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  objective: string;
  budget: string;
  placement: string;
  audiences: Audience[];
  adVariants: AdVariant[];
}

const fbCampaigns: FBCampaign[] = [
  {
    id: "residential-homeowners",
    name: "Residential Homeowners – Rebate Awareness",
    icon: Home,
    color: "bg-green-500",
    objective: "Lead Generation",
    budget: "$30–$50/day",
    placement: "Facebook Feed, Instagram Feed, Instagram Stories",
    audiences: [
      {
        name: "Essex County Homeowners",
        age: "35–65",
        gender: "All",
        locations: "Essex County NJ + 15-mile radius (Newark, Montclair, Livingston, Maplewood, South Orange, Millburn, West Orange, Bloomfield, Nutley, Belleville)",
        interests: ["Home improvement", "HVAC", "Energy efficiency", "Smart home technology", "Home renovation"],
        behaviors: ["Homeowners", "Recently moved", "High household income"],
        income: "Top 25–50% household income",
      },
      {
        name: "NJ Homeowners – Heat Pump Intent",
        age: "30–60",
        gender: "All",
        locations: "Essex, Morris, Union, Bergen, Passaic, Hudson, Somerset Counties NJ",
        interests: ["Heat pumps", "Energy Star appliances", "Green energy", "Home heating", "Air conditioning"],
        behaviors: ["Homeowners", "DIY home improvement", "Engaged shoppers"],
        income: "Top 25% household income",
      },
    ],
    adVariants: [
      {
        name: "Rebate Urgency Ad",
        primaryText: "🏠 NJ Homeowners: Are you leaving $16,000 on the table?\n\nMost homeowners in Essex County don't know they qualify for MASSIVE incentives on heat pump installation:\n\n✅ PSE&G Incentive: Up to $6,000\n✅ NJ Clean Energy: Up to $3,000\n✅ Federal Tax Credit: 30% (up to $2,000)\n✅ Additional utility incentives stacked\n\nTotal: Up to $16,000 back on a new heat pump system!\n\nMechanical Enterprise handles ALL the paperwork. WMBE/SBE certified. 20+ years serving NJ.\n\nGet your FREE in-home estimate today 👇",
        headline: "Up to $16,000 in Heat Pump Incentives",
        description: "Free in-home estimate. We handle all rebate paperwork.",
        cta: "Get Quote",
        imageDescription: "Before/after split image: old furnace on left, modern heat pump on right. Overlay text: 'Save up to $16,000'. Bright, clean residential home setting.",
      },
      {
        name: "Seasonal Urgency Ad",
        primaryText: "⚠️ Essex County homeowners — heating season is here.\n\nIs your HVAC system ready? If it's over 10 years old, you could be paying 40% MORE on energy bills than necessary.\n\nThe good news: New heat pump systems qualify for up to $16,000 in stacked incentives right now.\n\n🔥 PSE&G + NJ Clean Energy + Federal Tax Credit\n💰 0% financing available\n⚡ Same-week installation\n\nMechanical Enterprise — Essex County's trusted HVAC specialists since 2004.\n\nFree in-home assessment 👇",
        headline: "Is Your HVAC System Costing You Money?",
        description: "Get a free assessment. Incentives up to $16K available.",
        cta: "Book Free Visit",
        imageDescription: "Cozy home interior in winter with a modern heat pump unit visible. Text overlay: 'Save up to $16K this winter'. Warm, inviting lighting.",
      },
      {
        name: "Social Proof Ad",
        primaryText: "\"Mechanical Enterprise saved us over $12,000 on our new heat pump system. They handled every piece of paperwork and the installation was done in one day.\" — Sarah M., Montclair NJ\n\n4,000+ residential installations across New Jersey.\n\nWe specialize in stacking ALL available incentives:\n✅ Utility company incentives\n✅ NJ Clean Energy Program\n✅ Federal tax credits\n✅ Manufacturer incentives\n\nWMBE/SBE Certified | Licensed & Insured | 20+ Years Experience\n\nGet your free quote today 👇",
        headline: "4,000+ Happy NJ Homeowners",
        description: "WMBE certified. Free estimate. Incentives up to $16K.",
        cta: "Get Free Quote",
        imageDescription: "Happy family in front of their home with a technician. Professional, trustworthy. Text: '4,000+ Installations'. Clean suburban NJ neighborhood.",
      },
    ],
  },
  {
    id: "commercial-businesses",
    name: "Commercial Businesses & Property Managers",
    icon: Building2,
    color: "bg-blue-500",
    objective: "Lead Generation",
    budget: "$40–$70/day",
    placement: "Facebook Feed, LinkedIn (via Meta), Instagram Business Feed",
    audiences: [
      {
        name: "NJ Business Owners & Property Managers",
        age: "35–65",
        gender: "All",
        locations: "All 15 NJ Counties + NYC Metro area",
        interests: ["Commercial real estate", "Property management", "Business operations", "Energy efficiency", "Building management"],
        behaviors: ["Business owners", "Small business owners", "Property managers"],
        income: "Top 10% household income",
      },
      {
        name: "Hotel & Restaurant Owners NJ",
        age: "35–60",
        gender: "All",
        locations: "Essex, Hudson, Bergen, Union, Middlesex Counties NJ",
        interests: ["Hospitality industry", "Restaurant management", "Hotel management", "Commercial HVAC", "Energy savings"],
        behaviors: ["Business owners", "Frequent travelers (hospitality industry)"],
      },
    ],
    adVariants: [
      {
        name: "Commercial Rebate Ad",
        primaryText: "📢 NJ Business Owners: Up to 80% of your commercial HVAC upgrade could be covered.\n\nJCP&L and PSE&G commercial incentive programs are available NOW — but most business owners don't know how to stack them.\n\nMechanical Enterprise has helped NJ businesses save millions:\n🏢 2.6 million sq ft of commercial space served\n🏨 Hotels, restaurants, healthcare facilities, offices\n⚡ VRV/VRF system specialists\n🔧 BMS integration experts\n\nWMBE/SBE Certified | Licensed & Insured | 20+ Years\n\nGet a free commercial HVAC assessment 👇",
        headline: "Up to 80% Commercial HVAC Incentives",
        description: "Free commercial assessment. JCP&L & PSE&G programs available.",
        cta: "Get Assessment",
        imageDescription: "Modern commercial building exterior with HVAC units on roof. Professional, corporate feel. Text overlay: 'Up to 80% covered by incentives'. Clean blue sky background.",
      },
      {
        name: "VRV/VRF Specialist Ad",
        primaryText: "Is your commercial building still running old HVAC equipment?\n\nVRV/VRF systems can reduce your energy costs by up to 30% while providing superior comfort control for every zone in your building.\n\nMechanical Enterprise specializes in:\n✅ VRV/VRF system design & installation\n✅ BMS (Building Management System) integration\n✅ Multi-zone climate control\n✅ Energy-efficient upgrades with incentives up to 80%\n\nServing hotels, office buildings, retail, healthcare, and industrial facilities across all 15 NJ counties.\n\nFree site survey and proposal 👇",
        headline: "VRV/VRF Systems – Cut Energy Costs 30%",
        description: "Free site survey. Incentives up to 80% for NJ businesses.",
        cta: "Book Site Survey",
        imageDescription: "Split image: old rooftop HVAC units vs. modern VRF system. Clean, technical aesthetic. Text: 'Cut energy costs 30%'. Professional commercial setting.",
      },
    ],
  },
  {
    id: "retargeting",
    name: "Website Retargeting",
    icon: TrendingUp,
    color: "bg-purple-500",
    objective: "Conversions",
    budget: "$15–$25/day",
    placement: "Facebook Feed, Instagram Feed, Audience Network",
    audiences: [
      {
        name: "Website Visitors (Last 30 Days)",
        age: "25–65",
        gender: "All",
        locations: "NJ (auto-matched from pixel)",
        interests: [],
        behaviors: ["Visited mechanicalenterprise.com in last 30 days"],
      },
      {
        name: "Popup Abandoners",
        age: "25–65",
        gender: "All",
        locations: "NJ",
        interests: [],
        behaviors: ["Visited /residential or /commercial but did not submit lead form"],
      },
    ],
    adVariants: [
      {
        name: "Retargeting Reminder Ad",
        primaryText: "Still thinking about upgrading your HVAC system?\n\nThe incentives won't last forever — PSE&G and NJ Clean Energy programs have limited funding each year.\n\nMechanical Enterprise is ready to help you:\n✅ Get up to $16K back on residential heat pumps\n✅ Up to 80% covered for commercial systems\n✅ Free in-home estimate, no obligation\n✅ We handle ALL the paperwork\n\nDon't miss out. Book your free estimate today 👇",
        headline: "Don't Miss Your HVAC Incentives",
        description: "Limited funding available. Book your free estimate now.",
        cta: "Book Now",
        imageDescription: "Urgency-focused: countdown timer visual with HVAC system. Text: 'Incentives ending soon'. Clean, direct design.",
      },
    ],
  },
];

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied to clipboard!`);
}

export default function FacebookCampaigns() {
  const { isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState(fbCampaigns[0].id);

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

  const activeCampaign = fbCampaigns.find(c => c.id === activeTab)!;

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
                  <Users className="h-6 w-6 text-[#ff6b35]" />
                  Facebook & Instagram Campaigns
                </h1>
                <p className="text-sm text-muted-foreground">Ready-to-launch social media ad campaigns</p>
              </div>
            </div>
            <Button
              className="bg-[#1877F2] hover:bg-[#1877F2]/90"
              onClick={() => window.open("https://business.facebook.com/adsmanager", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" /> Open Ads Manager
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
      <div className="container py-4">
        {/* Campaign Overview Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {fbCampaigns.map(campaign => (
            <Card
              key={campaign.id}
              className={`cursor-pointer transition-all ${activeTab === campaign.id ? "ring-2 ring-[#ff6b35] shadow-lg" : "hover:shadow-md"}`}
              onClick={() => setActiveTab(campaign.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`${campaign.color} p-2 rounded-lg`}>
                    <campaign.icon className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-base">{campaign.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span><strong>Objective:</strong> {campaign.objective}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span><strong>Budget:</strong> {campaign.budget}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span><strong>Audiences:</strong> {campaign.audiences.length}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Campaign Detail */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value={activeCampaign.id}>
            <div className="space-y-6">
              {/* Audiences */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-[#ff6b35]" />
                    Target Audiences
                  </CardTitle>
                  <CardDescription>{activeCampaign.placement}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeCampaign.audiences.map((audience, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-[#1e3a5f]">{audience.name}</h3>
                        <Badge variant="outline">{audience.age} • {audience.gender}</Badge>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium text-slate-600 mb-1">Locations</p>
                          <p className="text-slate-700">{audience.locations}</p>
                          {audience.income && (
                            <p className="mt-2"><span className="font-medium">Income:</span> {audience.income}</p>
                          )}
                        </div>
                        <div>
                          {audience.interests.length > 0 && (
                            <>
                              <p className="font-medium text-slate-600 mb-1">Interests</p>
                              <div className="flex flex-wrap gap-1">
                                {audience.interests.map((int, j) => (
                                  <span key={j} className="px-2 py-0.5 bg-blue-50 text-blue-800 text-xs rounded border border-blue-200">{int}</span>
                                ))}
                              </div>
                            </>
                          )}
                          {audience.behaviors.length > 0 && (
                            <div className="mt-2">
                              <p className="font-medium text-slate-600 mb-1">Behaviors</p>
                              <div className="flex flex-wrap gap-1">
                                {audience.behaviors.map((b, j) => (
                                  <span key={j} className="px-2 py-0.5 bg-green-50 text-green-800 text-xs rounded border border-green-200">{b}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Ad Variants */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-[#ff6b35]" />
                    Ad Copy Variants ({activeCampaign.adVariants.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {activeCampaign.adVariants.map((variant, i) => (
                    <div key={i} className="border rounded-lg overflow-hidden">
                      <div className="bg-slate-100 px-4 py-2 flex items-center justify-between">
                        <h3 className="font-semibold text-[#1e3a5f]">{variant.name}</h3>
                        <Badge className="bg-[#ff6b35] text-white">{variant.cta}</Badge>
                      </div>
                      <div className="p-4 space-y-4">
                        {/* Primary Text */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-slate-700">Primary Text</p>
                            <Button size="sm" variant="ghost" className="h-6 text-xs"
                              onClick={() => copyToClipboard(variant.primaryText, "Primary Text")}>
                              <Copy className="h-3 w-3 mr-1" /> Copy
                            </Button>
                          </div>
                          <div className="bg-white border rounded p-3 text-sm whitespace-pre-line text-slate-800">
                            {variant.primaryText}
                          </div>
                        </div>

                        {/* Headline & Description */}
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-slate-700">Headline</p>
                              <Button size="sm" variant="ghost" className="h-6 text-xs"
                                onClick={() => copyToClipboard(variant.headline, "Headline")}>
                                <Copy className="h-3 w-3 mr-1" /> Copy
                              </Button>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm font-semibold text-blue-900">
                              {variant.headline}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-slate-700">Description</p>
                              <Button size="sm" variant="ghost" className="h-6 text-xs"
                                onClick={() => copyToClipboard(variant.description, "Description")}>
                                <Copy className="h-3 w-3 mr-1" /> Copy
                              </Button>
                            </div>
                            <div className="bg-slate-50 border rounded p-3 text-sm text-slate-700">
                              {variant.description}
                            </div>
                          </div>
                        </div>

                        {/* Image Brief */}
                        <div>
                          <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                            <Image className="h-4 w-4" /> Creative Brief (for designer/AI image generation)
                          </p>
                          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                            {variant.imageDescription}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Setup Checklist */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Facebook Ads Setup Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3">Account Setup</h3>
                <div className="space-y-2 text-sm">
                  {[
                    "Create Meta Business Suite account at business.facebook.com",
                    "Add Facebook Pixel to website (for retargeting)",
                    "Connect Instagram Business account",
                    "Verify business domain (mechanicalenterprise.com)",
                    "Set up payment method",
                    "Create Custom Audience from website visitors",
                    "Upload customer email list for Lookalike Audiences",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded border-2 border-slate-300 flex-shrink-0 mt-0.5"></div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3">Creative Assets Needed</h3>
                <div className="space-y-2 text-sm">
                  {[
                    "Company logo (PNG, transparent background)",
                    "Before/after heat pump installation photos",
                    "Team photo (builds trust)",
                    "Commercial building HVAC photos",
                    "Customer testimonial video (30–60 seconds)",
                    "1080x1080 square images for feed ads",
                    "1080x1920 vertical images for Stories/Reels",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded border-2 border-slate-300 flex-shrink-0 mt-0.5"></div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-blue-800">Recommended Starting Strategy</p>
                  <p className="text-blue-700 mt-1">
                    Start with the <strong>Residential Homeowners</strong> campaign at $30/day using Lead Generation objective.
                    Use Meta's built-in lead form (faster than sending to website) to capture name, email, and phone.
                    After 2 weeks, add retargeting at $15/day targeting website visitors. Scale what works.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}

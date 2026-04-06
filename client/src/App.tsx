import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import About from "./pages/About";
import Services from "./pages/Services";
import Contact from "./pages/Contact";
import RebateGuide from "./pages/RebateGuide";
import ResidentialCampaigns from "./pages/ResidentialCampaigns";
import CommercialCampaigns from "./pages/CommercialCampaigns";
import MaintenanceSubscription from "./pages/MaintenanceSubscription";
import Partnerships from "./pages/Partnerships";
import Careers from "./pages/Careers";
import MarketingDashboard from "./pages/MarketingDashboard";
import LeadTracker from "./pages/LeadTracker";
import CampaignPerformance from "./pages/CampaignPerformance";
import Testimonials from "./pages/Testimonials";
import AIVADashboard from "./pages/AIVADashboard";
import AIVASettings from "./pages/AIVASettings";
import LeadScoringDashboard from "./pages/LeadScoringDashboard";
import AIAssistantPrompts from "./pages/AIAssistantPrompts";
import AIScriptManager from "./pages/AIScriptManager";
import AdminPortal from "./pages/AdminPortal";
import GoogleAdsCampaigns from "./pages/GoogleAdsCampaigns";
import FacebookCampaigns from "./pages/FacebookCampaigns";
import FacebookAdsCampaigns from "./pages/FacebookAdsCampaigns";
import EmailSMSCampaigns from "./pages/EmailSMSCampaigns";
import SmsCampaigns from "./pages/SmsCampaigns";
import CampaignGenerator from "./pages/CampaignGenerator";
import LPHeatPumpRebates from "./pages/lp/LPHeatPumpRebates";
import LPCommercialVRV from "./pages/lp/LPCommercialVRV";
import LPEmergencyHVAC from "./pages/lp/LPEmergencyHVAC";
import LPFBResidential from "./pages/lp/LPFBResidential";
import LPFBCommercial from "./pages/lp/LPFBCommercial";
import LPRebateGuide from "./pages/lp/LPRebateGuide";
import LPMaintenanceOffer from "./pages/lp/LPMaintenanceOffer";
import LPReferralPartner from "./pages/lp/LPReferralPartner";
import LPPsegRebate from "./pages/lp/LPPsegRebate";
import LPPsegChecklist from "./pages/lp/LPPsegChecklist";
import PromosLanding from "./pages/PromosLanding";
import Qualify from "./pages/Qualify";
import RebateCalculator from "./pages/RebateCalculator";
import CommandCenter from "./pages/CommandCenter";
import LeadDashboard from "./pages/LeadDashboard";
import MarketingAutopilot from "./pages/MarketingAutopilot";
import TeamLogin from "./pages/TeamLogin";
import AcceptInvite from "./pages/AcceptInvite";
import ResetPassword from "./pages/ResetPassword";
import TeamManagement from "./pages/TeamManagement";
import NotFound from "./pages/NotFound";
import AssessmentSubmissions from "./pages/AssessmentSubmissions";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import LiveChatWidget from "./components/LiveChatWidget";
import CompetitorPage from "./pages/CompetitorPage";
import CityPage from "./pages/CityPage";
import ServicePage from "./pages/ServicePage";
import LuxuryAreaPage from "./pages/LuxuryAreaPage";
import BlogIndex from "./pages/BlogIndex";
import BlogPost from "./pages/BlogPost";
import DirectInstallIndex from "./pages/DirectInstallIndex";
import DirectInstallPage from "./pages/DirectInstallPage";
import Presentation from "./pages/Presentation";
import AnalyticsReports from "./pages/AnalyticsReports";
import TakeOffAI from "./pages/TakeOffAI";
import TakeOffDetail from "./pages/TakeOffDetail";
import TakeOffPublic from "./pages/TakeOffPublic";

// Helper to wrap a page in ProtectedRoute cleanly
const protect = (Page: React.ComponentType) => () => <ProtectedRoute component={Page} />;

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
      {/* ── Public routes ─────────────────────────────────────────── */}
      <Route path={"/"} component={Home} />
      <Route path={"/about"} component={About} />
      <Route path={"/services"} component={Services} />
      <Route path={"/contact"} component={Contact} />
      <Route path={"/rebate-guide"} component={RebateGuide} />
      <Route path={"/residential"} component={ResidentialCampaigns} />
      <Route path={"/commercial"} component={CommercialCampaigns} />
      <Route path={"/maintenance"} component={MaintenanceSubscription} />
      <Route path={"/partnerships"} component={Partnerships} />
      <Route path={"/careers"} component={Careers} />
      <Route path={"/testimonials"} component={Testimonials} />

      {/* Team auth routes — public (no login required to access these) */}
      <Route path={"/team-login"} component={TeamLogin} />
      <Route path={"/accept-invite"} component={AcceptInvite} />
      <Route path={"/reset-password"} component={ResetPassword} />

      {/* Campaign Landing Pages — no nav, optimized for paid traffic */}
      <Route path={"/lp/heat-pump-rebates"} component={LPHeatPumpRebates} />
      <Route path={"/lp/commercial-vrv"} component={LPCommercialVRV} />
      <Route path={"/lp/emergency-hvac"} component={LPEmergencyHVAC} />
      <Route path={"/lp/fb-residential"} component={LPFBResidential} />
      <Route path={"/lp/fb-commercial"} component={LPFBCommercial} />
      <Route path={"/lp/rebate-guide"} component={LPRebateGuide} />
      <Route path={"/lp/maintenance-offer"} component={LPMaintenanceOffer} />
      <Route path={"/lp/referral-partner"} component={LPReferralPartner} />
      <Route path={"/pseg-rebate-contractor-nj"} component={LPPsegRebate} />
      <Route path={"/pseg-rebate-checklist"} component={LPPsegChecklist} />
      <Route path={"/promos"} component={PromosLanding} />
      <Route path={"/qualify"} component={Qualify} />
      <Route path={"/assessment"} component={Qualify} />
      <Route path={"/rebate-calculator"} component={RebateCalculator} />
      <Route path={"/rebate-calc"} component={RebateCalculator} />
      <Route path={"/courses"} component={Courses} />
      <Route path={"/courses/:id"} component={CourseDetail} />

      {/* Blog */}
      <Route path={"/blog"} component={BlogIndex} />
      <Route path={"/blog/nj-heat-pump-rebates-2026"} component={() => <BlogPost slug="nj-heat-pump-rebates-2026" />} />
      <Route path={"/blog/:slug"} component={({ params }: { params: { slug: string } }) => <BlogPost slug={params.slug} />} />

      {/* Direct Install industry pages */}
      <Route path={"/direct-install"} component={DirectInstallIndex} />
      <Route path={"/direct-install/:slug"} component={({ params }: { params: { slug: string } }) => <DirectInstallPage slug={params.slug} />} />

      {/* Competitor comparison pages — SEO conquest */}
      <Route path={"/vs-aj-perri"} component={() => <CompetitorPage competitor="A.J. Perri" slug="aj-perri" />} />
      <Route path={"/vs-gold-medal-service"} component={() => <CompetitorPage competitor="Gold Medal Service" slug="gold-medal-service" />} />
      <Route path={"/vs-horizon-services"} component={() => <CompetitorPage competitor="Horizon Services" slug="horizon-services" />} />
      <Route path={"/vs-hutchinson"} component={() => <CompetitorPage competitor="Hutchinson" slug="hutchinson" />} />

      {/* City landing pages — local SEO */}
      <Route path={"/hvac-newark-nj"} component={() => <CityPage city="Newark" slug="newark" />} />
      <Route path={"/hvac-elizabeth-nj"} component={() => <CityPage city="Elizabeth" slug="elizabeth" />} />
      <Route path={"/hvac-jersey-city-nj"} component={() => <CityPage city="Jersey City" slug="jersey-city" />} />
      <Route path={"/hvac-hoboken-nj"} component={() => <CityPage city="Hoboken" slug="hoboken" />} />
      <Route path={"/hvac-bayonne-nj"} component={() => <CityPage city="Bayonne" slug="bayonne" />} />
      <Route path={"/hvac-kearny-nj"} component={() => <CityPage city="Kearny" slug="kearny" />} />
      <Route path={"/hvac-harrison-nj"} component={() => <CityPage city="Harrison" slug="harrison" />} />
      <Route path={"/hvac-east-orange-nj"} component={() => <CityPage city="East Orange" slug="east-orange" />} />
      <Route path={"/hvac-orange-nj"} component={() => <CityPage city="Orange" slug="orange" />} />
      <Route path={"/hvac-west-orange-nj"} component={() => <CityPage city="West Orange" slug="west-orange" />} />
      <Route path={"/hvac-south-orange-nj"} component={() => <CityPage city="South Orange" slug="south-orange" />} />
      <Route path={"/hvac-maplewood-nj"} component={() => <CityPage city="Maplewood" slug="maplewood" />} />
      <Route path={"/hvac-irvington-nj"} component={() => <CityPage city="Irvington" slug="irvington" />} />
      <Route path={"/hvac-bloomfield-nj"} component={() => <CityPage city="Bloomfield" slug="bloomfield" />} />
      <Route path={"/hvac-nutley-nj"} component={() => <CityPage city="Nutley" slug="nutley" />} />
      <Route path={"/hvac-belleville-nj"} component={() => <CityPage city="Belleville" slug="belleville" />} />
      <Route path={"/hvac-montclair-nj"} component={() => <CityPage city="Montclair" slug="montclair" />} />
      <Route path={"/hvac-clifton-nj"} component={() => <CityPage city="Clifton" slug="clifton" />} />
      <Route path={"/hvac-passaic-nj"} component={() => <CityPage city="Passaic" slug="passaic" />} />
      <Route path={"/hvac-garfield-nj"} component={() => <CityPage city="Garfield" slug="garfield" />} />
      <Route path={"/hvac-linden-nj"} component={() => <CityPage city="Linden" slug="linden" />} />
      <Route path={"/hvac-rahway-nj"} component={() => <CityPage city="Rahway" slug="rahway" />} />
      <Route path={"/hvac-roselle-nj"} component={() => <CityPage city="Roselle" slug="roselle" />} />
      <Route path={"/hvac-roselle-park-nj"} component={() => <CityPage city="Roselle Park" slug="roselle-park" />} />
      <Route path={"/hvac-hillside-nj"} component={() => <CityPage city="Hillside" slug="hillside" />} />
      <Route path={"/hvac-union-nj"} component={() => <CityPage city="Union" slug="union" />} />
      <Route path={"/hvac-springfield-nj"} component={() => <CityPage city="Springfield" slug="springfield" />} />
      <Route path={"/hvac-millburn-nj"} component={() => <LuxuryAreaPage area="Millburn" slug="millburn" county="Essex County" incomeContext="affluent Essex County suburb" />} />
      <Route path={"/hvac-short-hills-nj"} component={() => <LuxuryAreaPage area="Short Hills" slug="short-hills" county="Essex County" incomeContext="one of NJ's most affluent communities" />} />
      <Route path={"/hvac-summit-nj"} component={() => <LuxuryAreaPage area="Summit" slug="summit" county="Union County" incomeContext="affluent Union County suburb" />} />
      <Route path={"/hvac-westfield-nj"} component={() => <CityPage city="Westfield" slug="westfield" />} />
      <Route path={"/hvac-cranford-nj"} component={() => <CityPage city="Cranford" slug="cranford" />} />
      <Route path={"/hvac-clark-nj"} component={() => <CityPage city="Clark" slug="clark" />} />
      <Route path={"/hvac-woodbridge-nj"} component={() => <CityPage city="Woodbridge" slug="woodbridge" />} />
      <Route path={"/hvac-secaucus-nj"} component={() => <CityPage city="Secaucus" slug="secaucus" />} />
      <Route path={"/hvac-north-bergen-nj"} component={() => <CityPage city="North Bergen" slug="north-bergen" />} />
      <Route path={"/hvac-weehawken-nj"} component={() => <CityPage city="Weehawken" slug="weehawken" />} />
      <Route path={"/hvac-union-city-nj"} component={() => <CityPage city="Union City" slug="union-city" />} />
      <Route path={"/hvac-west-new-york-nj"} component={() => <CityPage city="West New York" slug="west-new-york" />} />
      <Route path={"/hvac-guttenberg-nj"} component={() => <CityPage city="Guttenberg" slug="guttenberg" />} />
      <Route path={"/hvac-hackensack-nj"} component={() => <CityPage city="Hackensack" slug="hackensack" />} />
      <Route path={"/hvac-teaneck-nj"} component={() => <CityPage city="Teaneck" slug="teaneck" />} />
      <Route path={"/hvac-englewood-nj"} component={() => <CityPage city="Englewood" slug="englewood" />} />
      <Route path={"/hvac-fort-lee-nj"} component={() => <CityPage city="Fort Lee" slug="fort-lee" />} />
      <Route path={"/hvac-edgewater-nj"} component={() => <CityPage city="Edgewater" slug="edgewater" />} />
      <Route path={"/hvac-palisades-park-nj"} component={() => <CityPage city="Palisades Park" slug="palisades-park" />} />
      <Route path={"/hvac-ridgefield-nj"} component={() => <CityPage city="Ridgefield" slug="ridgefield" />} />
      <Route path={"/hvac-fairview-nj"} component={() => <CityPage city="Fairview" slug="fairview" />} />
      <Route path={"/hvac-cliffside-park-nj"} component={() => <CityPage city="Cliffside Park" slug="cliffside-park" />} />

      {/* Service-specific pages */}
      <Route path={"/heat-pump-installation-nj"} component={() => <ServicePage service="Heat Pump" slug="heat-pump-installation-nj" description="High-efficiency heat pump systems fully eligible for NJ rebates and federal tax credits. Replace your old heating system with a modern heat pump and qualify for up to $16,000 in NJ rebates plus a $2,000 federal tax credit. Heat pumps provide both heating and cooling in one system, reducing energy bills by up to 50%." />} />
      <Route path={"/central-ac-installation-nj"} component={() => <ServicePage service="Central AC" slug="central-ac-installation-nj" description="New central air conditioning installation for NJ homes. Modern high-efficiency systems with SEER2 ratings of 15+ qualify for NJ rebates and federal tax credits. We handle sizing, installation, permits, and all rebate paperwork." />} />
      <Route path={"/ductless-mini-split-installation-nj"} component={() => <ServicePage service="Ductless Mini-Split" slug="ductless-mini-split-installation-nj" description="Perfect for NJ homes without existing ductwork. Multi-zone ductless mini-split systems provide room-by-room temperature control with maximum energy efficiency. Fully eligible for NJ rebates up to $16,000 and federal tax credits." />} />
      <Route path={"/hvac-system-replacement-nj"} component={() => <ServicePage service="Full HVAC System Replacement" slug="hvac-system-replacement-nj" description="Complete HVAC system replacement for NJ homes and businesses. We assess your current system, recommend the best replacement options, handle full installation, permits, inspections, and all rebate paperwork. Most homeowners qualify for significant rebates." />} />
      <Route path={"/commercial-hvac-installation-nj"} component={() => <ServicePage service="Commercial HVAC" slug="commercial-hvac-installation-nj" description="Commercial HVAC installation for offices, retail stores, restaurants, healthcare facilities, and warehouses across NJ. Rebates can cover up to 80% of commercial installation costs. Free commercial assessment available." />} />
      <Route path={"/vrv-vrf-installation-nj"} component={() => <ServicePage service="VRV/VRF System" slug="vrv-vrf-installation-nj" description="VRV/VRF variable refrigerant systems for NJ commercial properties. Multi-zone systems with individual room control, maximum energy efficiency, and rebates covering up to 80% of installation costs. Ideal for offices, retail, and multi-floor buildings." />} />
      <Route path={"/heat-pump-rebates-nj"} component={() => <ServicePage service="Heat Pump Rebates NJ" slug="heat-pump-rebates-nj" description="NJ homeowners can qualify for up to $16,000 in heat pump rebates plus a $2,000 federal tax credit in 2026. We assess your exact eligibility, recommend qualifying equipment, and handle all rebate applications at no cost to you." />} />
      <Route path={"/hvac-financing-nj"} component={() => <ServicePage service="HVAC Financing" slug="hvac-financing-nj" description="0% financing options available for NJ homeowners replacing their HVAC system. When combined with NJ rebates up to $16,000 and the federal tax credit up to $2,000, many homeowners pay $0 out of pocket for a brand new system." />} />

      {/* Luxury area pages — premium messaging */}
      <Route path={"/hvac-madison-nj"} component={() => <LuxuryAreaPage area="Madison" slug="madison" county="Morris County" incomeContext="affluent Morris County suburb" />} />
      <Route path={"/hvac-chatham-nj"} component={() => <LuxuryAreaPage area="Chatham" slug="chatham" county="Morris County" incomeContext="upscale Morris County community" />} />
      <Route path={"/hvac-mendham-nj"} component={() => <LuxuryAreaPage area="Mendham" slug="mendham" county="Morris County" incomeContext="luxury Morris County estate area" />} />
      <Route path={"/hvac-bernardsville-nj"} component={() => <LuxuryAreaPage area="Bernardsville" slug="bernardsville" county="Somerset County" incomeContext="prestigious Somerset Hills area" />} />
      <Route path={"/hvac-chester-nj"} component={() => <LuxuryAreaPage area="Chester" slug="chester" county="Morris County" incomeContext="affluent Morris County town" />} />
      <Route path={"/hvac-harding-nj"} component={() => <LuxuryAreaPage area="Harding Township" slug="harding" county="Morris County" incomeContext="one of NJs wealthiest townships" />} />
      <Route path={"/hvac-bedminster-nj"} component={() => <LuxuryAreaPage area="Bedminster" slug="bedminster" county="Somerset County" incomeContext="prestigious Somerset County estate area" />} />
      <Route path={"/hvac-peapack-nj"} component={() => <LuxuryAreaPage area="Peapack-Gladstone" slug="peapack" county="Somerset County" incomeContext="prestigious equestrian estate community" />} />
      <Route path={"/hvac-mountain-lakes-nj"} component={() => <LuxuryAreaPage area="Mountain Lakes" slug="mountain-lakes" county="Morris County" incomeContext="upscale Morris County lake community" />} />
      <Route path={"/hvac-livingston-nj"} component={() => <LuxuryAreaPage area="Livingston" slug="livingston" county="Essex County" incomeContext="affluent Essex County suburb" />} />
      <Route path={"/hvac-west-caldwell-nj"} component={() => <LuxuryAreaPage area="West Caldwell" slug="west-caldwell" county="Essex County" incomeContext="upscale Essex County town" />} />
      <Route path={"/hvac-new-providence-nj"} component={() => <LuxuryAreaPage area="New Providence" slug="new-providence" county="Union County" incomeContext="affluent Union County suburb" />} />
      <Route path={"/hvac-alpine-nj"} component={() => <LuxuryAreaPage area="Alpine" slug="alpine" county="Bergen County" incomeContext="one of the wealthiest zip codes in America" />} />
      <Route path={"/hvac-saddle-river-nj"} component={() => <LuxuryAreaPage area="Saddle River" slug="saddle-river" county="Bergen County" incomeContext="ultra-luxury Bergen County estate area" />} />
      <Route path={"/hvac-franklin-lakes-nj"} component={() => <LuxuryAreaPage area="Franklin Lakes" slug="franklin-lakes" county="Bergen County" incomeContext="affluent Bergen County community" />} />
      <Route path={"/hvac-wyckoff-nj"} component={() => <LuxuryAreaPage area="Wyckoff" slug="wyckoff" county="Bergen County" incomeContext="upscale Bergen County suburb" />} />

      {/* North NJ city pages — Morris County */}
      <Route path={"/hvac-morristown-nj"} component={() => <CityPage city="Morristown" slug="morristown" />} />
      <Route path={"/hvac-parsippany-nj"} component={() => <CityPage city="Parsippany" slug="parsippany" />} />
      <Route path={"/hvac-dover-nj"} component={() => <CityPage city="Dover" slug="dover" />} />
      <Route path={"/hvac-rockaway-nj"} component={() => <CityPage city="Rockaway" slug="rockaway" />} />
      <Route path={"/hvac-denville-nj"} component={() => <CityPage city="Denville" slug="denville" />} />
      <Route path={"/hvac-randolph-nj"} component={() => <CityPage city="Randolph" slug="randolph" />} />
      <Route path={"/hvac-roxbury-nj"} component={() => <CityPage city="Roxbury" slug="roxbury" />} />
      <Route path={"/hvac-mount-olive-nj"} component={() => <CityPage city="Mount Olive" slug="mount-olive" />} />
      <Route path={"/hvac-boonton-nj"} component={() => <CityPage city="Boonton" slug="boonton" />} />
      <Route path={"/hvac-butler-nj"} component={() => <CityPage city="Butler" slug="butler" />} />

      {/* North NJ city pages — Passaic County */}
      <Route path={"/hvac-wayne-nj"} component={() => <CityPage city="Wayne" slug="wayne" />} />
      <Route path={"/hvac-pompton-lakes-nj"} component={() => <CityPage city="Pompton Lakes" slug="pompton-lakes" />} />
      <Route path={"/hvac-wanaque-nj"} component={() => <CityPage city="Wanaque" slug="wanaque" />} />
      <Route path={"/hvac-hawthorne-nj"} component={() => <CityPage city="Hawthorne" slug="hawthorne" />} />
      <Route path={"/hvac-woodland-park-nj"} component={() => <CityPage city="Woodland Park" slug="woodland-park" />} />
      <Route path={"/hvac-totowa-nj"} component={() => <CityPage city="Totowa" slug="totowa" />} />
      <Route path={"/hvac-little-falls-nj"} component={() => <CityPage city="Little Falls" slug="little-falls" />} />
      <Route path={"/hvac-west-milford-nj"} component={() => <CityPage city="West Milford" slug="west-milford" />} />

      {/* North NJ city pages — Sussex County */}
      <Route path={"/hvac-newton-nj"} component={() => <CityPage city="Newton" slug="newton" />} />
      <Route path={"/hvac-sparta-nj"} component={() => <CityPage city="Sparta" slug="sparta" />} />
      <Route path={"/hvac-hopatcong-nj"} component={() => <CityPage city="Hopatcong" slug="hopatcong" />} />
      <Route path={"/hvac-sussex-nj"} component={() => <CityPage city="Sussex" slug="sussex" />} />
      <Route path={"/hvac-hardyston-nj"} component={() => <CityPage city="Hardyston" slug="hardyston" />} />

      {/* Public estimating tool (password-protected in-page) */}
      <Route path={"/estimating"} component={TakeOffPublic} />

      {/* ── Protected internal routes (login required) ────────────── */}
      <Route path={"/command-center"} component={protect(CommandCenter)} />
      <Route path={"/marketing-autopilot"} component={protect(MarketingAutopilot)} />
      <Route path={"/marketing-dashboard"} component={protect(MarketingDashboard)} />
      <Route path={"/leads"} component={protect(LeadTracker)} />
      <Route path={"/lead-dashboard"} component={protect(LeadDashboard)} />
      <Route path={"/campaign-performance"} component={protect(CampaignPerformance)} />
      <Route path={"/google-ads-campaigns"} component={protect(GoogleAdsCampaigns)} />
      <Route path={"/facebook-campaigns"} component={protect(FacebookCampaigns)} />
      <Route path={"/facebook-ads-campaigns"} component={protect(FacebookAdsCampaigns)} />
      <Route path={"/email-sms-campaigns"} component={protect(EmailSMSCampaigns)} />
      <Route path={"/sms-campaigns"} component={protect(SmsCampaigns)} />
      <Route path={"/campaign-generator"} component={protect(CampaignGenerator)} />
      <Route path={"/ai-va-dashboard"} component={protect(AIVADashboard)} />
      <Route path={"/ai-va-settings"} component={protect(AIVASettings)} />
      <Route path={"/lead-scoring"} component={protect(LeadScoringDashboard)} />
      <Route path={"/ai-assistant-prompts"} component={protect(AIAssistantPrompts)} />
      <Route path={"/ai-script-manager"} component={protect(AIScriptManager)} />
      <Route path={"/admin"} component={protect(AdminPortal)} />
      <Route path={"/team-management"} component={protect(TeamManagement)} />
      <Route path={"/assessment-submissions"} component={protect(AssessmentSubmissions)} />
      <Route path={"/analytics"} component={protect(AnalyticsReports)} />
      <Route path={"/takeoff-ai"} component={protect(TakeOffAI)} />
      <Route path={"/takeoff-ai/:id"} component={protect(TakeOffDetail)} />

      <Route path={"/presentation-2026"} component={Presentation} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
          <LiveChatWidget />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

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
      <Route path={"/promos"} component={PromosLanding} />
      <Route path={"/qualify"} component={Qualify} />
      <Route path={"/assessment"} component={Qualify} />
      <Route path={"/rebate-calculator"} component={RebateCalculator} />
      <Route path={"/rebate-calc"} component={RebateCalculator} />
      <Route path={"/courses"} component={Courses} />
      <Route path={"/courses/:id"} component={CourseDetail} />

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
      <Route path={"/hvac-millburn-nj"} component={() => <CityPage city="Millburn" slug="millburn" />} />
      <Route path={"/hvac-short-hills-nj"} component={() => <CityPage city="Short Hills" slug="short-hills" />} />
      <Route path={"/hvac-summit-nj"} component={() => <CityPage city="Summit" slug="summit" />} />
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

      {/* ── Protected internal routes (login required) ────────────── */}
      <Route path={"/command-center"} component={protect(CommandCenter)} />
      <Route path={"/marketing-autopilot"} component={protect(MarketingAutopilot)} />
      <Route path={"/marketing-dashboard"} component={protect(MarketingDashboard)} />
      <Route path={"/leads"} component={protect(LeadTracker)} />
      <Route path={"/lead-dashboard"} component={protect(LeadDashboard)} />
      <Route path={"/campaign-performance"} component={protect(CampaignPerformance)} />
      <Route path={"/google-ads-campaigns"} component={protect(GoogleAdsCampaigns)} />
      <Route path={"/facebook-campaigns"} component={protect(FacebookCampaigns)} />
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

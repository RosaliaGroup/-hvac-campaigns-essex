import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
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
import CampaignGenerator from "./pages/CampaignGenerator";
import LPHeatPumpRebates from "./pages/lp/LPHeatPumpRebates";
import LPCommercialVRV from "./pages/lp/LPCommercialVRV";
import LPEmergencyHVAC from "./pages/lp/LPEmergencyHVAC";
import LPFBResidential from "./pages/lp/LPFBResidential";
import LPFBCommercial from "./pages/lp/LPFBCommercial";
import LPRebateGuide from "./pages/lp/LPRebateGuide";
import LPMaintenanceOffer from "./pages/lp/LPMaintenanceOffer";
import LPReferralPartner from "./pages/lp/LPReferralPartner";
import CommandCenter from "./pages/CommandCenter";
import LeadDashboard from "./pages/LeadDashboard";
import MarketingAutopilot from "./pages/MarketingAutopilot";
import NotFound from "./pages/NotFound";

// Helper to wrap a page in ProtectedRoute cleanly
const protect = (Page: React.ComponentType) => () => <ProtectedRoute component={Page} />;

function Router() {
  return (
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

      {/* Campaign Landing Pages — no nav, optimized for paid traffic */}
      <Route path={"/lp/heat-pump-rebates"} component={LPHeatPumpRebates} />
      <Route path={"/lp/commercial-vrv"} component={LPCommercialVRV} />
      <Route path={"/lp/emergency-hvac"} component={LPEmergencyHVAC} />
      <Route path={"/lp/fb-residential"} component={LPFBResidential} />
      <Route path={"/lp/fb-commercial"} component={LPFBCommercial} />
      <Route path={"/lp/rebate-guide"} component={LPRebateGuide} />
      <Route path={"/lp/maintenance-offer"} component={LPMaintenanceOffer} />
      <Route path={"/lp/referral-partner"} component={LPReferralPartner} />

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
      <Route path={"/campaign-generator"} component={protect(CampaignGenerator)} />
      <Route path={"/ai-va-dashboard"} component={protect(AIVADashboard)} />
      <Route path={"/ai-va-settings"} component={protect(AIVASettings)} />
      <Route path={"/lead-scoring"} component={protect(LeadScoringDashboard)} />
      <Route path={"/ai-assistant-prompts"} component={protect(AIAssistantPrompts)} />
      <Route path={"/ai-script-manager"} component={protect(AIScriptManager)} />
      <Route path={"/admin"} component={protect(AdminPortal)} />

      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

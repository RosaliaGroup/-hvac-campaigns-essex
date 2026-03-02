import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
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
import NotFound from "./pages/NotFound";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
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
      <Route path={"/marketing-dashboard"} component={MarketingDashboard} />
      <Route path={"/leads"} component={LeadTracker} />
      <Route path={"/campaign-performance"} component={CampaignPerformance} />
      <Route path={"/testimonials"} component={Testimonials} />
      <Route path={"/ai-va-dashboard"} component={AIVADashboard} />
      <Route path={"/ai-va-settings"} component={AIVASettings} />
      <Route path={"/lead-scoring"} component={LeadScoringDashboard} />
      <Route path={"/ai-assistant-prompts"} component={AIAssistantPrompts} />
      <Route path={"/ai-script-manager"} component={AIScriptManager} />
      <Route path={"/admin"} component={AdminPortal} />
      <Route path={"/campaign-generator"} component={CampaignGenerator} />
      <Route path={"/google-ads-campaigns"} component={GoogleAdsCampaigns} />
      <Route path={"/facebook-campaigns"} component={FacebookCampaigns} />
      <Route path={"/email-sms-campaigns"} component={EmailSMSCampaigns} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

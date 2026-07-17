import { Redirect, Route, Switch } from "wouter";
import { usePortalAuth } from "./hooks/usePortalAuth";
import { PortalLayout } from "./components/PortalLayout";
import { InlineSpinner } from "./components/common";

import PortalLogin from "./pages/Login";
import PortalVerify from "./pages/Verify";
import PortalDashboard from "./pages/Dashboard";
import PortalEstimates from "./pages/Estimates";
import PortalInvoices from "./pages/Invoices";
import PortalPayments from "./pages/Payments";
import PortalAppointments from "./pages/Appointments";
import PortalServiceHistory from "./pages/ServiceHistory";
import PortalEquipment from "./pages/Equipment";
import PortalWarranties from "./pages/Warranties";
import PortalMaintenance from "./pages/Maintenance";
import PortalDocuments from "./pages/Documents";
import PortalMessages from "./pages/Messages";
import PortalNotFound from "./pages/NotFound";

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">{children}</div>
  );
}

/**
 * Customer Portal entry point. Owns its own routing so `App.tsx` only mounts a
 * single `/portal` wildcard. Public routes (login/verify) render bare; every
 * other route is guarded — unauthenticated visitors are redirected to the
 * portal login, and authenticated ones get the portal shell.
 */
export default function PortalApp() {
  const { me, isAuthenticated, loading } = usePortalAuth();

  return (
    <Switch>
      {/* Public portal auth routes */}
      <Route path="/portal/login" component={PortalLogin} />
      <Route path="/portal/verify" component={PortalVerify} />

      {/* Everything else is guarded */}
      <Route>
        {loading ? (
          <FullScreen>
            <div className="flex items-center gap-2 text-slate-500">
              <InlineSpinner /> <span className="text-sm">Loading your portal…</span>
            </div>
          </FullScreen>
        ) : !isAuthenticated || !me ? (
          <Redirect to="/portal/login" />
        ) : (
          <PortalLayout me={me}>
            <Switch>
              <Route path="/portal" component={PortalDashboard} />
              <Route path="/portal/estimates" component={PortalEstimates} />
              <Route path="/portal/invoices" component={PortalInvoices} />
              <Route path="/portal/payments" component={PortalPayments} />
              <Route path="/portal/appointments" component={PortalAppointments} />
              <Route path="/portal/service-history" component={PortalServiceHistory} />
              <Route path="/portal/equipment" component={PortalEquipment} />
              <Route path="/portal/warranties" component={PortalWarranties} />
              <Route path="/portal/maintenance" component={PortalMaintenance} />
              <Route path="/portal/documents" component={PortalDocuments} />
              <Route path="/portal/messages" component={PortalMessages} />
              <Route component={PortalNotFound} />
            </Switch>
          </PortalLayout>
        )}
      </Route>
    </Switch>
  );
}

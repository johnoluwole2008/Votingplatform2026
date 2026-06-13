import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import IndexPage from "@/pages/index";
import LoginPage from "@/pages/login";
import BallotPage from "@/pages/ballot";
import BallotReviewPage from "@/pages/ballot-review";
import BallotSuccessPage from "@/pages/ballot-success";

import RegisterPage from "@/pages/register";
import RegisterSuccessPage from "@/pages/register-success";

import AdminLoginPage from "@/pages/admin/login";
import AdminDashboardPage from "@/pages/admin/dashboard";
import AdminVotersPage from "@/pages/admin/voters";
import AdminOfficesPage from "@/pages/admin/offices";
import AdminResultsPage from "@/pages/admin/results";
import AdminAuditPage from "@/pages/admin/audit";
import AdminSettingsPage from "@/pages/admin/settings";
import AdminAccountsPage from "@/pages/admin/accounts";
import AdminStudentsPage from "@/pages/admin/students";
import AdminEmailPage from "@/pages/admin/email";
import AdminJoinPage from "@/pages/admin/join";
import ResultsPage from "@/pages/results";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10000 },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={IndexPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/register/success" component={RegisterSuccessPage} />
      <Route path="/ballot" component={BallotPage} />
      <Route path="/ballot/review" component={BallotReviewPage} />
      <Route path="/ballot/success" component={BallotSuccessPage} />

      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin/dashboard" component={AdminDashboardPage} />
      <Route path="/admin/voters" component={AdminVotersPage} />
      <Route path="/admin/offices" component={AdminOfficesPage} />
      <Route path="/admin/results" component={AdminResultsPage} />
      <Route path="/admin/audit" component={AdminAuditPage} />
      <Route path="/admin/settings" component={AdminSettingsPage} />
      <Route path="/admin/accounts" component={AdminAccountsPage} />
      <Route path="/admin/students" component={AdminStudentsPage} />
      <Route path="/admin/email" component={AdminEmailPage} />
      <Route path="/admin/join/:token" component={AdminJoinPage} />
      <Route path="/results" component={ResultsPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

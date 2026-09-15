import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import Login from "./pages/Login";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Trades = lazy(() => import("./pages/Trades"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Journal = lazy(() => import("./pages/Journal"));

function PageLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading page" />
    </div>
  );
}

function ProtectedRouter() {
  return (
    <DashboardLayout>
      <Suspense fallback={<PageLoading />}>
        <Switch>
          <Route path={"/"} component={Dashboard} />
          <Route path={"/calendar"} component={Calendar} />
          <Route path={"/trades"} component={Trades} />
          <Route path={"/analytics"} component={Analytics} />
          <Route path={"/journal"} component={Journal} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </DashboardLayout>
  );
}

function Router() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route>{() => <Login />}</Route>
      </Switch>
    );
  }

  return <ProtectedRouter />;
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

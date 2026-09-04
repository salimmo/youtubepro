import { Redirect, Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ControllerGuide } from "@/components/controller-guide";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { WorkflowProvider, useWorkflow } from "@/lib/workflow-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import AdminPage from "@/pages/admin";
import LoginPage from "@/pages/login";
import ResearchDashboard from "@/pages/research";
import ScriptPage from "@/pages/script";
import SettingsPage from "@/pages/settings";
import ThumbnailPage from "@/pages/thumbnail";

function Router() {
  const { state } = useWorkflow();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  return (
    <Switch key={state.id || "workflow-loading"}>
      <Route path="/" component={ResearchDashboard} />
      <Route path="/ideas">
        <Redirect to="/#ideas" replace />
      </Route>
      <Route path="/script" component={ScriptPage} />
      <Route path="/thumbnail" component={ThumbnailPage} />
      <Route path="/settings" component={isAdmin ? SettingsPage : NotFound} />
      <Route path="/admin" component={isAdmin ? AdminPage : NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  const [location] = useLocation();
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  } as React.CSSProperties;
  // Research uses its own Radix scroll area for the sticky search controls.
  // Other routes use the shell scroll owner so long generated content cannot
  // become trapped inside an unconstrained nested overflow container.
  const routeOwnsScrolling = location === "/" || location === "/ideas";

  return (
    <SidebarProvider style={style}>
      <div className="flex h-dvh w-full overflow-hidden">
        <a
          href="#main-content"
          className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground shadow-md transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Zum Inhalt springen
        </a>
        <AppSidebar />
        <SidebarInset id="main-content" tabIndex={-1} className="min-h-0 overflow-hidden" aria-label="Arbeitsbereich der Anwendung">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" aria-label="Seitenleiste umschalten" />
            </div>
            <div className="flex items-center gap-1">
              <ControllerGuide />
              <ThemeToggle />
            </div>
          </header>
          <div
            className={`min-h-0 flex-1 ${routeOwnsScrolling ? "overflow-hidden" : "overflow-y-auto"}`}
            data-page-scroll-owner={routeOwnsScrolling ? "route" : "shell"}
          >
            <Router />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function AuthLoadingScreen() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>Sitzung wird geprüft …</span>
      </div>
    </div>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoadingScreen />;
  if (user === null) return <LoginPage />;
  return (
    <WorkflowProvider>
      <AppLayout />
    </WorkflowProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

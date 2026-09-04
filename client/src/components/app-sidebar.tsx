import { useLocation, Link } from "wouter";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, FileText, Play, Settings, Rocket, Check, ArrowRight, Image, History, Loader2, MoreHorizontal, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { useWorkflow } from "@/lib/workflow-context";
import { useAuth } from "@/lib/auth-context";
import { UserMenu } from "@/components/user-menu";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";

const menuItems = [
  {
    title: "Recherche",
    testId: "link-research",
    url: "/",
    icon: Search,
    step: "research" as const,
  },
  {
    title: "Skript-Writer",
    testId: "link-script-writer",
    url: "/script",
    icon: FileText,
    step: "script" as const,
  },
  {
    title: "Thumbnail-Creator",
    testId: "link-thumbnail-creator",
    url: "/thumbnail",
    icon: Image,
    step: "thumbnail" as const,
  },
];

const stepOrder = ["research", "script", "thumbnail"] as const;
type ShellWorkflowStep = typeof stepOrder[number];
const stepLabels: Record<ShellWorkflowStep, string> = {
  research: "Recherche",
  script: "Skript",
  thumbnail: "Thumbnail",
};
const stepStatusLabels: Record<string, string> = {
  inactive: "inaktiv",
  completed: "abgeschlossen",
  current: "aktuell",
  upcoming: "ausstehend",
};

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const {
    state,
    recentWorkflows,
    historyLoading,
    historyError,
    startWorkflow,
    openWorkflow,
    renameWorkflow,
    removeWorkflow,
    goToStep,
  } = useWorkflow();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const [openingWorkflowId, setOpeningWorkflowId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deletingWorkflow, setDeletingWorkflow] = useState(false);

  const handleStartWorkflow = () => {
    queryClient.removeQueries({ queryKey: ["/api/youtube/search"] });
    startWorkflow();
    setLocation("/");
  };

  const handleOpenWorkflow = async (id: string) => {
    if (id === state.id) return;
    setOpeningWorkflowId(id);
    try {
      const step = await openWorkflow(id);
      if (!step) return;
      queryClient.removeQueries({ queryKey: ["/api/youtube/search"] });
      setLocation(step === "script" ? "/script" : step === "thumbnail" ? "/thumbnail" : "/");
    } finally {
      setOpeningWorkflowId(null);
    }
  };

  const beginRename = (id: string, title: string) => {
    setRenameTarget({ id, title });
    setRenameValue(title);
    setRenameError(null);
  };

  const handleRename = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameTarget) return;
    const title = renameValue.trim().replace(/\s+/g, " ");
    if (!title) {
      setRenameError("Gib einen Workflow-Namen ein.");
      return;
    }
    setSavingName(true);
    try {
      const renamed = await renameWorkflow(renameTarget.id, title);
      if (renamed) setRenameTarget(null);
      else setRenameError("Der Workflow konnte nicht umbenannt werden.");
    } finally {
      setSavingName(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const deletingActiveWorkflow = deleteTarget.id === state.id;
    setDeletingWorkflow(true);
    try {
      const step = await removeWorkflow(deleteTarget.id);
      if (!step) return;
      if (deletingActiveWorkflow) {
        queryClient.removeQueries({ queryKey: ["/api/youtube/search"] });
        setLocation(step === "script" ? "/script" : step === "thumbnail" ? "/thumbnail" : "/");
      }
      setDeleteTarget(null);
    } finally {
      setDeletingWorkflow(false);
    }
  };

  const getStepStatus = (step: ShellWorkflowStep) => {
    if (!state.isWorkflowActive) return "inactive";
    const rawCurrentStep = String(state.currentStep);
    const normalizedCurrentStep: ShellWorkflowStep = rawCurrentStep === "package"
      ? "thumbnail"
      : rawCurrentStep === "ideas"
        ? "research"
        : stepOrder.includes(rawCurrentStep as ShellWorkflowStep)
          ? rawCurrentStep as ShellWorkflowStep
          : "research";
    const currentIndex = stepOrder.indexOf(normalizedCurrentStep);
    const stepIndex = stepOrder.indexOf(step);
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "upcoming";
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" onClick={() => goToStep("research")} className="flex items-center gap-3" aria-label="YouTube Pro Startseite">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Play className="h-5 w-5 text-primary-foreground" fill="currentColor" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-sidebar-foreground" data-testid="text-app-name">
              YouTube Pro
            </span>
            <span className="text-xs text-muted-foreground">
              Recherche & Skript
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3 py-3">
          <div className="space-y-3">
            <Button
              onClick={handleStartWorkflow}
              className="w-full gap-2"
              data-testid="button-new-workflow"
            >
              <Rocket className="h-4 w-4" aria-hidden="true" />
              Neuer Workflow
            </Button>
            <ol className="flex items-center gap-1" aria-label="Workflow-Fortschritt">
              {stepOrder.map((step, index) => {
                const status = getStepStatus(step);
                return (
                  <li
                    key={step}
                    className="flex items-center gap-1"
                    aria-current={status === "current" ? "step" : undefined}
                  >
                    <span className="sr-only">{stepLabels[step]}: {stepStatusLabels[status]}</span>
                    <div
                      aria-hidden="true"
                      title={`${stepLabels[step]}: ${stepStatusLabels[status]}`}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        status === "completed"
                          ? "bg-success"
                          : status === "current"
                          ? "bg-primary animate-pulse"
                          : "bg-muted"
                      }`}
                    />
                    {index < stepOrder.length - 1 && (
                      <div
                        className={`h-0.5 w-4 transition-colors ${
                          status === "completed" ? "bg-success" : "bg-muted"
                        }`}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                const stepStatus = item.step ? getStepStatus(item.step) : "inactive";

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={isActive ? "bg-sidebar-accent" : ""}
                    >
                      <Link
                        href={item.url}
                        onClick={() => goToStep(item.step)}
                        aria-current={isActive ? "page" : undefined}
                        data-testid={item.testId}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <item.icon className={isActive ? "text-primary" : ""} aria-hidden="true" />
                          <span>{item.title}</span>
                        </div>
                        {state.isWorkflowActive && item.step && (
                          <div className="flex items-center">
                            {stepStatus === "completed" && (
                              <Check className="h-4 w-4 text-success" aria-hidden="true" />
                            )}
                            {stepStatus === "current" && (
                              <ArrowRight className="h-4 w-4 text-primary animate-pulse" aria-hidden="true" />
                            )}
                          </div>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="pt-1">
          <SidebarGroupLabel className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            Letzte Workflows
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {historyLoading ? (
              <p className="px-2 py-2 text-xs text-muted-foreground" role="status">Lokaler Verlauf wird geladen …</p>
            ) : recentWorkflows.length === 0 ? (
              <p className="px-2 py-2 text-xs leading-relaxed text-muted-foreground">Deine letzten Recherchen, Skripte und Thumbnails erscheinen hier.</p>
            ) : (
              <SidebarMenu>
                {recentWorkflows.map((workflow) => {
                  const active = workflow.id === state.id;
                  return (
                    <SidebarMenuItem key={workflow.id}>
                      <SidebarMenuButton
                        type="button"
                        isActive={active}
                        className="h-auto min-h-12 items-start py-2 pr-8"
                        onClick={() => void handleOpenWorkflow(workflow.id)}
                        disabled={openingWorkflowId !== null}
                        data-testid={`button-recent-workflow-${workflow.id}`}
                        aria-current={active ? "page" : undefined}
                        title={workflow.title}
                      >
                        {openingWorkflowId === workflow.id ? (
                          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
                        ) : (
                          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${active ? "bg-primary" : "bg-muted-foreground/40"}`} aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-sm font-medium">{workflow.title}</span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {stepLabels[workflow.currentStep]} · {formatDistanceToNowStrict(workflow.updatedAt, { addSuffix: true, locale: de })}
                          </span>
                        </span>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="absolute right-1 top-1.5 flex aspect-square w-7 items-center justify-center rounded-md text-sidebar-foreground opacity-100 outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:opacity-0 md:group-focus-within/menu-item:opacity-100 md:group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 [&>svg]:size-4"
                          aria-label={`Aktionen für ${workflow.title}`}
                          data-testid={`button-workflow-actions-${workflow.id}`}
                        >
                          <MoreHorizontal aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start" className="w-40">
                          <DropdownMenuItem onSelect={() => beginRename(workflow.id, workflow.title)}>
                            <Pencil aria-hidden="true" />
                            Umbenennen
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setDeleteTarget({ id: workflow.id, title: workflow.title })}
                          >
                            <Trash2 aria-hidden="true" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
            {historyError && <p className="px-2 pt-2 text-xs leading-relaxed text-destructive" role="status">{historyError}</p>}
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {isAdmin && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === "/admin"}>
                <Link
                  href="/admin"
                  aria-current={location === "/admin" ? "page" : undefined}
                  data-testid="link-admin"
                >
                  <ShieldCheck className={location === "/admin" ? "text-primary" : ""} aria-hidden="true" />
                  <span>Admin</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === "/settings"}>
                <Link
                  href="/settings"
                  aria-current={location === "/settings" ? "page" : undefined}
                  data-testid="link-settings"
                >
                  <Settings className={location === "/settings" ? "text-primary" : ""} aria-hidden="true" />
                  <span>Einstellungen</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        <UserMenu />
      </SidebarFooter>

      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => { if (!open && !savingName) setRenameTarget(null); }}>
        <DialogContent>
          <form onSubmit={handleRename} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Workflow umbenennen</DialogTitle>
              <DialogDescription>Gib diesem Projekt einen kurzen Namen, den du später leicht wiedererkennst.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Input
                autoFocus
                value={renameValue}
                maxLength={48}
                onChange={(event) => { setRenameValue(event.target.value); setRenameError(null); }}
                aria-label="Workflow-Name"
                aria-invalid={Boolean(renameError)}
                data-testid="input-workflow-name"
              />
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className={renameError ? "text-destructive" : "text-muted-foreground"}>{renameError || "Maximal 48 Zeichen"}</span>
                <span className="tabular-nums text-muted-foreground">{renameValue.length}/48</span>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)} disabled={savingName}>Abbrechen</Button>
              <Button type="submit" disabled={savingName || !renameValue.trim()}>
                {savingName && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Namen speichern
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deletingWorkflow) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>„{deleteTarget?.title}“ löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dadurch werden die lokal gespeicherte Recherche, die Ideen, das Skript und das Thumbnail dieses Workflows entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingWorkflow}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => { event.preventDefault(); void handleDelete(); }}
              disabled={deletingWorkflow}
            >
              {deletingWorkflow && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Workflow löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}

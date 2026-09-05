import { Activity, FolderKanban, LayoutDashboard, ShieldCheck, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityTab } from "@/components/admin/activity-tab";
import { OverviewTab } from "@/components/admin/overview-tab";
import { UsersTab } from "@/components/admin/users-tab";
import { WorkflowsTab } from "@/components/admin/workflows-tab";

export default function AdminPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div>
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-sm font-medium">Administration</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold">Admin-Bereich</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Verwalte Benutzer, behalte die Nutzung im Blick und sieh dir gespeicherte Inhalte an.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-admin-overview">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Übersicht
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-admin-users">
            <Users className="mr-2 h-4 w-4" />
            Benutzer
          </TabsTrigger>
          <TabsTrigger value="workflows" data-testid="tab-admin-workflows">
            <FolderKanban className="mr-2 h-4 w-4" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-admin-activity">
            <Activity className="mr-2 h-4 w-4" />
            Aktivitäten
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="workflows">
          <WorkflowsTab />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

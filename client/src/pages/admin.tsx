import { Activity, FolderKanban, LayoutDashboard, ShieldCheck, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityTab } from "@/components/admin/activity-tab";
import { OverviewTab } from "@/components/admin/overview-tab";
import { UsersTab } from "@/components/admin/users-tab";
import { WorkflowsTab } from "@/components/admin/workflows-tab";
import { useT } from "@/lib/i18n";

export default function AdminPage() {
  const t = useT();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-8">
      <div>
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-sm font-medium">{t("admin.eyebrow")}</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold">{t("admin.title")}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {t("admin.subtitle")}
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-admin-overview">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            {t("admin.tab.overview")}
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-admin-users">
            <Users className="mr-2 h-4 w-4" />
            {t("admin.tab.users")}
          </TabsTrigger>
          <TabsTrigger value="workflows" data-testid="tab-admin-workflows">
            <FolderKanban className="mr-2 h-4 w-4" />
            {t("admin.tab.workflows")}
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-admin-activity">
            <Activity className="mr-2 h-4 w-4" />
            {t("admin.tab.activity")}
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

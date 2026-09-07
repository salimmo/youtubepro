import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, FileText, Loader2, UserCheck, Users } from "lucide-react";
import type { AdminStats } from "@shared/auth-contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/lib/i18n";
import { formatNumber, formatRelative, parseApiError, roleLabel } from "./utils";

interface StatTileProps {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
}

function StatTile({ label, value, icon: Icon }: StatTileProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight">{formatNumber(value)}</p>
          <p className="truncate text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function RoleBadge({ role }: { role: string | null | undefined }) {
  const isAdmin = role === "admin";
  return (
    <Badge
      variant="outline"
      className={isAdmin
        ? "border-primary/40 bg-primary/10 text-primary"
        : "text-muted-foreground"}
    >
      {roleLabel(role)}
    </Badge>
  );
}

export function OverviewTab() {
  const t = useT();
  const { data, isLoading, isError, error } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  if (isLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t("admin.overview.loading")}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("admin.overview.errorTitle")}</AlertTitle>
        <AlertDescription>{parseApiError(error).message}</AlertDescription>
      </Alert>
    );
  }

  const perUser = data?.perUser ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatTile label={t("admin.overview.stat.users")} value={data?.users} icon={Users} />
        <StatTile label={t("admin.overview.stat.activeUsers")} value={data?.activeUsers} icon={UserCheck} />
        <StatTile label={t("admin.overview.stat.activitiesTotal")} value={data?.activitiesTotal} icon={Activity} />
        <StatTile label={t("admin.overview.stat.activities24h")} value={data?.activitiesLast24h} icon={Clock} />
        <StatTile label={t("admin.overview.stat.contents")} value={data?.contents} icon={FileText} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.overview.perUserTitle")}</CardTitle>
          <CardDescription>
            {t("admin.overview.perUserDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {perUser.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("admin.overview.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.overview.col.name")}</TableHead>
                  <TableHead>{t("admin.overview.col.role")}</TableHead>
                  <TableHead className="text-right">{t("admin.overview.col.activities")}</TableHead>
                  <TableHead>{t("admin.overview.col.lastActivity")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perUser.map((row) => (
                  <TableRow key={row.userId} data-testid={`row-stats-user-${row.userId}`}>
                    <TableCell>
                      <div className="font-medium">{row.displayName || row.username}</div>
                      <div className="text-xs text-muted-foreground">@{row.username}</div>
                    </TableCell>
                    <TableCell><RoleBadge role={row.role} /></TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.activities)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatRelative(row.lastActivityAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

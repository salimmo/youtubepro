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
  const { data, isLoading, isError, error } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  if (isLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Kennzahlen werden geladen …
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Kennzahlen nicht verfügbar</AlertTitle>
        <AlertDescription>{parseApiError(error).message}</AlertDescription>
      </Alert>
    );
  }

  const perUser = data?.perUser ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Benutzer" value={data?.users} icon={Users} />
        <StatTile label="Aktive Benutzer" value={data?.activeUsers} icon={UserCheck} />
        <StatTile label="Aktivitäten gesamt" value={data?.activitiesTotal} icon={Activity} />
        <StatTile label="Aktivitäten (24 h)" value={data?.activitiesLast24h} icon={Clock} />
        <StatTile label="Gespeicherte Inhalte" value={data?.contents} icon={FileText} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aktivität pro Benutzer</CardTitle>
          <CardDescription>
            Wer wie viel mit dem Tool arbeitet und wann zuletzt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {perUser.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Noch keine Benutzeraktivität vorhanden.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead className="text-right">Aktivitäten</TableHead>
                  <TableHead>Letzte Aktivität</TableHead>
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

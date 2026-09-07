import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Eye, Loader2, RefreshCw } from "lucide-react";
import {
  ACTIVITY_ACTION_LABELS,
  ACTIVITY_ACTIONS,
  type ActivityListResponse,
  type AdminUser,
} from "@shared/auth-contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { ContentDialog } from "./content-dialog";
import { formatDateTime, formatDuration, parseApiError, truncate, userLabel } from "./utils";

const ALL = "all";
const PAGE_SIZE = 50;

type Translate = (key: string) => string;

// Die Anzeige läuft über das Wörterbuch (admin.action.<action>); die Konstante
// aus dem Vertrag dient nur zur Prüfung, ob die Aktion bekannt ist.
function actionLabel(t: Translate, action: string | null | undefined): string {
  return action && action in ACTIVITY_ACTION_LABELS
    ? t(`admin.action.${action}`)
    : action || "–";
}

function buildActivityUrl(userId: string, action: string, before: number | null): string {
  const params = new URLSearchParams();
  if (userId !== ALL) params.set("userId", userId);
  if (action !== ALL) params.set("action", action);
  if (before !== null) params.set("before", String(before));
  params.set("limit", String(PAGE_SIZE));
  return `/api/admin/activity?${params.toString()}`;
}

export function ActivityTab() {
  const t = useT();
  const [userId, setUserId] = useState<string>(ALL);
  const [action, setAction] = useState<string>(ALL);
  const [contentId, setContentId] = useState<number | null>(null);

  const usersQuery = useQuery<{ users: AdminUser[] }>({ queryKey: ["/api/admin/users"] });
  const users = usersQuery.data?.users ?? [];

  const activityQuery = useInfiniteQuery<ActivityListResponse, Error, { pages: ActivityListResponse[] }, unknown[], number | null>({
    queryKey: ["/api/admin/activity", { userId, action }],
    queryFn: async ({ pageParam }) =>
      apiRequest("GET", buildActivityUrl(userId, action, pageParam)) as Promise<ActivityListResponse>,
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage?.nextBefore ?? null,
  });

  const entries = activityQuery.data?.pages.flatMap((page) => page?.entries ?? []) ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>{t("admin.activity.title")}</CardTitle>
            <CardDescription>
              {t("admin.activity.description")}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => activityQuery.refetch()}
            disabled={activityQuery.isFetching}
            data-testid="button-activity-refresh"
          >
            {activityQuery.isFetching
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <RefreshCw className="mr-2 h-4 w-4" />}
            {t("admin.activity.refresh")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="activity-filter-user">{t("admin.activity.filterUser")}</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger id="activity-filter-user" data-testid="select-activity-user">
                  <SelectValue placeholder={t("admin.activity.allUsers")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("admin.activity.allUsers")}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {userLabel(user.displayName, user.username)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-filter-action">{t("admin.activity.filterAction")}</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger id="activity-filter-action" data-testid="select-activity-action">
                  <SelectValue placeholder={t("admin.activity.allActions")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("admin.activity.allActions")}</SelectItem>
                  {ACTIVITY_ACTIONS.map((item) => (
                    <SelectItem key={item} value={item}>{t(`admin.action.${item}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {activityQuery.isLoading ? (
            <div className="flex min-h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t("admin.activity.loading")}
            </div>
          ) : activityQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>{t("admin.activity.errorTitle")}</AlertTitle>
              <AlertDescription>{parseApiError(activityQuery.error).message}</AlertDescription>
            </Alert>
          ) : entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("admin.activity.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.activity.col.time")}</TableHead>
                  <TableHead>{t("admin.activity.col.user")}</TableHead>
                  <TableHead>{t("admin.activity.col.action")}</TableHead>
                  <TableHead>{t("admin.activity.col.summary")}</TableHead>
                  <TableHead>{t("admin.activity.col.status")}</TableHead>
                  <TableHead className="text-right">{t("admin.activity.col.duration")}</TableHead>
                  <TableHead>{t("admin.activity.col.content")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const ok = entry.status < 400;
                  return (
                    <TableRow key={entry.id} data-testid={`row-activity-${entry.id}`}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {entry.displayName || entry.username || "–"}
                        {entry.username && entry.displayName && (
                          <span className="block text-xs text-muted-foreground">@{entry.username}</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{actionLabel(t, entry.action)}</TableCell>
                      <TableCell className="max-w-md text-muted-foreground" title={entry.summary || undefined}>
                        {truncate(entry.summary) || "–"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={ok
                            ? "border-green-500/40 bg-green-500/10 text-green-500"
                            : "border-destructive/40 bg-destructive/10 text-destructive"}
                        >
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                        {formatDuration(entry.durationMs)}
                      </TableCell>
                      <TableCell>
                        {entry.contentId !== null && entry.contentId !== undefined ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setContentId(entry.contentId)}
                            data-testid={`button-view-content-${entry.contentId}`}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            {t("admin.activity.view")}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {activityQuery.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => activityQuery.fetchNextPage()}
                disabled={activityQuery.isFetchingNextPage}
                data-testid="button-activity-load-more"
              >
                {activityQuery.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("admin.activity.loadMore")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ContentDialog contentId={contentId} onClose={() => setContentId(null)} />
    </div>
  );
}

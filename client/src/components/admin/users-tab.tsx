import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, MoreHorizontal, Plus, UserPlus } from "lucide-react";
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  passwordSchema,
  USER_ROLES,
  type AdminCreateUserRequest,
  type AdminUpdateUserRequest,
  type AdminUser,
  type UserRole,
} from "@shared/auth-contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { RoleBadge } from "./overview-tab";
import { formatDate, formatDateTime, formatNumber, parseApiError, ROLE_LABELS } from "./utils";

interface UsersResponse {
  users: AdminUser[];
}

function invalidateAdminQueries() {
  queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/activity"] });
}

function firstIssueMessage(error: { issues: Array<{ message: string }> }, fallback: string): string {
  return error.issues[0]?.message || fallback;
}

function RoleSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: UserRole;
  onChange: (role: UserRole) => void;
}) {
  const t = useT();
  return (
    <Select value={value} onValueChange={(next) => onChange(next as UserRole)}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={t("admin.users.selectRole")} />
      </SelectTrigger>
      <SelectContent>
        {USER_ROLES.map((role) => (
          <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------- Benutzer anlegen ----------

function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [formError, setFormError] = useState<string | null>(null);

  const reset = () => {
    setUsername("");
    setDisplayName("");
    setPassword("");
    setRole("user");
    setFormError(null);
  };

  const mutation = useMutation({
    mutationFn: async (body: AdminCreateUserRequest) =>
      apiRequest("POST", "/api/admin/users", body) as Promise<{ user: AdminUser }>,
    onSuccess: (data) => {
      invalidateAdminQueries();
      toast({
        title: t("admin.users.createdToast"),
        description: t("admin.users.createdToastDescription", {
          name: data?.user?.displayName || data?.user?.username || t("admin.users.fallbackNameCreated"),
        }),
      });
      reset();
      onOpenChange(false);
    },
    onError: (error) => {
      const { status, message } = parseApiError(error);
      const text = status === 409 ? t("admin.users.usernameTaken") : message;
      setFormError(text);
      toast({ title: t("admin.users.createFailed"), description: text, variant: "destructive" });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = adminCreateUserSchema.safeParse({ username, password, displayName, role });
    if (!parsed.success) {
      setFormError(firstIssueMessage(parsed.error, t("admin.users.checkInput")));
      return;
    }
    setFormError(null);
    mutation.mutate(parsed.data);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("admin.users.createTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.users.createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="create-username">{t("admin.users.username")}</Label>
            <Input
              id="create-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={t("admin.users.usernamePlaceholder")}
              data-testid="input-create-username"
            />
            <p className="text-xs text-muted-foreground">
              {t("admin.users.usernameHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-display-name">{t("admin.users.displayName")}</Label>
            <Input
              id="create-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="off"
              placeholder={t("admin.users.displayNamePlaceholder")}
              data-testid="input-create-display-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-password">{t("admin.users.initialPassword")}</Label>
            <Input
              id="create-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={t("admin.users.passwordPlaceholder")}
              data-testid="input-create-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-role">{t("admin.users.role")}</Label>
            <RoleSelect id="create-role" value={role} onChange={setRole} />
          </div>

          {formError && (
            <p className="text-sm text-destructive" role="alert">{formError}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-create-user-submit">
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              {t("admin.users.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Benutzer bearbeiten ----------

function useUpdateUser(successTitle: string, onDone?: () => void) {
  const t = useT();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: AdminUpdateUserRequest }) =>
      apiRequest("PATCH", `/api/admin/users/${id}`, body) as Promise<{ user: AdminUser }>,
    onSuccess: (data) => {
      invalidateAdminQueries();
      toast({
        title: successTitle,
        description: t("admin.users.updatedToastDescription", {
          name: data?.user?.displayName || data?.user?.username || t("admin.users.fallbackNameUpdated"),
        }),
      });
      onDone?.();
    },
    onError: (error) => {
      toast({
        title: t("admin.users.updateFailed"),
        description: parseApiError(error).message,
        variant: "destructive",
      });
    },
  });
}

function EditUserDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const t = useT();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [role, setRole] = useState<UserRole>(user?.role ?? "user");
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useUpdateUser(t("admin.users.updated"), onClose);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    const body: AdminUpdateUserRequest = {};
    if (displayName.trim() !== user.displayName) body.displayName = displayName;
    if (role !== user.role) body.role = role;
    if (Object.keys(body).length === 0) {
      setFormError(t("admin.users.noChanges"));
      return;
    }
    const parsed = adminUpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || t("admin.users.checkInput"));
      return;
    }
    setFormError(null);
    mutation.mutate({ id: user.id, body: parsed.data });
  };

  return (
    <Dialog open={Boolean(user)} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("admin.users.editTitle")}</DialogTitle>
            <DialogDescription>
              {user ? t("admin.users.editDescription", { username: user.username }) : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="edit-display-name">{t("admin.users.displayName")}</Label>
            <Input
              id="edit-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="off"
              data-testid="input-edit-display-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-role">{t("admin.users.role")}</Label>
            <RoleSelect id="edit-role" value={role} onChange={setRole} />
          </div>

          {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-edit-user-submit">
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Passwort zurücksetzen ----------

function ResetPasswordDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useUpdateUser(t("admin.users.passwordReset"), onClose);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setFormError(firstIssueMessage(parsed.error, t("admin.users.checkInput")));
      return;
    }
    if (password !== confirm) {
      setFormError(t("admin.users.passwordMismatch"));
      return;
    }
    setFormError(null);
    mutation.mutate({ id: user.id, body: { password: parsed.data } });
  };

  return (
    <Dialog open={Boolean(user)} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("admin.users.resetTitle")}</DialogTitle>
            <DialogDescription>
              {user ? t("admin.users.resetDescription", { name: user.displayName, username: user.username }) : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reset-password">{t("admin.users.newPassword")}</Label>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={t("admin.users.passwordPlaceholder")}
              data-testid="input-reset-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-password-confirm">{t("admin.users.repeatPassword")}</Label>
            <Input
              id="reset-password-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              data-testid="input-reset-password-confirm"
            />
          </div>

          {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-reset-password-submit">
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin.users.setPassword")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Aktivieren / Deaktivieren ----------

function ToggleActiveDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const t = useT();
  const deactivating = Boolean(user?.active);
  const mutation = useUpdateUser(deactivating ? t("admin.users.deactivated") : t("admin.users.activated"), onClose);

  return (
    <AlertDialog open={Boolean(user)} onOpenChange={(next) => { if (!next) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {deactivating ? t("admin.users.deactivateQuestion") : t("admin.users.activateQuestion")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {user && t(deactivating ? "admin.users.deactivateDescription" : "admin.users.activateDescription", {
              name: user.displayName,
              username: user.username,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            className={deactivating ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            onClick={(event) => {
              event.preventDefault();
              if (user) mutation.mutate({ id: user.id, body: { active: !user.active } });
            }}
            data-testid="button-toggle-active-confirm"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {deactivating ? t("admin.users.deactivate") : t("admin.users.activate")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------- Tab ----------

type DialogState =
  | { type: "none" }
  | { type: "edit"; user: AdminUser }
  | { type: "password"; user: AdminUser }
  | { type: "toggle"; user: AdminUser };

export function UsersTab() {
  const t = useT();
  const [createOpen, setCreateOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const closeDialog = () => setDialog({ type: "none" });

  const { data, isLoading, isError, error } = useQuery<UsersResponse>({
    queryKey: ["/api/admin/users"],
  });
  const users = data?.users ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>{t("admin.users.title")}</CardTitle>
            <CardDescription>
              {t("admin.users.description")}
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)} data-testid="button-create-user">
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.users.createButton")}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t("admin.users.loading")}
            </div>
          ) : isError ? (
            <Alert variant="destructive">
              <AlertTitle>{t("admin.users.errorTitle")}</AlertTitle>
              <AlertDescription>{parseApiError(error).message}</AlertDescription>
            </Alert>
          ) : users.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("admin.users.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.users.col.displayName")}</TableHead>
                  <TableHead>{t("admin.users.col.username")}</TableHead>
                  <TableHead>{t("admin.users.col.role")}</TableHead>
                  <TableHead>{t("admin.users.col.status")}</TableHead>
                  <TableHead>{t("admin.users.col.createdAt")}</TableHead>
                  <TableHead>{t("admin.users.col.lastLogin")}</TableHead>
                  <TableHead className="text-right">{t("admin.users.col.activities")}</TableHead>
                  <TableHead className="w-12"><span className="sr-only">{t("admin.users.col.actions")}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium">{user.displayName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{user.username}</TableCell>
                    <TableCell><RoleBadge role={user.role} /></TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={user.active
                          ? "border-green-500/40 bg-green-500/10 text-green-500"
                          : "border-destructive/40 bg-destructive/10 text-destructive"}
                      >
                        {user.active ? t("admin.users.active") : t("admin.users.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(user.lastLoginAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(user.activityCount)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("admin.users.actionsFor", { name: user.displayName })}
                            data-testid={`button-user-actions-${user.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setDialog({ type: "edit", user })}>
                            {t("admin.users.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setDialog({ type: "password", user })}>
                            {t("admin.users.resetPassword")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className={user.active ? "text-destructive focus:text-destructive" : undefined}
                            onSelect={() => setDialog({ type: "toggle", user })}
                          >
                            {user.active ? t("admin.users.deactivate") : t("admin.users.activate")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      {/* key erzwingt frische Formularwerte je Benutzer */}
      {dialog.type === "edit" && (
        <EditUserDialog key={dialog.user.id} user={dialog.user} onClose={closeDialog} />
      )}
      {dialog.type === "password" && (
        <ResetPasswordDialog key={dialog.user.id} user={dialog.user} onClose={closeDialog} />
      )}
      {dialog.type === "toggle" && (
        <ToggleActiveDialog key={dialog.user.id} user={dialog.user} onClose={closeDialog} />
      )}
    </div>
  );
}

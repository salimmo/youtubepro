import { useState, type FormEvent } from "react";
import { ChevronsUpDown, KeyRound, Loader2, LogOut } from "lucide-react";
import { changePasswordRequestSchema, type SessionUser } from "@shared/auth-contracts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { getActiveLanguage, translate, useI18n } from "@/lib/i18n";

function getInitials(user: SessionUser): string {
  const source = (user.displayName || user.username || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

// apiRequest wirft "<status>: <body>". Body ist meist JSON {error}.
function extractApiError(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;
  const match = /^(\d{3}):\s*([\s\S]*)$/.exec(error.message);
  if (!match) return error.message;
  const status = Number(match[1]);
  const body = match[2];
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (parsed && typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
  } catch {
    // Kein JSON
  }
  if (status === 401) return translate(getActiveLanguage(), "shell.user.wrongCurrentPassword");
  if (status === 429) return translate(getActiveLanguage(), "shell.auth.tooManyAttempts");
  return body.trim() || fallback;
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user) return null;

  const roleLabel = user.role === "admin" ? t("shell.user.roleAdmin") : t("shell.user.roleUser");
  const initials = getInitials(user);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sidebar-foreground outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 data-[state=open]:bg-sidebar-accent"
          aria-label={t("shell.user.menuLabel", { name: user.displayName })}
          data-testid="button-user-menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium" data-testid="text-user-display-name">{user.displayName}</span>
            <span className="truncate text-[11px] text-muted-foreground">@{user.username}</span>
          </span>
          <Badge variant={user.role === "admin" ? "default" : "secondary"} className="shrink-0 px-1.5 py-0 text-[10px]" data-testid="badge-user-role">
            {roleLabel}
          </Badge>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-medium">{user.displayName}</span>
            <span className="block truncate text-xs text-muted-foreground">@{user.username} · {roleLabel}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setPasswordDialogOpen(true)} data-testid="menu-change-password">
            <KeyRound aria-hidden="true" />
            {t("shell.user.changePassword")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => { void handleLogout(); }}
            disabled={loggingOut}
            data-testid="menu-logout"
          >
            {loggingOut ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
            {t("shell.user.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        onSuccess={() => {
          toast({
            title: t("shell.user.passwordChangedTitle"),
            description: t("shell.user.passwordChangedDescription"),
          });
        }}
      />
    </>
  );
}

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function ChangePasswordDialog({ open, onOpenChange, onSuccess }: ChangePasswordDialogProps) {
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && saving) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const parsed = changePasswordRequestSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("shell.user.checkInputs"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("shell.user.passwordMismatch"));
      return;
    }
    if (newPassword === currentPassword) {
      setError(t("shell.user.passwordSameAsCurrent"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiRequest("POST", "/api/auth/password", parsed.data);
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(extractApiError(err, t("shell.user.passwordChangeFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <DialogHeader>
            <DialogTitle>{t("shell.user.changePassword")}</DialogTitle>
            <DialogDescription>{t("shell.user.changePasswordDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t("shell.user.currentPassword")}</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                maxLength={200}
                value={currentPassword}
                onChange={(event) => { setCurrentPassword(event.target.value); setError(null); }}
                disabled={saving}
                data-testid="input-current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t("shell.user.newPassword")}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={200}
                value={newPassword}
                onChange={(event) => { setNewPassword(event.target.value); setError(null); }}
                disabled={saving}
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t("shell.user.confirmPassword")}</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={200}
                value={confirmPassword}
                onChange={(event) => { setConfirmPassword(event.target.value); setError(null); }}
                disabled={saving}
                aria-invalid={Boolean(confirmPassword) && confirmPassword !== newPassword}
                data-testid="input-confirm-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert" data-testid="text-password-error">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={saving || !currentPassword || !newPassword || !confirmPassword}
              data-testid="button-save-password"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("shell.user.savePassword")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

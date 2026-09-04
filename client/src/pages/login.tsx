import { useState, type FormEvent } from "react";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !submitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setError("Bitte gib Benutzername und Passwort ein.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(trimmedUsername, password);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-background p-4" aria-label="Anmeldung">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img src="/youtube-pro.svg" alt="" aria-hidden="true" className="mb-2 h-14 w-14" />
          <CardTitle className="text-2xl" data-testid="text-login-title">YouTube Pro</CardTitle>
          <CardDescription>Melde dich an, um mit deiner Recherche fortzufahren.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="login-username">Benutzername</Label>
              <Input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                required
                maxLength={40}
                value={username}
                onChange={(event) => { setUsername(event.target.value); setError(null); }}
                disabled={submitting}
                data-testid="input-login-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Passwort</Label>
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={200}
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(null); }}
                disabled={submitting}
                data-testid="input-login-password"
              />
            </div>

            {error && (
              <Alert variant="destructive" data-testid="alert-login-error">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full gap-2" disabled={!canSubmit} data-testid="button-login">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogIn className="h-4 w-4" aria-hidden="true" />
              )}
              {submitting ? "Anmeldung läuft …" : "Anmelden"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

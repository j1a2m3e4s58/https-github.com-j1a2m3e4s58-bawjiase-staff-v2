import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgmAuth } from "@/store/agm-auth";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, Lock, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Mode = "login" | "reset";

export default function AgmLoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isAuthenticated, mustChangePassword, login, resetPassword } = useAgmAuth();
  const navigate = useNavigate();

  const redirectTarget = useMemo(
    () => (mustChangePassword ? "/agm/change-password" : "/agm/dashboard"),
    [mustChangePassword],
  );

  useEffect(() => {
    if (isAuthenticated) {
      void navigate({ to: redirectTarget, replace: true });
    }
  }, [isAuthenticated, navigate, redirectTarget]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await login(username.trim(), password);
      toast.success("AGM workspace unlocked");
      void navigate({
        to: result.mustChangePassword ? "/agm/change-password" : "/agm/dashboard",
        replace: true,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AGM login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReset(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim() || !resetCode.trim() || !newPassword.trim()) return;
    setIsSubmitting(true);
    try {
      await resetPassword(username.trim(), resetCode.trim(), newPassword);
      toast.success("Password reset successful. Please sign in.");
      setMode("login");
      setPassword("");
      setResetCode("");
      setNewPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reset failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell className="flex min-h-[540px] max-w-[430px] flex-col justify-center px-5 pb-7 pt-20">
      <div className="space-y-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-primary/80">
          AGM Control Desk
        </p>
        <h1 className="font-display text-4xl font-bold text-foreground">
          AGM Pro
        </h1>
        <p className="mx-auto max-w-sm text-sm leading-7 text-muted-foreground">
          Secure access for registration desks, board review, import control, and AGM administration.
        </p>
      </div>

      {mode === "login" ? (
        <form className="mt-8 space-y-5" onSubmit={handleLogin}>
          <div className="space-y-2">
            <Label htmlFor="agm-username">Username</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="agm-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter AGM username"
                autoComplete="username"
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agm-password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="agm-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                className="pl-10 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in..." : "Open AGM Workspace"}
          </Button>

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="transition-colors hover:text-foreground"
            >
              Reset with code
            </button>
            <Link
              to="/agm"
              className="transition-colors hover:text-foreground"
            >
              Back to AGM overview
            </Link>
          </div>
        </form>
      ) : (
        <form className="mt-8 space-y-5" onSubmit={handleReset}>
          <div className="space-y-2">
            <Label htmlFor="agm-reset-username">Username</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="agm-reset-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter AGM username"
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agm-reset-code">Reset Code</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="agm-reset-code"
                value={resetCode}
                onChange={(event) => setResetCode(event.target.value)}
                placeholder="Enter admin-issued code"
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agm-new-password">New Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="agm-new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter new password"
                className="pl-10 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showNewPassword ? "Hide new password" : "Show new password"}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Resetting..." : "Reset AGM Password"}
          </Button>

          <button
            type="button"
            onClick={() => setMode("login")}
            className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to AGM sign in
          </button>
        </form>
      )}
    </AuthShell>
  );
}

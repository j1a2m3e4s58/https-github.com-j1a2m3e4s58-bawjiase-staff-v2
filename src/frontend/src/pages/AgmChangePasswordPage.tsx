import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgmAuth } from "@/store/agm-auth";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Lock, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function AgmChangePasswordPage() {
  const {
    isAuthenticated,
    mustChangePassword,
    session,
    changePassword,
    logout,
  } = useAgmAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      void navigate({ to: "/agm/login", replace: true });
      return;
    }
    if (!mustChangePassword) {
      void navigate({ to: "/agm/dashboard", replace: true });
    }
  }, [isAuthenticated, mustChangePassword, navigate]);

  const passwordMismatch =
    confirmPassword.length > 0 && confirmPassword !== newPassword;
  const isValid =
    currentPassword.trim().length > 0 &&
    newPassword.trim().length >= 8 &&
    newPassword === confirmPassword;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid) return;
    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("AGM password updated");
      void navigate({ to: "/agm/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password update failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReturn() {
    await logout();
    void navigate({ to: "/agm/login", replace: true });
  }

  return (
    <AuthShell className="flex min-h-[540px] max-w-[430px] flex-col justify-center px-5 pb-7 pt-20">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-primary/80">
          AGM Password Update
        </p>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Secure Your AGM Desk
        </h1>
        <p className="mx-auto max-w-sm text-sm leading-7 text-muted-foreground">
          {session?.username
            ? `${session.username}, change the temporary AGM password before continuing.`
            : "Change the temporary AGM password before continuing."}
        </p>
      </div>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="agm-current-password">Current Password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="agm-current-password"
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Enter current password"
              className="pl-10 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showCurrent ? "Hide current password" : "Show current password"}
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="agm-next-password">New Password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="agm-next-password"
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Use at least 8 characters"
              className="pl-10 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowNew((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showNew ? "Hide new password" : "Show new password"}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="agm-confirm-password">Confirm New Password</Label>
          <Input
            id="agm-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat new password"
            className={passwordMismatch ? "border-destructive" : undefined}
          />
          {passwordMismatch ? (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          ) : null}
        </div>

        <Button className="w-full" disabled={!isValid || isSubmitting} type="submit">
          {isSubmitting ? "Updating..." : "Update AGM Password"}
        </Button>
        <Button className="w-full" onClick={handleReturn} type="button" variant="outline">
          Return to AGM Login
        </Button>
      </form>
    </AuthShell>
  );
}

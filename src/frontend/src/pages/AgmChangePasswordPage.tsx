import { createActor } from "@/backend";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/hooks/use-auth";
import { buildClient } from "@/lib/backend-client";
import { useAppActor } from "@/lib/use-app-actor";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Lock, ShieldAlert, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

type VerificationStep = "phone" | "token";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneConfirmation, setPhoneConfirmation] = useState("");
  const [tokenCode, setTokenCode] = useState("");
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStep, setVerificationStep] =
    useState<VerificationStep>("phone");
  const {
    user,
    requiresPhoneVerification,
    verificationPhoneNumber,
    completeFirstTimeVerification,
    completePasswordChange,
    logout,
  } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { actor } = useAppActor(createActor);

  useEffect(() => {
    if (requiresPhoneVerification) {
      setPhoneConfirmation("");
      setTokenCode("");
      setVerificationStep("phone");
      setShowVerificationDialog(true);
    }
  }, [requiresPhoneVerification]);

  const passwordMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const isValid =
    currentPassword.length > 0 &&
    newPassword.length >= 10 &&
    newPassword === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !actor || !user) return;
    setIsSubmitting(true);
    try {
      const client = buildClient(actor);
      await client.changePassword(user.username, currentPassword, newPassword);
      await completePasswordChange();
      showToast("Password updated successfully", "success");
      setPhoneConfirmation("");
      setTokenCode("");
      setShowVerificationDialog(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to change password";
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePhoneVerification(e: React.FormEvent) {
    e.preventDefault();
    if (verificationStep === "phone") {
      const normalizedEntered = phoneConfirmation.trim().replace(/\s+/g, "");
      const normalizedExpected = verificationPhoneNumber
        .trim()
        .replace(/\s+/g, "");
      if (!normalizedEntered) return;
      if (!normalizedExpected) {
        showToast("Phone verification is not available for this account", "error");
        return;
      }
      if (normalizedEntered !== normalizedExpected) {
        showToast("That phone number does not match this account", "error");
        return;
      }
      setVerificationStep("token");
      return;
    }
    if (!phoneConfirmation.trim() || !tokenCode.trim()) return;
    setIsVerifying(true);
    try {
      await completeFirstTimeVerification(
        phoneConfirmation.trim(),
        tokenCode.trim(),
      );
      showToast("Phone verified successfully", "success");
      setShowVerificationDialog(false);
      navigate({ to: "/agm/dashboard", replace: true });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to verify phone";
      showToast(msg, "error");
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleReturnToLogin() {
    await logout();
    navigate({ to: "/agm/login", replace: true });
  }

  async function handleVerificationDialogChange(open: boolean) {
    if (open || isVerifying) return;
    setShowVerificationDialog(false);
    await handleReturnToLogin();
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden
      >
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {!showVerificationDialog && (
          <>
            <div className="mb-6 text-center sm:mb-8">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/20">
                <ShieldAlert className="h-7 w-7 text-accent" />
              </div>
              <h1 className="font-display text-xl font-bold text-foreground">
                Set Your Own Password
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a password you can remember, then complete one-time account verification.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-elevated sm:p-6">
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="current-password">Temporary Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="current-password"
                      type={showCurrent ? "text" : "password"}
                      placeholder="Enter the current temporary password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="min-h-[44px] pl-9 pr-10"
                      data-ocid="change_password.current.input"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showCurrent ? "Hide" : "Show"}
                    >
                      {showCurrent ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showNew ? "text" : "password"}
                      placeholder="Use letters, numbers, and at least 10 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="min-h-[44px] pl-9 pr-10"
                      data-ocid="change_password.new.input"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showNew ? "Hide" : "Show"}
                    >
                      {showNew ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Repeat the new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`min-h-[44px] pl-9 ${passwordMismatch ? "border-destructive" : ""}`}
                      data-ocid="change_password.confirm.input"
                      required
                    />
                  </div>
                  {passwordMismatch && (
                    <p
                      className="text-xs text-destructive"
                      data-ocid="change_password.mismatch.error_state"
                    >
                      Passwords do not match.
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="mt-2 min-h-[44px] w-full font-semibold"
                  disabled={!isValid || isSubmitting}
                  data-ocid="change_password.submit_button"
                >
                  {isSubmitting ? "Updating..." : "Update Password"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] w-full"
                  onClick={handleReturnToLogin}
                >
                  Return to Login
                </Button>
                <p className="text-xs text-muted-foreground">
                  Use at least 10 characters and include both letters and numbers.
                </p>
              </form>
            </div>
          </>
        )}

        <Dialog
          open={showVerificationDialog}
          onOpenChange={handleVerificationDialogChange}
        >
          <DialogContent
            className="overflow-hidden rounded-3xl border border-border bg-card p-0 shadow-[0_24px_80px_rgba(2,6,23,0.42)] sm:max-w-[380px]"
            showCloseButton={false}
            data-ocid="change_password.phone_verify_modal"
          >
            <div className="border-b border-border/70 bg-gradient-to-br from-primary/8 via-background to-background px-5 py-4 text-center">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                  <Smartphone className="h-5 w-5" />
                </span>
                <DialogClose
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close verification"
                >
                  <X className="h-4 w-4" />
                </DialogClose>
              </div>
              <DialogHeader className="space-y-2 text-center">
                <DialogTitle className="font-display text-xl text-foreground">
                  {verificationStep === "phone"
                    ? "Verify your phone"
                    : "Enter verification code"}
                </DialogTitle>
                <DialogDescription className="text-sm leading-6 text-muted-foreground">
                  {verificationStep === "phone"
                    ? "Enter the phone number linked to this account to continue."
                    : "Enter the verification code to finish signing in."}
                </DialogDescription>
              </DialogHeader>
            </div>

            <form onSubmit={handlePhoneVerification} className="space-y-4 px-5 py-4">
              {verificationStep === "phone" ? (
                <div className="space-y-2">
                  <Label htmlFor="verified-phone">Phone number</Label>
                  <Input
                    id="verified-phone"
                    value={phoneConfirmation}
                    onChange={(e) => setPhoneConfirmation(e.target.value)}
                    placeholder="0241234567"
                    className="min-h-[48px]"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="verified-token">Verification code</Label>
                  <Input
                    id="verified-token"
                    value={tokenCode}
                    onChange={(e) => setTokenCode(e.target.value)}
                    placeholder="1234"
                    className="min-h-[48px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use code <span className="font-semibold text-foreground">1234</span> for now.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2 border-t border-border/70 pt-4">
                <Button
                  type="submit"
                  className="min-h-[48px] w-full"
                  disabled={
                    isVerifying ||
                    (verificationStep === "phone"
                      ? !phoneConfirmation.trim()
                      : !tokenCode.trim())
                  }
                >
                  {verificationStep === "phone"
                    ? "Send code to this number"
                    : isVerifying
                      ? "Verifying..."
                      : "Verify and Continue"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-[42px] w-full text-muted-foreground"
                  onClick={
                    verificationStep === "token"
                      ? () => setVerificationStep("phone")
                      : handleReturnToLogin
                  }
                >
                  {verificationStep === "token"
                    ? "Back"
                    : "Return to Login"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

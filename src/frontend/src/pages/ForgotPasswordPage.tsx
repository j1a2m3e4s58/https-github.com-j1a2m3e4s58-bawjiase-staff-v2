import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequestPasswordReset } from "@/lib/backend-client";
import { isOk } from "@/types";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    try {
      const result = await apiRequestPasswordReset(email);
      if (isOk(result)) {
        setSent(true);
      } else {
        toast.error(result.err);
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthShell className="max-w-[450px] px-5 pb-8 pt-20">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center bg-secondary/15">
            <CheckCircle2 className="h-7 w-7 text-secondary" />
          </div>
          <div>
            <div className="page-kicker text-center">Reset requested</div>
            <h2 className="mb-1 mt-3 font-display text-xl font-bold text-foreground">
              Check Your Email
            </h2>
            <p className="text-sm text-muted-foreground">
              We&apos;ve sent a password reset link to{" "}
              <strong className="text-foreground">{email}</strong>
            </p>
          </div>
          <p className="text-xs text-muted-foreground max-w-xs">
            The link expires in 30 minutes. If you don&apos;t see it, check your
            spam folder.
          </p>
          <Link
            to="/login"
            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-smooth mt-2"
            data-ocid="forgot.back_to_login.link"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sign In
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell className="max-w-[450px] px-5 pb-8 pt-20">
      <div className="mb-8 space-y-3 text-center">
        <div className="page-kicker text-center">Account recovery</div>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Reset Password
        </h1>
        <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
          Enter your official email to receive a reset link
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        data-ocid="forgot.form"
      >
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Official Email Address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="you@bawjiasearearuralbank.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 glass-input pl-10"
              autoComplete="email"
              required
              data-ocid="forgot.email.input"
            />
          </div>
        </div>

        <Button
          type="submit"
          className="h-12 w-full glass-button text-sm font-bold uppercase tracking-[0.16em]"
          disabled={isLoading || !email}
          data-ocid="forgot.submit_button"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…
            </>
          ) : (
            "Send Reset Link"
          )}
        </Button>
      </form>

      <div className="mt-6 border-t border-border/40 pt-5 text-center">
        <Link
          to="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-smooth"
          data-ocid="forgot.back_to_login.link"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Sign In
        </Link>
      </div>
    </AuthShell>
  );
}

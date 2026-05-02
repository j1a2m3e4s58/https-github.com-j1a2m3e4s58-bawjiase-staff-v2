import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiResendCode, apiVerifyEmail } from "@/lib/backend-client";
import { isOk } from "@/types";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { email?: string };
  const email = search.email ?? "";

  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 6) return;
    setIsLoading(true);
    try {
      const result = await apiVerifyEmail(email, code);
      if (isOk(result)) {
        toast.success("Email verified! Please sign in.");
        navigate({ to: "/login" });
      } else {
        toast.error(result.err || "Invalid code. Please try again.");
      }
    } catch {
      toast.error("Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    if (!email) {
      toast.error("Email address is missing. Please re-register.");
      return;
    }
    setIsResending(true);
    try {
      const result = await apiResendCode(email);
      if (isOk(result)) {
        toast.success("New verification code sent!");
      } else {
        toast.error(result.err || "Could not resend code.");
      }
    } catch {
      toast.error("Failed to resend code.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <AuthShell className="max-w-[450px] px-5 pb-8 pt-20">
      <div className="mb-8 space-y-3 text-center">
        <div className="page-kicker text-center">Account verification</div>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Verify Your Email
        </h1>
        <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
          {email ? (
            <>
              We sent a 6-digit code to{" "}
              <span className="font-medium text-foreground">{email}</span>
            </>
          ) : (
            "Enter the 6-digit verification code from your email"
          )}
        </p>
      </div>

      <form
        onSubmit={handleVerify}
        className="space-y-4"
        data-ocid="verify_email.form"
      >
        <div className="space-y-1.5">
          <Label htmlFor="verify-code" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Verification Code
          </Label>
          <Input
            id="verify-code"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="glass-input h-14 text-center font-mono text-2xl tracking-[0.5em]"
            required
            data-ocid="verify_email.code.input"
          />
          <p className="text-xs text-muted-foreground text-center">
            Check your spam folder if you don&apos;t see it within 2 minutes
          </p>
        </div>

        <Button
          type="submit"
          className="h-12 w-full glass-button text-sm font-bold uppercase tracking-[0.16em]"
          disabled={isLoading || code.length < 6}
          data-ocid="verify_email.submit_button"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying…
            </>
          ) : (
            "Verify Email"
          )}
        </Button>
      </form>

      <div className="mt-6 border-t border-border/40 pt-5">
        <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          Didn&apos;t receive the code?{" "}
          <button
            type="button"
            className="text-primary font-medium hover:text-primary/80 transition-smooth disabled:opacity-50"
            onClick={handleResend}
            disabled={isResending}
            data-ocid="verify_email.resend.button"
          >
            {isResending ? "Sending…" : "Resend Code"}
          </button>
        </p>
        <Link
          to="/login"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-smooth"
          data-ocid="verify_email.back.link"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Sign In
        </Link>
        </div>
      </div>
    </AuthShell>
  );
}

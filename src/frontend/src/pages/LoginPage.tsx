import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hashPassword } from "@/lib/auth-crypto";
import { apiLogin } from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import { isOk } from "@/types";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    try {
      const result = await apiLogin(email, hashPassword(password));
      if (isOk(result)) {
        login(result.ok, rememberMe);
        toast.success(`Welcome back, ${result.ok.fullname.split(" ")[0]}!`);
        navigate({ to: "/" });
      } else {
        toast.error(result.err);
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell className="flex min-h-[520px] max-w-[420px] flex-col justify-center px-4 pb-6 pt-20 sm:px-5">
      <div className="mb-6 space-y-1.5 text-center">
        <div className="page-kicker text-center">Secure staff access</div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Staff Portal
        </h1>
        <p className="mx-auto max-w-[17rem] text-xs leading-5 text-muted-foreground">
          Sign in to manage communication, people records, and internal operations.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-3"
        data-ocid="login.form"
      >
        <div className="space-y-1">
          <Label
            htmlFor="email"
            className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            Official Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@bawjiasearearuralbank.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 glass-input text-sm"
            autoComplete="email"
            required
            data-ocid="login.email.input"
          />
        </div>

        <div className="space-y-1">
          <Label
            htmlFor="password"
            className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 glass-input pr-10 text-sm"
              autoComplete="current-password"
              required
              data-ocid="login.password.input"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-smooth hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              data-ocid="login.password_toggle.button"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(v) => setRememberMe(v === true)}
              data-ocid="login.remember_me.checkbox"
            />
            <Label htmlFor="remember" className="cursor-pointer text-muted-foreground">
              Remember me
            </Label>
          </div>
          <Link
            to="/forgot-password"
            className="shrink-0 text-muted-foreground transition-smooth hover:text-primary"
            data-ocid="login.forgot_password.link"
          >
            Forgot?
          </Link>
        </div>

        <Button
          type="submit"
          className="h-10 w-full glass-button text-sm font-bold uppercase tracking-[0.16em]"
          disabled={isLoading || !email || !password}
          data-ocid="login.submit_button"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Signing in...
            </>
          ) : (
            "Secure Login"
          )}
        </Button>
      </form>

      <div className="mt-3 border-t border-border/40 pt-3 text-center">
        <p className="text-sm text-muted-foreground">
          New Staff?{" "}
          <Link
            to="/register"
            className="font-medium text-primary transition-smooth hover:text-primary/80"
            data-ocid="login.register.link"
          >
            Sign Up
          </Link>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Authorized Access Only
        </p>
      </div>
    </AuthShell>
  );
}

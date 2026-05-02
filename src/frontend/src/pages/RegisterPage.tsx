import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hashPassword } from "@/lib/auth-crypto";
import { apiRegister, apiResendCode } from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import { BRANCHES, DEPARTMENTS, isOk } from "@/types";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<"form" | "verify">("form");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [fullname, setFullname] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [showAccessDialog, setShowAccessDialog] = useState(false);

  const needsAccessCode = department === "IT" || department === "HR";
  const passwordRules = [
    { label: "8+ Characters", valid: password.length >= 8 },
    { label: "Uppercase (A-Z)", valid: /[A-Z]/.test(password) },
    { label: "Small Letters (a-z)", valid: /[a-z]/.test(password) },
    { label: "Number/Symbol @1", valid: /[\d\W_]/.test(password) },
  ];
  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;
  const passwordsMismatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password !== confirmPassword;

  async function submitRegistration(code?: string) {
    if (!email.endsWith("@bawjiasearearuralbank.com")) {
      toast.error("Please use your official @bawjiasearearuralbank.com email");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (needsAccessCode && !code) {
      setShowAccessDialog(true);
      return;
    }
    setIsLoading(true);
    try {
      const result = await apiRegister({
        fullname,
        phone,
        email,
        passwordHash: hashPassword(password),
        role: "GeneralStaff",
        position: "Staff",
        department,
        branch,
        accessCode: needsAccessCode ? code : undefined,
      });

      if (isOk(result)) {
        setShowAccessDialog(false);
        setStep("verify");
        toast.success(
          "Registration submitted! Check your email for verification code.",
        );
      } else {
        toast.error(result.err);
      }
    } catch {
      toast.error("Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (needsAccessCode) {
      if (password !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }
      setShowAccessDialog(true);
      return;
    }
    await submitRegistration();
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (verifyCode.length < 6) {
      toast.error("Please enter the 6-digit code from your email.");
      return;
    }
    setIsLoading(true);
    try {
      const loginResult = await import("@/lib/backend-client").then((m) =>
        m.apiVerifyEmail(email, verifyCode),
      );
      if (isOk(loginResult)) {
        const userResult = await import("@/lib/backend-client").then((m) =>
          m.apiLogin(email, hashPassword(password)),
        );
        if (isOk(userResult)) {
          login(userResult.ok, true);
          toast.success(
            `Welcome to BCB Staff Portal, ${userResult.ok.fullname.split(" ")[0]}!`,
          );
          navigate({ to: "/" });
        }
      } else {
        toast.error("Invalid verification code. Please try again.");
      }
    } catch {
      toast.error("Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendCode() {
    if (!email) return;
    setIsLoading(true);
    try {
      const result = await apiResendCode(email);
      if (isOk(result)) {
        toast.success("New verification code sent.");
      } else {
        toast.error(result.err);
      }
    } catch {
      toast.error("Failed to resend code.");
    } finally {
      setIsLoading(false);
    }
  }

  if (step === "verify") {
    return (
      <AuthShell>
        <div className="mb-6 space-y-1 text-center">
          <h1 className="font-display font-bold text-2xl text-foreground">
            Verify Your Email
          </h1>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to <strong>{email}</strong>
          </p>
        </div>
        <form
          onSubmit={handleVerify}
          className="space-y-4"
          data-ocid="verify.form"
        >
          <div className="space-y-1.5">
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              className="h-14 glass-input text-center font-mono text-xl tracking-widest"
              required
              data-ocid="verify.code.input"
            />
          </div>
          <Button
            type="submit"
            className="h-11 w-full glass-button font-semibold"
            disabled={isLoading || verifyCode.length < 6}
            data-ocid="verify.submit_button"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
              </>
            ) : (
              "Verify & Sign In"
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Didn&apos;t get the code?{" "}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={handleResendCode}
              data-ocid="verify.resend.button"
            >
              Resend
            </button>
          </p>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell className="flex min-h-[560px] max-w-[450px] flex-col justify-center px-4 pb-5 pt-20 sm:px-5">
      <div className="mb-3 space-y-0.5 text-center">
        <h1 className="font-display font-bold text-xl text-foreground">
          Staff Registration
        </h1>
        <p className="text-xs text-muted-foreground">
          Create your secure account
        </p>
      </div>

      <form
        onSubmit={handleRegister}
        className="space-y-2"
        data-ocid="register.form"
      >
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 space-y-1">
            <Label
              htmlFor="fullname"
              className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              Full Name
            </Label>
            <Input
              id="fullname"
              placeholder="John Mensah"
              value={fullname}
              onChange={(e) => setFullname(e.target.value)}
              className="h-9 rounded-lg glass-input"
              required
              data-ocid="register.fullname.input"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label
              htmlFor="phone"
              className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="024 XXX XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-9 rounded-lg glass-input"
              required
              data-ocid="register.phone.input"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label
            htmlFor="reg-email"
            className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            Official Email
          </Label>
          <Input
            id="reg-email"
            type="email"
            placeholder="you@bawjiasearearuralbank.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 rounded-lg glass-input"
            autoComplete="email"
            required
            data-ocid="register.email.input"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 space-y-1">
            <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Branch
            </Label>
            <Select value={branch} onValueChange={setBranch} required>
              <SelectTrigger
                className="h-9 w-full rounded-lg glass-input"
                data-ocid="register.branch.select"
              >
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent
                align="start"
                className="max-h-44"
                side="bottom"
                sideOffset={4}
              >
                {BRANCHES.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Department
            </Label>
            <Select value={department} onValueChange={setDepartment} required>
              <SelectTrigger
                className="h-9 w-full rounded-lg glass-input"
                data-ocid="register.department.select"
              >
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent
                align="start"
                className="max-h-44"
                side="bottom"
                sideOffset={4}
              >
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 space-y-1">
            <Label
              htmlFor="reg-password"
              className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              Password
            </Label>
            <div className="relative">
              <Input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 rounded-lg glass-input pr-10"
                autoComplete="new-password"
                minLength={8}
                required
                data-ocid="register.password.input"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-smooth hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide" : "Show"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <div className="min-w-0 space-y-1">
            <Label
              htmlFor="confirm-password"
              className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              Confirm
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="Repeat Pass"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-9 rounded-lg glass-input pr-10"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-smooth hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide" : "Show"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div
          className={
            passwordsMatch
              ? "h-5 rounded-md bg-secondary/20 px-3 py-1 text-center text-[9px] font-bold uppercase tracking-widest text-secondary"
              : passwordsMismatch
                ? "h-5 rounded-md bg-destructive/15 px-3 py-1 text-center text-[9px] font-bold uppercase tracking-widest text-destructive"
                : "h-5 px-3 py-1 text-center text-[9px] font-bold uppercase tracking-widest text-transparent"
          }
        >
          {passwordsMatch
            ? "Passwords Match"
            : passwordsMismatch
              ? "Passwords Do Not Match"
              : "Password Status"}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 rounded-lg border border-border/70 bg-muted/20 px-2 py-1.5 text-[9px] font-medium">
          {passwordRules.map((rule) => {
            const Icon = rule.valid ? CheckCircle2 : XCircle;
            return (
              <span
                key={rule.label}
                className={
                  rule.valid
                    ? "flex items-center gap-1 text-secondary"
                    : "flex items-center gap-1 text-destructive"
                }
              >
                <Icon className="h-3 w-3 shrink-0" />
                {rule.label}
              </span>
            );
          })}
        </div>

        <Button
          type="submit"
          className="mt-2 h-10 w-full rounded-xl glass-button text-sm font-bold uppercase tracking-wide"
          disabled={
            isLoading ||
            !email ||
            !password ||
            !confirmPassword ||
            !department ||
            !branch ||
            !fullname ||
            !phone ||
            password !== confirmPassword
          }
          data-ocid="register.submit_button"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating
              Account...
            </>
          ) : (
            "Create Account"
          )}
        </Button>
      </form>

      <div className="mt-2 text-center text-sm text-muted-foreground">
        <Link
          to="/login"
          className="font-medium transition-smooth hover:text-primary"
          data-ocid="register.login.link"
        >
          Back to Login
        </Link>
      </div>

      <Dialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
        <DialogContent
          className="overflow-hidden border-primary/30 p-0 glass-card-elevated sm:max-w-[300px]"
          showCloseButton={false}
        >
          <div className="flex items-center justify-between bg-secondary px-4 py-4 text-secondary-foreground">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <LockKeyhole className="h-5 w-5" />
              Security Verification
            </DialogTitle>
            <button
              type="button"
              className="rounded-md p-1 text-secondary-foreground/80 transition-smooth hover:bg-background/15 hover:text-secondary-foreground"
              onClick={() => setShowAccessDialog(false)}
              aria-label="Close security verification"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 px-6 pb-6 pt-5 text-center">
            <DialogDescription className="space-y-4 text-sm leading-6 text-foreground">
              <span className="block">
                You have selected a restricted department{" "}
                <strong>({department})</strong>.
              </span>
              <span className="block">
                Please enter the Department Access Code to proceed.
              </span>
            </DialogDescription>

            <Input
              autoFocus
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Enter Access Code"
              className="h-11 rounded-lg glass-input text-center text-base"
              data-ocid="register.access_code.dialog_input"
            />

            <Button
              type="button"
              className="h-11 w-full rounded-lg glass-button font-bold"
              disabled={isLoading || !accessCode}
              onClick={() => submitRegistration(accessCode)}
              data-ocid="register.access_code.verify_button"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Register"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AuthShell>
  );
}

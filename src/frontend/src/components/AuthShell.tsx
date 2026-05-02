import { ThemeToggle } from "@/components/ThemeToggle";
import { withBase } from "@/lib/app-base";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function BCBLogoBadge() {
  return (
    <div className="flex flex-col items-center" data-ocid="auth.bcb_badge">
      <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-background bg-background shadow-glass ring-4 ring-primary/20">
        <img
          src={withBase("assets/images/bcb-logo.png")}
          alt="Bawjiase Community Bank logo"
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}

interface AuthShellProps {
  children: ReactNode;
  className?: string;
}

export function AuthShell({ children, className }: AuthShellProps) {
  return (
    <div
      className="relative h-screen overflow-hidden bg-background"
      data-ocid="auth_shell"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <img
          src={withBase("assets/images/auth-bg.jpg")}
          alt=""
          className="h-full w-full scale-105 object-cover blur-[5px]"
        />
        <div className="absolute inset-0 bg-background/45 dark:bg-background/65" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background/10 to-secondary/15" />
      </div>

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative flex h-full items-center justify-center overflow-hidden px-4 pb-8 pt-16 sm:px-6 sm:pb-10 sm:pt-20">
        <div
          className={cn(
            "relative w-full max-w-md panel-sharp-lg glass-card-elevated overflow-visible px-6 pb-8 pt-24 shadow-glass-dark",
            className,
          )}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
            <BCBLogoBadge />
          </div>
          {children}
        </div>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
}

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
      className="h-screen bg-background relative overflow-hidden"
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

      <div className="relative flex h-full items-center justify-center px-4 py-8">
        <div
          className={cn(
            "relative mt-12 w-full max-w-md rounded-2xl glass-card-elevated px-6 pb-6 pt-20 shadow-glass-dark",
            className,
          )}
        >
          <div className="absolute -top-12 left-1/2 -translate-x-1/2">
            <BCBLogoBadge />
          </div>
          {children}
        </div>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
}

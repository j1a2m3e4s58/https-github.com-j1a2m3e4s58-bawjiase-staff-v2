import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PortalCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  action?: ReactNode;
  "data-ocid"?: string;
}

export function PortalCard({
  title,
  subtitle,
  children,
  className,
  elevated = false,
  action,
  "data-ocid": ocid,
}: PortalCardProps) {
  return (
    <div
      className={cn(
        "panel-sharp p-5 transition-smooth",
        elevated ? "glass-card-elevated" : "glass-card",
        className,
      )}
      data-ocid={ocid}
    >
      {(title || action) && (
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-border/30 pb-4">
          <div className="min-w-0">
            {title && (
              <h3 className="font-display text-lg font-semibold leading-tight text-foreground">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {action && <div className="ml-3 flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

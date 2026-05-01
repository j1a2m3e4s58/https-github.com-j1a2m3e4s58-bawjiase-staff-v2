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
        "rounded-xl p-5 transition-smooth",
        elevated ? "glass-card-elevated" : "glass-card",
        className,
      )}
      data-ocid={ocid}
    >
      {(title || action) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && (
              <h3 className="font-display font-semibold text-foreground text-base leading-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="ml-3 flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

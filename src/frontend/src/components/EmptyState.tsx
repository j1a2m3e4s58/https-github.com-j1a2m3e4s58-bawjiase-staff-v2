import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  "data-ocid"?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  "data-ocid": ocid,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "surface-muted flex min-h-[240px] flex-col items-center justify-center px-6 py-16 text-center",
        className,
      )}
      data-ocid={ocid}
    >
      {icon && (
        <div className="mb-5 flex h-16 w-16 items-center justify-center border border-border/40 bg-primary/8 text-primary shadow-sm transition-smooth">
          {icon}
        </div>
      )}
      <h3 className="mb-2 font-display text-xl font-semibold text-foreground">
        {title}
      </h3>
      {description && (
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button
          className="mt-6 min-w-40"
          onClick={onAction}
          data-ocid="empty_state.primary_button"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

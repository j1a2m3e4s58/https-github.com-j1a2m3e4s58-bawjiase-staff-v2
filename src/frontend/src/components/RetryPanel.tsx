import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

export function RetryPanel({
  title,
  description,
  onRetry,
  icon,
  compact = false,
}: {
  title: string;
  description: string;
  onRetry: () => void;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`surface-muted ${
        compact ? "p-4" : "p-5"
      } transition-smooth`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {icon}
            <span>{title}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 self-start"
          onClick={onRetry}
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    </div>
  );
}

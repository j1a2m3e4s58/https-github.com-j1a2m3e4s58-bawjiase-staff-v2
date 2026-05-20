import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function LoadingSpinner({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-8 text-center",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex h-12 w-12 items-center justify-center border border-border bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

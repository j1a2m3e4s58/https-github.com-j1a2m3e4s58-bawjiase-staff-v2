import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  lines?: number;
  hasAvatar?: boolean;
  hasImage?: boolean;
  className?: string;
}

export function SkeletonCard({
  lines = 3,
  hasAvatar = false,
  hasImage = false,
  className,
}: SkeletonCardProps) {
  return (
    <div
      className={cn("glass-card rounded-xl p-5 space-y-3", className)}
      data-ocid="skeleton.card"
    >
      {hasImage && <Skeleton className="h-40 w-full rounded-lg" />}
      {hasAvatar && (
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      )}
      {Array.from({ length: lines }, (_, i) => `sk-${i}`).map((key, i) => (
        <Skeleton
          key={key}
          className={cn(
            "h-3",
            i === 0 && "w-full",
            i === 1 && "w-4/5",
            i === 2 && "w-2/3",
            i >= 3 && "w-3/5",
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center gap-4 py-3 px-4", className)}
      data-ocid="skeleton.row"
    >
      <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-7 w-16 rounded-md" />
    </div>
  );
}

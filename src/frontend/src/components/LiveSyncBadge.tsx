import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_EVENTS = ["bcb:users-updated"];

function formatRelativeSync(lastSyncedAt: number) {
  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - lastSyncedAt) / 1000),
  );
  if (diffSeconds < 5) return "Updated just now";
  if (diffSeconds < 60) return `Updated ${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`;
  return `Updated at ${new Date(lastSyncedAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function LiveSyncBadge({
  eventNames = DEFAULT_EVENTS,
  className,
}: {
  eventNames?: string[];
  className?: string;
}) {
  const [lastSyncedAt, setLastSyncedAt] = useState(() => Date.now());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const markSynced = () => setLastSyncedAt(Date.now());
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        markSynced();
      }
    };

    markSynced();
    eventNames.forEach((eventName) =>
      window.addEventListener(eventName, markSynced),
    );
    window.addEventListener("focus", markSynced);
    window.addEventListener("online", markSynced);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      eventNames.forEach((eventName) =>
        window.removeEventListener(eventName, markSynced),
      );
      window.removeEventListener("focus", markSynced);
      window.removeEventListener("online", markSynced);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [eventNames]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTick((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const relativeText = useMemo(() => {
    void tick;
    return formatRelativeSync(lastSyncedAt);
  }, [lastSyncedAt, tick]);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <RefreshCw className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      <span className="font-semibold text-emerald-700 dark:text-emerald-300">
        Live sync active
      </span>
      <Badge
        variant="outline"
        className="border-emerald-500/20 bg-background/70 text-[10px] font-medium text-muted-foreground"
      >
        {relativeText}
      </Badge>
    </div>
  );
}

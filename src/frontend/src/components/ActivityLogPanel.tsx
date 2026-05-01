import {
  ActivityLogEntry,
  apiClearActivityLog,
  apiGetActivityLog,
} from "@/lib/backend-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const ACTIVITY_LOG_UPDATED_EVENT = "bcb:activity-log-updated";

function formatTime(timestamp: number) {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return "Just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  return new Date(timestamp).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityLogPanel() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>(() =>
    apiGetActivityLog(),
  );

  useEffect(() => {
    const handleUpdate = () => setEntries(apiGetActivityLog());
    window.addEventListener(ACTIVITY_LOG_UPDATED_EVENT, handleUpdate);
    return () =>
      window.removeEventListener(ACTIVITY_LOG_UPDATED_EVENT, handleUpdate);
  }, []);

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Recent Activity
          </h2>
          <p className="text-sm text-muted-foreground">
            The latest admin actions recorded on this browser.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            apiClearActivityLog();
            setEntries([]);
          }}
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
          Actions like profile updates, staff assignments, uploads, and cleanup
          will appear here.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.slice(0, 6).map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-border/50 bg-background/40 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {entry.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.detail}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {formatTime(entry.timestamp)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

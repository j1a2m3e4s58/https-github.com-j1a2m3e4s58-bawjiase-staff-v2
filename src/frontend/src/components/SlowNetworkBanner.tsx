import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

const REQUEST_ACTIVITY_EVENT = "bcb:request-activity";

export function SlowNetworkBanner() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [showSlow, setShowSlow] = useState(false);

  useEffect(() => {
    let hideTimer: number | null = null;

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      setShowSlow(false);
    };
    const handleActivity = (event: Event) => {
      const detail = (event as CustomEvent<{ kind: string }>).detail;
      if (detail?.kind === "slow") {
        setShowSlow(true);
        if (hideTimer) window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(() => {
          setShowSlow(false);
        }, 5000);
      }
      if (detail?.kind === "finish") {
        setShowSlow(false);
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener(REQUEST_ACTIVITY_EVENT, handleActivity as EventListener);

    return () => {
      if (hideTimer) window.clearTimeout(hideTimer);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener(
        REQUEST_ACTIVITY_EVENT,
        handleActivity as EventListener,
      );
    };
  }, []);

  if (!isOffline && !showSlow) return null;

  return (
      <div className="panel-sharp sticky top-0 z-50 mx-4 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-950 shadow-sm dark:text-amber-200">
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium">
          {isOffline
            ? "You are offline. The portal will reconnect automatically."
            : "Your connection is slow. The portal is retrying in the background."}
        </span>
      </div>
    </div>
  );
}

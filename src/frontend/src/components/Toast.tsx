import { useToast } from "@/context/ToastContext";
import type { ToastType } from "@/context/ToastContext";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";

const ICON: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-primary" />,
  error: <AlertCircle className="h-5 w-5 text-destructive" />,
  warning: <AlertTriangle className="h-5 w-5 text-accent" />,
  info: <Info className="h-5 w-5 text-muted-foreground" />,
};

const BAR_CLASS: Record<ToastType, string> = {
  success: "bg-primary",
  error: "bg-destructive",
  warning: "bg-accent",
  info: "bg-muted-foreground",
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  return (
    <div
      aria-live="polite"
      className="fixed right-4 top-4 z-50 flex w-80 max-w-[90vw] flex-col gap-2"
      data-ocid="toast"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="toast-shell sea-shell surface-highlight relative overflow-hidden border border-border bg-card shadow-lg"
        >
          <div
            className={`absolute bottom-0 left-0 top-0 w-1 ${BAR_CLASS[toast.type]}`}
          />
          <div className="flex items-start gap-3 px-4 py-3 pl-5">
            <span className="mt-0.5 flex-shrink-0">{ICON[toast.type]}</span>
            <p className="min-w-0 flex-1 break-words text-sm leading-snug text-foreground">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="flex-shrink-0 rounded p-1 transition-colors hover:bg-muted"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

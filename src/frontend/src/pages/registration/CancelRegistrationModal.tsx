import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/context/ToastContext";
import { useCancelRegistration } from "@/hooks/use-backend";
import type { Registration, Shareholder } from "@/types";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CancelRegistrationModalProps {
  registration: Registration;
  shareholder: Shareholder;
  onClose: () => void;
  onSuccess: () => void;
}

export function CancelRegistrationModal({
  registration,
  shareholder,
  onClose,
  onSuccess,
}: CancelRegistrationModalProps) {
  const { showToast } = useToast();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const cancel = useCancelRegistration();
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Focus reason field on open
  useEffect(() => {
    setTimeout(() => reasonRef.current?.focus(), 50);
  }, []);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setReasonError("Cancellation reason is required");
      return;
    }
    setServerError(null);
    try {
      await cancel.mutateAsync({ id: registration.id, reason: reason.trim() });
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setServerError(msg || "Failed to cancel registration");
      showToast("Cancellation failed", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-ocid="registration.cancel.dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        role="button"
        tabIndex={0}
        aria-label="Close dialog"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Enter" && onClose()}
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-destructive/30 bg-card shadow-2xl"
        aria-label="Cancel registration"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground">
                Cancel Registration
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {shareholder.fullName}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-ocid="registration.cancel.close_button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive/90">
              This will cancel the registration for{" "}
              <strong>{shareholder.fullName}</strong> (#{" "}
              {shareholder.shareholderNumber}). This action is recorded in the
              audit log.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">
              Reason for Cancellation{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              ref={reasonRef}
              id="cancel-reason"
              data-ocid="registration.cancel.reason_textarea"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError(null);
              }}
              placeholder="Enter the reason for cancelling this registration…"
              rows={3}
              className="resize-none"
            />
            {reasonError && (
              <p
                className="text-xs text-destructive"
                data-ocid="registration.cancel.reason.field_error"
              >
                {reasonError}
              </p>
            )}
          </div>

          {serverError && (
            <div
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3"
              data-ocid="registration.cancel.error_state"
            >
              <p className="text-sm text-destructive">{serverError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-border">
          <Button
            type="button"
            variant="outline"
            data-ocid="registration.cancel.cancel_button"
            onClick={onClose}
            className="flex-1 h-11"
          >
            Keep Registration
          </Button>
          <Button
            type="button"
            variant="destructive"
            data-ocid="registration.cancel.confirm_button"
            disabled={cancel.isPending}
            onClick={handleConfirm}
            className="flex-1 h-11"
          >
            {cancel.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelling…
              </>
            ) : (
              "Confirm Cancellation"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

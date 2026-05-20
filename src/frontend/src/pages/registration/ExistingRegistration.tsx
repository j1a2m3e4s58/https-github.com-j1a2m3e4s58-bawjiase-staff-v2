import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/context/ToastContext";
import { useUpdateRegistration } from "@/hooks/use-backend";
import { cn } from "@/lib/utils";
import { RegistrationType } from "@/types";
import type { Registration, Shareholder } from "@/types";
import {
  AlertCircle,
  Edit2,
  Loader2,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";

interface ExistingRegistrationProps {
  registration: Registration;
  shareholder: Shareholder;
  canEdit: boolean;
  onCancelClick: () => void;
  onEditSuccess: (reg: Registration) => void;
}

function formatDate(ns: bigint): string {
  return new Date(Number(ns) / 1_000_000).toLocaleString();
}

export function ExistingRegistration({
  registration,
  shareholder,
  canEdit,
  onCancelClick,
  onEditSuccess,
}: ExistingRegistrationProps) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(registration.notes ?? "");
  const [serverError, setServerError] = useState<string | null>(null);
  const update = useUpdateRegistration();

  const isProxy = registration.registrationType === RegistrationType.Proxy;

  const handleSave = async () => {
    setServerError(null);
    try {
      const result = await update.mutateAsync({
        id: registration.id,
        updates: { notes: notes || undefined },
      });
      showToast("Registration updated", "success");
      setEditing(false);
      onEditSuccess(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setServerError(msg || "Failed to update registration");
      showToast("Update failed", "error");
    }
  };

  return (
    <div className="space-y-5" data-ocid="registration.existing_reg">
      {/* Warning banner */}
      <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-4 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-300">
            Already Registered
          </p>
          <p className="text-xs text-amber-300/70 mt-0.5">
            This shareholder is already registered. Review the details below.
          </p>
        </div>
      </div>

      {/* Shareholder + status */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-foreground">
              {shareholder.fullName}
            </h3>
            <p className="text-sm text-muted-foreground">
              # {shareholder.shareholderNumber}
            </p>
          </div>
          <StatusBadge status={shareholder.status} />
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          {[
            ["Registration Type", isProxy ? "Proxy" : "In Person"],
            ["Verification Code", registration.verificationCode],
            ["Registered At", formatDate(registration.registeredAt)],
            ["Registered By", registration.registeredBy],
            ...(isProxy && registration.proxyName
              ? [["Proxy Name", registration.proxyName]]
              : []),
            ...(isProxy && registration.proxyContact
              ? [["Proxy Contact", registration.proxyContact]]
              : []),
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium text-foreground font-mono text-xs leading-relaxed">
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Proxy fraud flags */}
        {isProxy && registration.proxyFraudFlags.length > 0 && (
          <div className="mt-2 rounded-lg border border-amber-800/40 bg-amber-950/20 p-3">
            <div className="flex items-center gap-1.5 text-amber-400 mb-2">
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">Fraud Flags</span>
            </div>
            <ul className="space-y-1">
              {registration.proxyFraudFlags.map((flag) => (
                <li key={flag} className="text-xs text-amber-300/80">
                  • {flag}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes section */}
        <div className="mt-2">
          {editing ? (
            <div className="space-y-2">
              <Label htmlFor="edit-notes" className="text-sm">
                Notes
              </Label>
              <Textarea
                id="edit-notes"
                data-ocid="registration.edit_notes_textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
              {serverError && (
                <div
                  className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2"
                  data-ocid="registration.edit.error_state"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{serverError}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  data-ocid="registration.edit_save_button"
                  size="sm"
                  disabled={update.isPending}
                  onClick={handleSave}
                  className="h-9"
                >
                  {update.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
                <Button
                  type="button"
                  data-ocid="registration.edit_cancel_button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setNotes(registration.notes ?? "");
                    setServerError(null);
                  }}
                  className="h-9"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            registration.notes && (
              <div className="rounded-lg bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
                <p className="text-sm text-foreground">{registration.notes}</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Actions */}
      {canEdit && (
        <div
          className={cn(
            "flex gap-3",
            isProxy ? "flex-col sm:flex-row" : "flex-row",
          )}
        >
          {!editing && (
            <Button
              type="button"
              variant="outline"
              data-ocid="registration.edit_button"
              onClick={() => setEditing(true)}
              className="flex-1 h-11"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Notes
            </Button>
          )}
          <Button
            type="button"
            variant="destructive"
            data-ocid="registration.cancel_reg_button"
            onClick={onCancelClick}
            className="flex-1 h-11"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Cancel Registration
          </Button>
        </div>
      )}

      {/* Proxy validated state */}
      {isProxy && (
        <div
          className={cn(
            "flex gap-2 rounded-lg border px-4 py-3",
            registration.proxyProofValidated
              ? "border-primary/30 bg-primary/10"
              : "border-border bg-muted/30",
          )}
          data-ocid="registration.proxy_validation_state"
        >
          <Users className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Proof:{" "}
            {registration.proxyProofValidated ? (
              <span className="text-primary font-medium">Validated ✓</span>
            ) : (
              <span className="text-amber-400">Not yet validated</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

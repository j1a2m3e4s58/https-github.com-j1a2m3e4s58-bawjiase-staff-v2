import { QrCodeImage } from "@/components/QrCodeImage";
import { Button } from "@/components/ui/button";
import { parseRegistrationNotes } from "@/pages/registration/registration-form-utils";
import type { Registration, Shareholder } from "@/types";
import { RegistrationType } from "@/types";
import { CheckCircle2, Printer, RotateCcw, Users } from "lucide-react";

interface SuccessCardProps {
  registration: Registration;
  shareholder: Shareholder;
  onRegisterAnother: () => void;
}

export function SuccessCard({
  registration,
  shareholder,
  onRegisterAnother,
}: SuccessCardProps) {
  const isProxy = registration.registrationType === RegistrationType.Proxy;
  const isQueued = registration.id.startsWith("queued-");
  const parsedNotes = parseRegistrationNotes(registration.notes);
  const agmYear = parsedNotes["AGM Year"] ?? "";
  const contactNumber =
    parsedNotes["Contact Number"] ?? parsedNotes["Telephone Number"] ?? "";

  return (
    <div className="space-y-5" data-ocid="registration.success_card">
      {/* Header */}
      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-7 h-7 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-bold text-primary mb-1">
          Registered!
        </h2>
        <p className="text-muted-foreground">
          {shareholder.fullName} has been successfully registered{" "}
          {isProxy ? "via proxy" : "in person"} and checked in automatically.
        </p>
        {isQueued && (
          <p className="text-xs text-primary mt-2">
            This registration is queued locally and will sync automatically
            when the backend is reachable again.
          </p>
        )}
      </div>

      {/* Details */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Registration Details
        </h3>
        <div className="space-y-2">
          {[
            ["Shareholder", shareholder.fullName],
            ["Shareholder #", shareholder.shareholderNumber],
            ...(agmYear ? [["AGM Year", agmYear]] : []),
            ["Type", isProxy ? "Proxy" : "In Person"],
            ...(!isProxy && contactNumber
              ? [["Contact", contactNumber]]
              : []),
            ...(isProxy && registration.proxyName
              ? [["Proxy Name", registration.proxyName]]
              : []),
            ...(isProxy && registration.proxyContact
              ? [["Proxy Contact", registration.proxyContact]]
              : []),
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Verification code + QR */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-1">
              {isQueued ? "Queued Verification Code" : "Verification Code"}
          </p>
          {agmYear && (
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              AGM {agmYear}
            </p>
          )}
            <p
              className="font-mono text-lg sm:text-xl font-bold text-primary tracking-[0.16em] break-all"
              data-ocid="registration.success_verification_code"
            >
              {registration.verificationCode}
            </p>
          </div>
          <div className="flex justify-center sm:justify-end">
            <QrCodeImage
              value={registration.verificationCode}
              size={120}
              className="rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          data-ocid="registration.print_badge_button"
          onClick={() => window.print()}
          className="flex-1 h-11"
        >
          <Printer className="w-4 h-4 mr-2" />
          Print Badge
        </Button>
        <Button
          type="button"
          data-ocid="registration.register_another_button"
          onClick={onRegisterAnother}
          className="flex-1 h-11"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Register Another
        </Button>
      </div>

      {isProxy && (
        <div className="flex gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <Users className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Proxy registration complete. Ensure the proxy representative
            presents valid identification at the AGM.
          </p>
        </div>
      )}
    </div>
  );
}

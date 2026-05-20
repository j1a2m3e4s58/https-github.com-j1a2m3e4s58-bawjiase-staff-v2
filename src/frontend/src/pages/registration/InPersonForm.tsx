import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/context/ToastContext";
import { useAgmYear } from "@/context/AgmYearContext";
import {
  CheckInMethod,
  useCheckInShareholder,
  useRegisterShareholder,
  useUpdateRegistration,
} from "@/hooks/use-backend";
import { RegistrationType } from "@/types";
import type { Registration, Shareholder } from "@/types";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  buildRegistrationNotes,
  getDefaultAgmYear,
  normalizePhone,
  validateGhanaCardId,
  validateGhanaPhone,
} from "./registration-form-utils";

interface InPersonFormProps {
  shareholder: Shareholder;
  onSuccess: (reg: Registration) => void;
}

interface FormErrors {
  phone?: string;
  ghanaCardId?: string;
  ghanaCardVerification?: string;
  chitNumber?: string;
  consent?: string;
}

export function InPersonForm({ shareholder, onSuccess }: InPersonFormProps) {
  const { showToast } = useToast();
  const { activeYear } = useAgmYear();
  const register = useRegisterShareholder();
  const updateRegistration = useUpdateRegistration();
  const checkIn = useCheckInShareholder();

  const [agmYear, setAgmYear] = useState(() => activeYear || getDefaultAgmYear());

  const [phone, setPhone] = useState("");
  const [ghanaCardId, setGhanaCardId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [chitNumber, setChitNumber] = useState("");
  const [timeOfCheckIn, setTimeOfCheckIn] = useState(() =>
    new Date().toLocaleString(),
  );
  const [consentChecked, setConsentChecked] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setAgmYear(activeYear || getDefaultAgmYear());
    setTimeOfCheckIn(new Date().toLocaleString());
    setPhone("");
    setGhanaCardId("");
    setVerificationCode("");
    setChitNumber(shareholder.shareholderNumber);
    setConsentChecked(false);
    setErrors({});
    setServerError(null);
  }, [activeYear, shareholder.id, shareholder.shareholderNumber]);

  function validate() {
    const nextErrors: FormErrors = {};
    const normalizedPhone = normalizePhone(phone);
    const trimmedCard = ghanaCardId.trim().toUpperCase();

    if (!normalizedPhone) {
      nextErrors.phone = "Enter the shareholder's contact number";
    } else if (!validateGhanaPhone(normalizedPhone)) {
      nextErrors.phone = "Enter a valid Ghana contact number";
    }

    if (!trimmedCard) {
      nextErrors.ghanaCardId = "Enter the Ghana Card number";
    } else if (!validateGhanaCardId(trimmedCard)) {
      nextErrors.ghanaCardId = "Use the format GHA-123456789-1";
    }

    if (!verificationCode.trim()) {
      nextErrors.ghanaCardVerification =
        "Enter the verification code";
    }

    if (!chitNumber.trim()) {
      nextErrors.chitNumber = "Enter the member number";
    }

    if (!consentChecked) {
      nextErrors.consent = "Please confirm before completing registration";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    const registrationNotes = buildRegistrationNotes([
      ["AGM Year", agmYear],
      ["Attendance Type", "In Person"],
      ["Shareholder Name", shareholder.fullName],
      ["Contact Number", normalizePhone(phone)],
      ["Ghana Card ID Number", ghanaCardId.trim().toUpperCase()],
      ["Verification Code", verificationCode.trim()],
      ["Chit Number", chitNumber.trim()],
      ["Automatic Check-In Time", timeOfCheckIn],
      ["Consent Accepted", "Yes"],
    ]);

    try {
      const result = await register.mutateAsync({
        shareholderId: shareholder.id,
        regType: RegistrationType.InPerson,
        proxyData: null,
      });

      const updated = await updateRegistration.mutateAsync({
        id: result.id,
        updates: { notes: registrationNotes },
      });

      await checkIn.mutateAsync({
        shareholderId: shareholder.id,
        registrationId: updated.id,
        method: CheckInMethod.Manual,
      });

      showToast("Registration and automatic check-in completed.", "success");
      onSuccess(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("REGISTRATION_IN_PROGRESS")) {
        setServerError(
          "Another officer is registering this shareholder. Please wait a moment and try again.",
        );
      } else if (msg.includes("ALREADY_REGISTERED")) {
        setServerError("This shareholder is already registered.");
      } else {
        setServerError(msg || "Registration failed. Please try again.");
      }
      showToast("Registration could not be completed", "error");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
      data-ocid="registration.inperson_form"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>AGM Year</Label>
          <Input
            value={agmYear}
            readOnly
            className="bg-muted/40"
            data-ocid="registration.inperson.agm_year_display"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Automatic Check-In Time</Label>
          <Input value={timeOfCheckIn} readOnly className="bg-muted/40" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Shareholder Name</Label>
        <Input value={shareholder.fullName} readOnly className="bg-muted/40" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inperson-phone">
          Contact Number <span className="text-destructive">*</span>
        </Label>
        <Input
          id="inperson-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0241234567"
          data-ocid="registration.inperson.phone_input"
        />
        {errors.phone && (
          <p className="text-xs text-destructive">{errors.phone}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="inperson-ghana-card">
            Ghana Card ID Number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="inperson-ghana-card"
            value={ghanaCardId}
            onChange={(e) => setGhanaCardId(e.target.value.toUpperCase())}
            placeholder="GHA-123456789-1"
            data-ocid="registration.inperson.ghana_card_input"
          />
          {errors.ghanaCardId && (
            <p className="text-xs text-destructive">{errors.ghanaCardId}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inperson-ghana-card-verification">
            Verification Code{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="inperson-ghana-card-verification"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="Enter verified code"
            data-ocid="registration.inperson.ghana_card_verification_input"
          />
          {errors.ghanaCardVerification && (
            <p className="text-xs text-destructive">
              {errors.ghanaCardVerification}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inperson-chit-number">
          Chit Number <span className="text-destructive">*</span>
        </Label>
        <Input
          id="inperson-chit-number"
          value={chitNumber}
          onChange={(e) => setChitNumber(e.target.value)}
          placeholder="396355"
          data-ocid="registration.inperson.chit_number_input"
        />
        <p className="text-xs text-muted-foreground">
          Auto-filled from the uploaded member list.
        </p>
        {errors.chitNumber && (
          <p className="text-xs text-destructive">{errors.chitNumber}</p>
        )}
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
        <input
          type="checkbox"
          checked={consentChecked}
          onChange={(e) => setConsentChecked(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[var(--primary)]"
          data-ocid="registration.inperson.consent_checkbox"
        />
        <div>
          <p className="text-sm font-medium text-foreground">
            Signature / Consent
          </p>
          <p className="text-xs text-muted-foreground">
            I confirm that the details entered above are correct and approved
            for registration.
          </p>
          {errors.consent && (
            <p className="text-xs text-destructive mt-1">{errors.consent}</p>
          )}
        </div>
      </label>

      {serverError && (
        <div
          className="flex gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3"
          data-ocid="registration.error_state"
        >
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{serverError}</p>
        </div>
      )}

      <Button
        type="submit"
        data-ocid="registration.inperson_submit_button"
        disabled={register.isPending || updateRegistration.isPending || checkIn.isPending}
        className="w-full h-12 text-base font-semibold"
      >
        {register.isPending || updateRegistration.isPending || checkIn.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Completing registration...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Register and Check In
          </>
        )}
      </Button>
    </form>
  );
}

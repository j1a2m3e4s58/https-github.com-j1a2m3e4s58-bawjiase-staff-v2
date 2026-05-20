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
  useValidateProxyProof,
} from "@/hooks/use-backend";
import { cn } from "@/lib/utils";
import { RegistrationType } from "@/types";
import type { Registration, Shareholder } from "@/types";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  buildRegistrationNotes,
  getDefaultAgmYear,
  normalizePhone,
  validateGhanaCardId,
  validateGhanaPhone,
} from "./registration-form-utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function createThumbnailDataUrl(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const maxSide = 960;
      const scale = Math.min(maxSide / image.width, maxSide / image.height, 1);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      URL.revokeObjectURL(objectUrl);
      resolve(dataUrl);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    image.src = objectUrl;
  });
}

function detectFraudFlags(file: File): string[] {
  const flags: string[] = [];
  if (file.size < 1024) {
    flags.push("File too small — may not be a real document");
  }
  if (file.size > MAX_FILE_SIZE) {
    flags.push("File exceeds 10 MB limit");
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    flags.push(`Unsupported format: ${file.type || "unknown"}`);
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (
    (file.type === "application/pdf" && ext !== "pdf") ||
    (file.type.startsWith("image/") &&
      !["jpg", "jpeg", "png", "webp"].includes(ext ?? ""))
  ) {
    flags.push("File extension does not match content type");
  }
  return flags;
}

interface ProxyFormProps {
  shareholder: Shareholder;
  onSuccess: (reg: Registration) => void;
}

interface FormErrors {
  shareholderContact?: string;
  proxyName?: string;
  proxyContact?: string;
  proxyGhanaCardId?: string;
  proxyGhanaCardVerification?: string;
  chitNumber?: string;
  proofFile?: string;
  consent?: string;
}

export function ProxyForm({ shareholder, onSuccess }: ProxyFormProps) {
  const { showToast } = useToast();
  const { activeYear } = useAgmYear();
  const register = useRegisterShareholder();
  const validateProxyProof = useValidateProxyProof();
  const updateRegistration = useUpdateRegistration();
  const checkIn = useCheckInShareholder();

  const [agmYear, setAgmYear] = useState(() => activeYear || getDefaultAgmYear());

  const [shareholderContact, setShareholderContact] = useState("");
  const [proxyName, setProxyName] = useState("");
  const [proxyContact, setProxyContact] = useState("");
  const [proxyGhanaCardId, setProxyGhanaCardId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [chitNumber, setChitNumber] = useState("");
  const [timeOfCheckIn, setTimeOfCheckIn] = useState(() =>
    new Date().toLocaleString(),
  );
  const [consentChecked, setConsentChecked] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [proofThumbnail, setProofThumbnail] = useState("");
  const [fraudFlags, setFraudFlags] = useState<string[]>([]);
  const [validated, setValidated] = useState(false);
  const [validatedAt, setValidatedAt] = useState<number | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAgmYear(activeYear || getDefaultAgmYear());
    setTimeOfCheckIn(new Date().toLocaleString());
    setShareholderContact("");
    setProxyName("");
    setProxyContact("");
    setProxyGhanaCardId("");
    setVerificationCode("");
    setChitNumber(shareholder.shareholderNumber);
    setConsentChecked(false);
    setProofFile(null);
    setPreviewUrl(null);
    setProofThumbnail("");
    setFraudFlags([]);
    setValidated(false);
    setValidatedAt(null);
    setErrors({});
    setServerError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [activeYear, shareholder.id, shareholder.shareholderNumber]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setProofFile(file);
    setProofThumbnail("");
    setValidated(false);
    setValidatedAt(null);
    setFraudFlags([]);
    setErrors((prev) => ({ ...prev, proofFile: undefined }));

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
      void createThumbnailDataUrl(file).then((thumbnail) => {
        if (thumbnail) setProofThumbnail(thumbnail);
      });
    } else {
      setPreviewUrl(null);
    }
  };

  const handleRemoveFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setProofFile(null);
    setPreviewUrl(null);
    setProofThumbnail("");
    setFraudFlags([]);
    setValidated(false);
    setValidatedAt(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleValidate = async () => {
    if (!proofFile) {
      setErrors((prev) => ({
        ...prev,
        proofFile: "Please upload a proof document first",
      }));
      return;
    }
    setValidating(true);
    const flags = detectFraudFlags(proofFile);
    setFraudFlags(flags);
    setValidated(true);
    setValidatedAt(Date.now());
    setValidating(false);
    if (flags.length === 0) {
      showToast("Proxy proof validated — no issues found", "success");
    } else {
      showToast(`${flags.length} fraud flag(s) detected`, "warning");
    }
  };

  function validate() {
    const nextErrors: FormErrors = {};
    const normalizedShareholderContact = normalizePhone(shareholderContact);
    const normalizedProxyContact = normalizePhone(proxyContact);
    const trimmedProxyCard = proxyGhanaCardId.trim().toUpperCase();

    if (!normalizedShareholderContact) {
      nextErrors.shareholderContact = "Enter the shareholder's contact number";
    } else if (!validateGhanaPhone(normalizedShareholderContact)) {
      nextErrors.shareholderContact = "Enter a valid Ghana contact number";
    }

    if (!proxyName.trim()) {
      nextErrors.proxyName = "Enter the proxy's full name";
    }

    if (!normalizedProxyContact) {
      nextErrors.proxyContact = "Enter the proxy's contact number";
    } else if (!validateGhanaPhone(normalizedProxyContact)) {
      nextErrors.proxyContact = "Enter a valid Ghana contact number";
    }

    if (!trimmedProxyCard) {
      nextErrors.proxyGhanaCardId = "Enter the proxy's Ghana Card number";
    } else if (!validateGhanaCardId(trimmedProxyCard)) {
      nextErrors.proxyGhanaCardId = "Use the format GHA-123456789-1";
    }

    if (!verificationCode.trim()) {
      nextErrors.proxyGhanaCardVerification =
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
    if (!validate()) return;
    setServerError(null);

    const proofStorageKey = proofFile
      ? `proof_${shareholder.id}_${Date.now()}_${proofFile.name}`
      : undefined;

    const registrationNotes = buildRegistrationNotes([
      ["AGM Year", agmYear],
      ["Attendance Type", "Proxy"],
      ["Shareholder Name", shareholder.fullName],
      ["Shareholder Contact Number", normalizePhone(shareholderContact)],
      ["Name of Proxy", proxyName.trim()],
      ["Proxy Contact Number", normalizePhone(proxyContact)],
      ["Proxy Ghana Card ID Number", proxyGhanaCardId.trim().toUpperCase()],
      ["Verification Code", verificationCode.trim()],
      ["Chit Number", chitNumber.trim()],
      ["Automatic Check-In Time", timeOfCheckIn],
      ["Proof File", proofFile?.name ?? "Not uploaded"],
      ...(proofThumbnail
        ? ([["Proof Preview", proofThumbnail]] as [string, string][])
        : []),
      ["Consent Accepted", "Yes"],
    ]);

    try {
      const result = await register.mutateAsync({
        shareholderId: shareholder.id,
        regType: RegistrationType.Proxy,
        proxyData: {
          proxyName: proxyName.trim(),
          proxyContact: normalizePhone(proxyContact),
          proxyProofKey: proofStorageKey,
        },
      });

      const [updatedRegistration, reviewedRegistration] = await Promise.all([
        updateRegistration.mutateAsync({
          id: result.id,
          updates: {
            proxyData: {
              proxyName: proxyName.trim(),
              proxyContact: normalizePhone(proxyContact),
              proxyProofKey: proofStorageKey,
            },
            notes: registrationNotes,
          },
        }),
        proofFile
          ? validateProxyProof.mutateAsync({
              registrationId: result.id,
              validated: fraudFlags.length === 0,
              fraudFlags,
            })
          : Promise.resolve<Registration | null>(null),
      ]);

      await checkIn.mutateAsync({
        shareholderId: shareholder.id,
        registrationId: updatedRegistration.id,
        method: CheckInMethod.Manual,
      });

      showToast("Proxy registration and automatic check-in completed.", "success");
      onSuccess(reviewedRegistration ?? updatedRegistration);
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
      showToast("Proxy registration could not be completed", "error");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
      data-ocid="registration.proxy_form"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>AGM Year</Label>
          <Input
            value={agmYear}
            readOnly
            className="bg-muted/40"
            data-ocid="registration.proxy.agm_year_display"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Automatic Check-In Time</Label>
          <Input value={timeOfCheckIn} readOnly className="bg-muted/40" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Proxy Nomination Document</Label>
        {!proofFile ? (
          <button
            type="button"
            data-ocid="registration.proof_dropzone"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "w-full border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-smooth",
              errors.proofFile
                ? "border-destructive/60 bg-destructive/5"
                : "border-border hover:border-primary/50 hover:bg-primary/5",
            )}
          >
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">
              Upload supporting document
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Optional. PDF, JPEG, PNG, or WEBP up to 10 MB.
            </p>
          </button>
        ) : (
          <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Proof preview"
                  className="w-full max-h-48 object-contain bg-muted/20"
                />
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="absolute top-2 right-2 w-8 h-8 bg-background/90 border border-border flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {proofFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(proofFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={handleFileChange}
          className="hidden"
          data-ocid="registration.proof_upload_button"
        />
        {errors.proofFile && (
          <p className="text-xs text-destructive">{errors.proofFile}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Name of Shareholder</Label>
        <Input value={shareholder.fullName} readOnly className="bg-muted/40" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="proxy-shareholder-contact">
          Shareholder Contact Number <span className="text-destructive">*</span>
        </Label>
        <Input
          id="proxy-shareholder-contact"
          value={shareholderContact}
          onChange={(e) => setShareholderContact(e.target.value)}
          placeholder="0241234567"
          data-ocid="registration.proxy.shareholder_contact_input"
        />
        {errors.shareholderContact && (
          <p className="text-xs text-destructive">
            {errors.shareholderContact}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="proxy-name">
            Proxy Full Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="proxy-name"
            value={proxyName}
            onChange={(e) => setProxyName(e.target.value)}
            placeholder="Enter proxy full name"
            data-ocid="registration.proxy_name_input"
          />
          {errors.proxyName && (
            <p className="text-xs text-destructive">{errors.proxyName}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proxy-contact">
            Proxy Contact Number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="proxy-contact"
            value={proxyContact}
            onChange={(e) => setProxyContact(e.target.value)}
            placeholder="0241234567"
            data-ocid="registration.proxy_contact_input"
          />
          {errors.proxyContact && (
            <p className="text-xs text-destructive">{errors.proxyContact}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="proxy-ghana-card">
            Proxy Ghana Card ID Number{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="proxy-ghana-card"
            value={proxyGhanaCardId}
            onChange={(e) => setProxyGhanaCardId(e.target.value.toUpperCase())}
            placeholder="GHA-123456789-1"
            data-ocid="registration.proxy.ghana_card_input"
          />
          {errors.proxyGhanaCardId && (
            <p className="text-xs text-destructive">
              {errors.proxyGhanaCardId}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proxy-ghana-card-verification">
            Verification Code{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="proxy-ghana-card-verification"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="Enter verified code"
            data-ocid="registration.proxy.ghana_card_verification_input"
          />
          {errors.proxyGhanaCardVerification && (
            <p className="text-xs text-destructive">
              {errors.proxyGhanaCardVerification}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="proxy-chit-number">
          Chit Number <span className="text-destructive">*</span>
        </Label>
        <Input
          id="proxy-chit-number"
          value={chitNumber}
          onChange={(e) => setChitNumber(e.target.value)}
          placeholder="396355"
          data-ocid="registration.proxy.chit_number_input"
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
          data-ocid="registration.proxy.consent_checkbox"
        />
        <div>
          <p className="text-sm font-medium text-foreground">
            Signature / Consent
          </p>
          <p className="text-xs text-muted-foreground">
            I confirm that the proxy details entered above are correct and
            approved for registration.
          </p>
          {errors.consent && (
            <p className="text-xs text-destructive mt-1">{errors.consent}</p>
          )}
        </div>
      </label>

      {fraudFlags.length > 0 && (
        <div
          className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-4 space-y-2"
          data-ocid="registration.fraud_flags"
        >
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-semibold">
              {fraudFlags.length} Review Issue(s) Detected
            </span>
          </div>
          <ul className="space-y-1">
            {fraudFlags.map((flag) => (
              <li key={flag} className="text-xs text-amber-300/80">
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {validated && fraudFlags.length === 0 && (
        <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-primary">
            Supporting document reviewed successfully.
          </p>
        </div>
      )}

      {validatedAt && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Document reviewed locally at {new Date(validatedAt).toLocaleString()}.
        </div>
      )}

      {proofFile && (
        <Button
          type="button"
          variant="outline"
          onClick={handleValidate}
          disabled={validating}
          className="w-full h-11"
          data-ocid="registration.validate_proof_button"
        >
          {validating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Validating…
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Review Supporting Document
            </>
          )}
        </Button>
      )}

      {serverError && (
        <div
          className="flex gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3"
          data-ocid="registration.proxy.error_state"
        >
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{serverError}</p>
        </div>
      )}

      <Button
        type="submit"
        data-ocid="registration.proxy_submit_button"
        disabled={
          register.isPending ||
          validateProxyProof.isPending ||
          updateRegistration.isPending ||
          checkIn.isPending
        }
        className="w-full h-12 text-base font-semibold"
      >
        {register.isPending ||
        validateProxyProof.isPending ||
        updateRegistration.isPending ||
        checkIn.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Completing registration...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Register Proxy and Check In
          </>
        )}
      </Button>
    </form>
  );
}

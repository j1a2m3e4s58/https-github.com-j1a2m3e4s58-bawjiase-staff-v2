import { AgmLayout } from "@/components/AgmLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgmYear } from "@/context/AgmYearContext";
import {
  AGM_UPDATED_EVENT,
  apiCheckInAgmShareholder,
  apiGetAgmShareholders,
  apiRegisterAgmShareholder,
} from "@/lib/backend-client";
import { type AgmShareholderRecord } from "@/lib/agm-module";
import {
  buildRegistrationNotes,
  normalizePhone,
  validateGhanaCardId,
  validateGhanaPhone,
} from "@/lib/agm-registration-utils";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock3, Search, Upload } from "lucide-react";
import { useAuth } from "@/store/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type RegistrationMode = "in-person" | "proxy";

interface FormErrors {
  phone?: string;
  ghanaCardId?: string;
  verificationCode?: string;
  chitNumber?: string;
  consent?: string;
  proxyName?: string;
  proxyPhone?: string;
  proxyGhanaCardId?: string;
}

function formatDeskTimestamp() {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function statusLabel(record: AgmShareholderRecord) {
  if (record.checkedInAt) return "Checked In";
  if (record.registrationType !== "Not Registered") return "Registered";
  return "Not Registered";
}

function statusClasses(record: AgmShareholderRecord) {
  if (record.checkedInAt) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (record.registrationType !== "Not Registered") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-300";
  }
  return "border-border/60 bg-background/40 text-muted-foreground";
}

function ShareholderListItem({
  shareholder,
  selected,
  onSelect,
}: {
  shareholder: AgmShareholderRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full border-b border-border/50 px-4 py-4 text-left transition-smooth last:border-b-0",
        selected ? "bg-primary/30" : "hover:bg-muted/20",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="font-semibold text-foreground">{shareholder.fullName}</div>
          <div className="text-sm text-muted-foreground">
            # {shareholder.shareholderNumber}
          </div>
          <div className="text-sm text-muted-foreground">
            {shareholder.shareholding.toLocaleString()} shares
          </div>
          {selected ? (
            <div className="pt-1 text-xs text-primary">
              Completing current registration...
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge
            variant="outline"
            className={cn("h-7 border text-xs font-medium", statusClasses(shareholder))}
          >
            <Clock3 className="h-3 w-3" />
            {statusLabel(shareholder)}
          </Badge>
          <span className="inline-flex h-10 items-center border border-primary/60 bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Register
          </span>
        </div>
      </div>
    </button>
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export default function AgmRegistrationPage() {
  const { activeYear, setActiveYear, yearOptions } = useAgmYear();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [shareholders, setShareholders] = useState<AgmShareholderRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<RegistrationMode>("in-person");
  const [phone, setPhone] = useState("");
  const [ghanaCardId, setGhanaCardId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [chitNumber, setChitNumber] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [proxyName, setProxyName] = useState("");
  const [proxyPhone, setProxyPhone] = useState("");
  const [proxyGhanaCardId, setProxyGhanaCardId] = useState("");
  const [proxyDocumentName, setProxyDocumentName] = useState("");
  const [autoCheckInTime, setAutoCheckInTime] = useState(formatDeskTimestamp);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const proxyDocumentRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const load = () => {
      void apiGetAgmShareholders().then((records) => {
        setShareholders(records);
      });
    };
    load();
    window.addEventListener(AGM_UPDATED_EVENT, load);
    return () => window.removeEventListener(AGM_UPDATED_EVENT, load);
  }, [activeYear]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return shareholders;
    return shareholders.filter((item) =>
      [
        item.fullName,
        item.shareholderNumber,
        item.ghanaCardId,
        item.phone,
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [query, shareholders]);

  useEffect(() => {
    if (!filtered.find((item) => item.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  const selected =
    filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  function resetForm(shareholder?: AgmShareholderRecord | null) {
    setMode(shareholder?.registrationType === "Proxy" ? "proxy" : "in-person");
    setPhone(shareholder?.phone ?? "");
    setGhanaCardId(shareholder?.ghanaCardId ?? "");
    setVerificationCode(shareholder?.verificationCode ?? "");
    setChitNumber(shareholder?.shareholderNumber ?? "");
    setConsentChecked(false);
    setProxyName(shareholder?.proxyName ?? "");
    setProxyPhone(shareholder?.proxyPhone ?? shareholder?.phone ?? "");
    setProxyGhanaCardId("");
    setProxyDocumentName("");
    setAutoCheckInTime(formatDeskTimestamp());
    setErrors({});
  }

  useEffect(() => {
    if (selected) {
      resetForm(selected);
    }
  }, [selectedId]);

  function validateForm() {
    const nextErrors: FormErrors = {};
    const normalizedPhone = normalizePhone(phone);
    const trimmedCard = ghanaCardId.trim().toUpperCase();

    if (!normalizedPhone) {
      nextErrors.phone = "Enter the shareholder contact number.";
    } else if (!validateGhanaPhone(normalizedPhone)) {
      nextErrors.phone = "Use a valid Ghana phone number.";
    }

    if (!trimmedCard) {
      nextErrors.ghanaCardId = "Enter the Ghana Card ID number.";
    } else if (!validateGhanaCardId(trimmedCard)) {
      nextErrors.ghanaCardId = "Use the format GHA-123456789-1.";
    }

    if (!verificationCode.trim()) {
      nextErrors.verificationCode = "Enter the verification code.";
    }

    if (!chitNumber.trim()) {
      nextErrors.chitNumber = "Enter the chit number.";
    }

    if (!consentChecked) {
      nextErrors.consent = "You must confirm the registration details.";
    }

    if (mode === "proxy") {
      if (!proxyName.trim()) {
        nextErrors.proxyName = "Enter the proxy full name.";
      }
      const normalizedProxyPhone = normalizePhone(proxyPhone);
      if (!normalizedProxyPhone) {
        nextErrors.proxyPhone = "Enter the proxy contact number.";
      } else if (!validateGhanaPhone(normalizedProxyPhone)) {
        nextErrors.proxyPhone = "Use a valid Ghana phone number.";
      }
      if (!proxyGhanaCardId.trim()) {
        nextErrors.proxyGhanaCardId = "Enter the proxy Ghana Card ID number.";
      } else if (!validateGhanaCardId(proxyGhanaCardId.trim().toUpperCase())) {
        nextErrors.proxyGhanaCardId = "Use the format GHA-123456789-1.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (!validateForm()) {
      toast.error("Please fix the AGM registration fields and try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      const updated = await apiRegisterAgmShareholder({
        shareholderId: selected.id,
        mode,
        phone: normalizePhone(phone),
        ghanaCardId: ghanaCardId.trim().toUpperCase(),
        verificationCode: verificationCode.trim(),
        chitNumber: chitNumber.trim(),
        operatorName: user?.fullname ?? "AGM Operator",
        proxyName: mode === "proxy" ? proxyName.trim() : undefined,
        proxyPhone: mode === "proxy" ? normalizePhone(proxyPhone) : undefined,
      });

      const checkedIn = await apiCheckInAgmShareholder({
        shareholderId: updated.id,
        operatorName: user?.fullname ?? "AGM Operator",
        method: "manual",
      });

      const notes = buildRegistrationNotes([
        ["AGM Year", activeYear],
        ["Attendance Type", mode === "proxy" ? "Proxy" : "In Person"],
        ["Shareholder Name", checkedIn.fullName],
        ["Verification Code", verificationCode.trim()],
        ["Chit Number", chitNumber.trim()],
        ["Auto Check-In Time", autoCheckInTime],
      ]);

      setShareholders((current) =>
        current.map((item) => (item.id === checkedIn.id ? checkedIn : item)),
      );
      setSelectedId(checkedIn.id);
      toast.success(
        mode === "proxy"
          ? "Proxy registration and check-in completed."
          : "Registration and check-in completed.",
      );
      resetForm(checkedIn);
      setConsentChecked(false);
      void notes;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The AGM registration could not be completed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AgmLayout>
      <div className="page-shell space-y-5" data-ocid="agm.registration.page">
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="panel-sharp border border-border/60 bg-card/90">
            <div className="border-b border-border/50 px-5 py-5">
              <h1 className="font-display text-3xl font-bold text-foreground">
                Find Shareholder
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Registration list for AGM year {activeYear}
              </p>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  AGM Year
                </Label>
                <select
                  value={activeYear}
                  onChange={(event) => setActiveYear(event.target.value)}
                  className="h-12 w-[84px] border border-border/60 bg-background px-3 text-lg font-semibold text-foreground outline-none transition-smooth focus:border-primary"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name, shareholder #, or ID..."
                  className="h-12 border-border/60 bg-background pl-11"
                />
              </div>

              <p className="text-sm text-muted-foreground">
                Showing {filtered.length.toLocaleString()} of{" "}
                {shareholders.length.toLocaleString()} results. Search still covers all names.
              </p>
            </div>

            <div className="max-h-[980px] overflow-y-auto border-t border-border/50">
              {filtered.map((shareholder) => (
                <ShareholderListItem
                  key={shareholder.id}
                  shareholder={shareholder}
                  selected={selected?.id === shareholder.id}
                  onSelect={() => setSelectedId(shareholder.id)}
                />
              ))}
              {filtered.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No shareholders matched this search.
                </div>
              ) : null}
            </div>
          </section>

          <section className="panel-sharp border border-border/60 bg-card/90 px-6 py-6">
            {!selected ? (
              <div className="flex min-h-[420px] items-center justify-center text-muted-foreground">
                Select a shareholder to continue registration.
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="font-display text-4xl font-bold uppercase tracking-tight text-foreground">
                      {selected.fullName}
                    </h2>
                    <p className="mt-2 text-2xl text-foreground">
                      # {selected.shareholderNumber} <span className="text-muted-foreground">- {selected.shareholding.toLocaleString()} shares</span>
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("h-11 border px-4 text-xl font-medium", statusClasses(selected))}
                  >
                    <Clock3 className="h-4 w-4" />
                    {statusLabel(selected)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 border border-border/60 bg-background">
                  <button
                    type="button"
                    onClick={() => setMode("in-person")}
                    className={cn(
                      "h-14 text-lg font-medium transition-smooth",
                      mode === "in-person"
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted/30",
                    )}
                  >
                    In Person
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("proxy")}
                    className={cn(
                      "h-14 border-l border-border/60 text-lg font-medium transition-smooth",
                      mode === "proxy"
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted/30",
                    )}
                  >
                    Proxy
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>AGM Year</Label>
                    <Input value={activeYear} readOnly className="h-12 border-border/60 bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label>Automatic Check-In Time</Label>
                    <Input value={autoCheckInTime} readOnly className="h-12 border-border/60 bg-background" />
                  </div>
                </div>

                {mode === "proxy" ? (
                  <>
                    <div className="space-y-2">
                      <Label>Proxy Nomination Document</Label>
                      <input
                        ref={proxyDocumentRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        className="hidden"
                        onChange={(event) => {
                          setProxyDocumentName(event.target.files?.[0]?.name ?? "");
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => proxyDocumentRef.current?.click()}
                        className="flex min-h-[148px] w-full flex-col items-center justify-center gap-3 border border-dashed border-border/60 bg-background px-6 py-8 text-center transition-smooth hover:border-primary/50"
                      >
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <div className="text-2xl font-semibold text-foreground">
                          {proxyDocumentName || "Upload supporting document"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Optional. PDF, JPEG, PNG, or WEBP up to 10 MB.
                        </div>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <Label>Name of Shareholder</Label>
                      <Input value={selected.fullName} readOnly className="h-12 border-border/60 bg-background" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shareholder-phone">Shareholder Contact Number *</Label>
                      <Input
                        id="shareholder-phone"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        className="h-12 border-border/60 bg-background"
                        placeholder="0241234567"
                      />
                      <ErrorText message={errors.phone} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="proxy-name">Proxy Full Name *</Label>
                        <Input
                          id="proxy-name"
                          value={proxyName}
                          onChange={(event) => setProxyName(event.target.value)}
                          className="h-12 border-border/60 bg-background"
                          placeholder="Enter proxy full name"
                        />
                        <ErrorText message={errors.proxyName} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="proxy-phone">Proxy Contact Number *</Label>
                        <Input
                          id="proxy-phone"
                          value={proxyPhone}
                          onChange={(event) => setProxyPhone(event.target.value)}
                          className="h-12 border-border/60 bg-background"
                          placeholder="0241234567"
                        />
                        <ErrorText message={errors.proxyPhone} />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="proxy-card">Proxy Ghana Card ID Number *</Label>
                        <Input
                          id="proxy-card"
                          value={proxyGhanaCardId}
                          onChange={(event) =>
                            setProxyGhanaCardId(event.target.value.toUpperCase())
                          }
                          className="h-12 border-border/60 bg-background"
                          placeholder="GHA-123456789-1"
                        />
                        <ErrorText message={errors.proxyGhanaCardId} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="verification-code-proxy">Verification Code *</Label>
                        <Input
                          id="verification-code-proxy"
                          value={verificationCode}
                          onChange={(event) => setVerificationCode(event.target.value)}
                          className="h-12 border-border/60 bg-background"
                          placeholder="Enter verified code"
                        />
                        <ErrorText message={errors.verificationCode} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Shareholder Name</Label>
                      <Input value={selected.fullName} readOnly className="h-12 border-border/60 bg-background" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact-number">Contact Number *</Label>
                      <Input
                        id="contact-number"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        className="h-12 border-border/60 bg-background"
                        placeholder="0241234567"
                      />
                      <ErrorText message={errors.phone} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="ghana-card">Ghana Card ID Number *</Label>
                        <Input
                          id="ghana-card"
                          value={ghanaCardId}
                          onChange={(event) => setGhanaCardId(event.target.value.toUpperCase())}
                          className="h-12 border-border/60 bg-background"
                          placeholder="GHA-123456789-1"
                        />
                        <ErrorText message={errors.ghanaCardId} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="verification-code">Verification Code *</Label>
                        <Input
                          id="verification-code"
                          value={verificationCode}
                          onChange={(event) => setVerificationCode(event.target.value)}
                          className="h-12 border-border/60 bg-background"
                          placeholder="Enter verified code"
                        />
                        <ErrorText message={errors.verificationCode} />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="chit-number">Chit Number *</Label>
                  <Input
                    id="chit-number"
                    value={chitNumber}
                    onChange={(event) => setChitNumber(event.target.value)}
                    className="h-12 border-border/60 bg-background"
                  />
                  <p className="text-sm text-muted-foreground">
                    Auto-filled from the uploaded member list.
                  </p>
                  <ErrorText message={errors.chitNumber} />
                </div>

                <label className="flex items-start gap-4 border border-border/60 bg-background px-4 py-5">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(event) => setConsentChecked(event.target.checked)}
                    className="mt-1 h-5 w-5"
                  />
                  <div>
                    <div className="text-xl font-semibold text-foreground">
                      Signature / Consent
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {mode === "proxy"
                        ? "I confirm that the proxy details entered above are correct and approved for registration."
                        : "I confirm that the details entered above are correct and approved for registration."}
                    </p>
                  </div>
                </label>
                <ErrorText message={errors.consent} />

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-14 w-full text-xl font-semibold"
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  {isSubmitting
                    ? "Saving..."
                    : mode === "proxy"
                      ? "Register Proxy and Check In"
                      : "Register and Check In"}
                </Button>
              </form>
            )}
          </section>
        </div>
      </div>
    </AgmLayout>
  );
}

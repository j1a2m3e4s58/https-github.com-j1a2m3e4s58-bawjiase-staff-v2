import { AgmSubnav } from "@/components/AgmSubnav";
import { AppShell } from "@/components/AppShell";
import { PortalCard } from "@/components/PortalCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgmYear } from "@/context/AgmYearContext";
import {
  AGM_UPDATED_EVENT,
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
import {
  CheckCircle2,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type RegistrationMode = "in-person" | "proxy";

interface RegistrationSuccess {
  shareholderName: string;
  mode: RegistrationMode;
  verificationCode: string;
  notes: string;
}

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
      className={`w-full border-b border-border/30 px-4 py-3 text-left transition-smooth last:border-b-0 ${
        selected
          ? "bg-primary/15 border-l-2 border-l-primary"
          : "hover:bg-muted/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{shareholder.fullName}</div>
          <div className="text-sm text-muted-foreground">
            #{shareholder.shareholderNumber}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {shareholder.branch} • {shareholder.shareholding.toLocaleString()} shares
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          Ready
        </Badge>
      </div>
    </button>
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export default function AgmRegistrationPage() {
  const { activeYear } = useAgmYear();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [shareholders, setShareholders] = useState<AgmShareholderRecord[]>([]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return shareholders;
    return shareholders.filter((item) =>
      [
        item.fullName,
        item.shareholderNumber,
        item.branch,
        item.ghanaCardId,
        ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [query, shareholders]);

  useEffect(() => {
    const load = () => {
      void apiGetAgmShareholders().then((records) =>
        setShareholders(
          records.filter((record) => record.registrationType === "Not Registered"),
        ),
      );
    };
    load();
    window.addEventListener(AGM_UPDATED_EVENT, load);
    return () => {
      window.removeEventListener(AGM_UPDATED_EVENT, load);
    };
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(
    filtered[0]?.id ?? null,
  );
  const selected =
    filtered.find((item) => item.id === selectedId) ??
    filtered[0] ??
    null;

  const [mode, setMode] = useState<RegistrationMode>("in-person");
  const [phone, setPhone] = useState("");
  const [ghanaCardId, setGhanaCardId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [chitNumber, setChitNumber] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [proxyName, setProxyName] = useState("");
  const [proxyPhone, setProxyPhone] = useState("");
  const [proxyGhanaCardId, setProxyGhanaCardId] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState<RegistrationSuccess | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!filtered.find((item) => item.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  function resetForm(shareholder?: AgmShareholderRecord | null) {
    setMode("in-person");
    setPhone(shareholder?.phone ?? "");
    setGhanaCardId(shareholder?.ghanaCardId ?? "");
    setVerificationCode("");
    setChitNumber(shareholder?.shareholderNumber ?? "");
    setConsentChecked(false);
    setProxyName("");
    setProxyPhone("");
    setProxyGhanaCardId("");
    setErrors({});
    setSuccess(null);
  }

  function handleSelectShareholder(shareholder: AgmShareholderRecord) {
    setSelectedId(shareholder.id);
    resetForm(shareholder);
  }

  function validateForm(): boolean {
    const nextErrors: FormErrors = {};
    const normalizedPhone = normalizePhone(phone);
    const trimmedCard = ghanaCardId.trim().toUpperCase();

    if (!normalizedPhone) {
      nextErrors.phone = "Enter the shareholder contact number.";
    } else if (!validateGhanaPhone(normalizedPhone)) {
      nextErrors.phone = "Use a valid Ghana phone number.";
    }

    if (!trimmedCard) {
      nextErrors.ghanaCardId = "Enter the Ghana Card number.";
    } else if (!validateGhanaCardId(trimmedCard)) {
      nextErrors.ghanaCardId = "Use the format GHA-123456789-1.";
    }

    if (!verificationCode.trim()) {
      nextErrors.verificationCode = "Enter the verification code.";
    }

    if (!chitNumber.trim()) {
      nextErrors.chitNumber = "Enter the member number.";
    }

    if (!consentChecked) {
      nextErrors.consent = "You must confirm the registration details.";
    }

    if (mode === "proxy") {
      if (!proxyName.trim()) {
        nextErrors.proxyName = "Enter the proxy representative name.";
      }
      if (!normalizePhone(proxyPhone)) {
        nextErrors.proxyPhone = "Enter the proxy contact number.";
      } else if (!validateGhanaPhone(normalizePhone(proxyPhone))) {
        nextErrors.proxyPhone = "Use a valid Ghana phone number.";
      }
      if (!proxyGhanaCardId.trim()) {
        nextErrors.proxyGhanaCardId = "Enter the proxy Ghana Card number.";
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
      toast.error("Please fix the highlighted AGM registration fields.");
      return;
    }

    setIsSubmitting(true);

    const notes = buildRegistrationNotes([
      ["AGM Year", activeYear],
      ["Attendance Type", mode === "in-person" ? "In Person" : "Proxy"],
      ["Shareholder Name", selected.fullName],
      ["Contact Number", normalizePhone(phone)],
      ["Ghana Card ID Number", ghanaCardId.trim().toUpperCase()],
      ["Verification Code", verificationCode.trim()],
      ["Chit Number", chitNumber.trim()],
      ["Consent Accepted", consentChecked ? "Yes" : "No"],
      ...(mode === "proxy"
        ? [
            ["Proxy Name", proxyName.trim()],
            ["Proxy Contact Number", normalizePhone(proxyPhone)],
            ["Proxy Ghana Card ID", proxyGhanaCardId.trim().toUpperCase()],
          ]
        : []),
    ]);

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

      setShareholders((current) => current.filter((item) => item.id !== updated.id));
      setSuccess({
        shareholderName: updated.fullName,
        mode,
        verificationCode: updated.verificationCode,
        notes,
      });
      toast.success("AGM registration saved to the live register.");
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
    <AppShell>
      <div className="page-shell space-y-6" data-ocid="agm.registration.page">
        <AgmSubnav />

        <section className="hero-panel">
          <div className="hero-panel__content">
            <div className="page-kicker">Registration Desk</div>
            <div className="space-y-4">
              <h1 className="text-4xl font-display font-bold text-foreground sm:text-5xl">
                AGM {activeYear} Registration
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Search the pending shareholder queue, review identity details,
                and complete an in-person or proxy registration flow inside the
                portal.
              </p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.18fr]">
          <PortalCard
            elevated
            title="Pending Shareholders"
            subtitle={`${filtered.length} shareholders currently ready for registration in AGM ${activeYear}.`}
            data-ocid="agm.registration.queue.card"
          >
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, member number, branch, or Ghana Card"
                  className="h-12 pl-10"
                />
              </div>

              <div className="panel-sharp overflow-hidden border border-border/40 bg-muted/20">
                {filtered.length === 0 ? (
                  <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="font-display text-lg font-semibold text-foreground">
                      No shareholder match
                    </div>
                    <div className="max-w-sm text-sm text-muted-foreground">
                      Try a different search term to find a pending shareholder
                      in the AGM registration queue.
                    </div>
                  </div>
                ) : (
                  filtered.map((shareholder) => (
                    <ShareholderListItem
                      key={shareholder.id}
                      shareholder={shareholder}
                      selected={selected?.id === shareholder.id}
                      onSelect={() => handleSelectShareholder(shareholder)}
                    />
                  ))
                )}
              </div>
            </div>
          </PortalCard>

          <PortalCard
            elevated
            title={selected ? selected.fullName : "Registration Form"}
            subtitle={
              selected
                ? `Complete the AGM ${activeYear} registration flow for shareholder ${selected.shareholderNumber}.`
                : "Select a shareholder from the queue to open the registration form."
            }
            data-ocid="agm.registration.detail.card"
          >
            {!selected ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div className="font-display text-lg font-semibold text-foreground">
                  Select a shareholder
                </div>
                <div className="max-w-sm text-sm text-muted-foreground">
                  The right panel will switch from preview mode into the actual
                  AGM registration form once a shareholder is selected.
                </div>
              </div>
            ) : success ? (
              <div className="space-y-5">
                <div className="panel-sharp border border-primary/25 bg-primary/10 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center border border-primary/20 bg-primary/15 text-primary">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-display text-xl font-bold text-foreground">
                        Registration Prepared
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {success.shareholderName} is ready for{" "}
                        {success.mode === "in-person" ? "in-person" : "proxy"} AGM registration.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Registration Mode
                    </div>
                    <div className="mt-2 font-semibold text-foreground">
                      {success.mode === "in-person" ? "In Person" : "Proxy"}
                    </div>
                  </div>
                  <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Verification Code
                    </div>
                    <div className="mt-2 font-semibold text-foreground">
                      {success.verificationCode}
                    </div>
                  </div>
                </div>

                <div className="panel-sharp border border-border/40 bg-background/60 p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Registration Notes
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {success.notes}
                  </pre>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    className="glass-button h-12 px-5 text-sm font-bold uppercase tracking-[0.14em]"
                    onClick={() => resetForm(selected)}
                  >
                    Register Another Mode
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 px-5 text-sm font-semibold"
                    onClick={() => {
                      setSelectedId(null);
                      resetForm(null);
                    }}
                  >
                    Back to Queue
                  </Button>
                </div>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Shareholder Number
                    </div>
                    <div className="mt-2 font-semibold text-foreground">
                      {selected.shareholderNumber}
                    </div>
                  </div>
                  <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Branch
                    </div>
                    <div className="mt-2 font-semibold text-foreground">
                      {selected.branch}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant={mode === "in-person" ? "default" : "outline"}
                    className="h-12 justify-start gap-2"
                    onClick={() => setMode("in-person")}
                  >
                    <UserPlus className="h-4 w-4" />
                    In-Person Registration
                  </Button>
                  <Button
                    type="button"
                    variant={mode === "proxy" ? "default" : "outline"}
                    className="h-12 justify-start gap-2"
                    onClick={() => setMode("proxy")}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Proxy Registration
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>AGM Year</Label>
                    <Input value={activeYear} readOnly className="bg-muted/30" />
                  </div>
                  <div className="space-y-2">
                    <Label>Automatic Check-In Time</Label>
                    <Input value={new Date().toLocaleString()} readOnly className="bg-muted/30" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agm-phone">Contact Number</Label>
                  <Input
                    id="agm-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="0241234567"
                  />
                  <ErrorText message={errors.phone} />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="agm-card">Ghana Card ID Number</Label>
                    <Input
                      id="agm-card"
                      value={ghanaCardId}
                      onChange={(event) =>
                        setGhanaCardId(event.target.value.toUpperCase())
                      }
                      placeholder="GHA-123456789-1"
                    />
                    <ErrorText message={errors.ghanaCardId} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agm-verification">Verification Code</Label>
                    <Input
                      id="agm-verification"
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.target.value)}
                      placeholder="AGM-2401"
                    />
                    <ErrorText message={errors.verificationCode} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agm-chit">Chit / Member Number</Label>
                  <Input
                    id="agm-chit"
                    value={chitNumber}
                    onChange={(event) => setChitNumber(event.target.value)}
                    placeholder="Member number"
                  />
                  <ErrorText message={errors.chitNumber} />
                </div>

                {mode === "proxy" ? (
                  <div className="panel-sharp border border-border/40 bg-muted/20 p-4 space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Proxy Representative
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proxy-name">Proxy Name</Label>
                      <Input
                        id="proxy-name"
                        value={proxyName}
                        onChange={(event) => setProxyName(event.target.value)}
                        placeholder="Full proxy representative name"
                      />
                      <ErrorText message={errors.proxyName} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="proxy-phone">Proxy Contact Number</Label>
                        <Input
                          id="proxy-phone"
                          value={proxyPhone}
                          onChange={(event) => setProxyPhone(event.target.value)}
                          placeholder="0241234567"
                        />
                        <ErrorText message={errors.proxyPhone} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="proxy-card">Proxy Ghana Card ID</Label>
                        <Input
                          id="proxy-card"
                          value={proxyGhanaCardId}
                          onChange={(event) =>
                            setProxyGhanaCardId(event.target.value.toUpperCase())
                          }
                          placeholder="GHA-123456789-1"
                        />
                        <ErrorText message={errors.proxyGhanaCardId} />
                      </div>
                    </div>
                  </div>
                ) : null}

                <label className="panel-sharp flex items-start gap-3 border border-border/40 bg-muted/20 p-4">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(event) => setConsentChecked(event.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="text-sm text-muted-foreground">
                    I confirm that the identity details, verification code, and
                    AGM registration information above are correct.
                  </div>
                </label>
                <ErrorText message={errors.consent} />

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="submit"
                    className="glass-button h-12 px-5 text-sm font-bold uppercase tracking-[0.14em]"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Saving Registration..." : "Complete Registration"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 px-5 text-sm font-semibold"
                    onClick={() => resetForm(selected)}
                  >
                    Reset Form
                  </Button>
                </div>
              </form>
            )}
          </PortalCard>
        </div>
      </div>
    </AppShell>
  );
}

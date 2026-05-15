import { AgmSubnav } from "@/components/AgmSubnav";
import { AppShell } from "@/components/AppShell";
import { PortalCard } from "@/components/PortalCard";
import { useAgmYear } from "@/context/AgmYearContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AGM_UPDATED_EVENT,
  apiCorrectAgmRegistration,
  apiGetAgmOperatorActivity,
  apiGetAgmSettings,
  apiGetAgmShareholders,
  apiReopenAgmRegistration,
  apiResetAgmVerificationCode,
  apiUpdateAgmSettings,
} from "@/lib/backend-client";
import {
  type AgmOperatorActivityRecord,
  type AgmSettingsRecord,
  type AgmShareholderRecord,
} from "@/lib/agm-module";
import {
  buildRegistrationNotes,
  normalizePhone,
} from "@/lib/agm-registration-utils";
import { useAuth } from "@/store/auth";
import {
  AlertTriangle,
  Clock,
  Copy,
  RefreshCw,
  Settings,
  Shield,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AgmAdminPage() {
  const { activeYear } = useAgmYear();
  const { user } = useAuth();
  const [settings, setSettings] = useState<AgmSettingsRecord>({
    agmName: "",
    venue: "",
    agmDate: "",
    quorumRequiredPct: 50,
  });
  const [shareholders, setShareholders] = useState<AgmShareholderRecord[]>([]);
  const [activity, setActivity] = useState<AgmOperatorActivityRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [correctMode, setCorrectMode] = useState<"in-person" | "proxy">("in-person");
  const [correctPhone, setCorrectPhone] = useState("");
  const [correctCard, setCorrectCard] = useState("");
  const [correctCode, setCorrectCode] = useState("");
  const [correctProxyName, setCorrectProxyName] = useState("");
  const [correctProxyPhone, setCorrectProxyPhone] = useState("");

  useEffect(() => {
    const load = () => {
      void Promise.all([
        apiGetAgmSettings(),
        apiGetAgmShareholders(),
        apiGetAgmOperatorActivity(),
      ]).then(([nextSettings, nextShareholders, nextActivity]) => {
        setSettings(nextSettings);
        setShareholders(nextShareholders);
        setActivity(nextActivity);
      });
    };
    load();
    window.addEventListener(AGM_UPDATED_EVENT, load);
    return () => {
      window.removeEventListener(AGM_UPDATED_EVENT, load);
    };
  }, []);

  const registeredShareholders = useMemo(
    () =>
      shareholders.filter(
        (record) => record.registrationType !== "Not Registered",
      ),
    [shareholders],
  );
  const selectedShareholder =
    registeredShareholders.find((record) => record.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedShareholder) return;
    setCorrectMode(
      selectedShareholder.registrationType === "Proxy" ? "proxy" : "in-person",
    );
    setCorrectPhone(selectedShareholder.phone);
    setCorrectCard(selectedShareholder.ghanaCardId);
    setCorrectCode(selectedShareholder.verificationCode);
    setCorrectProxyName(selectedShareholder.proxyName ?? "");
    setCorrectProxyPhone(selectedShareholder.proxyPhone ?? "");
  }, [selectedShareholder]);

  async function handleSaveSettings() {
    const updated = await apiUpdateAgmSettings(
      {
        agmName: settings.agmName,
        venue: settings.venue,
        agmDate: settings.agmDate,
        quorumRequiredPct: Number(settings.quorumRequiredPct),
      },
      user?.fullname ?? "AGM Operator",
    );
    setSettings(updated);
    toast.success("AGM settings saved to the live workspace.");
  }

  async function handleResetCode() {
    if (!selectedShareholder) return;
    const updated = await apiResetAgmVerificationCode(
      selectedShareholder.id,
      user?.fullname ?? "AGM Operator",
    );
    setCorrectCode(updated.verificationCode);
    navigator.clipboard?.writeText(updated.verificationCode).catch(() => undefined);
    toast.success(`Verification code reset for ${updated.fullName}.`);
  }

  async function handleReopenRegistration() {
    if (!selectedShareholder) return;
    await apiReopenAgmRegistration(
      selectedShareholder.id,
      user?.fullname ?? "AGM Operator",
    );
    setSelectedId("");
    toast.success("AGM registration reopened and returned to the pending queue.");
  }

  async function handleCorrectRegistration() {
    if (!selectedShareholder) return;
    const updated = await apiCorrectAgmRegistration({
      shareholderId: selectedShareholder.id,
      mode: correctMode,
      phone: normalizePhone(correctPhone),
      ghanaCardId: correctCard.trim().toUpperCase(),
      verificationCode: correctCode.trim(),
      operatorName: user?.fullname ?? "AGM Operator",
      proxyName: correctMode === "proxy" ? correctProxyName.trim() : undefined,
      proxyPhone:
        correctMode === "proxy" ? normalizePhone(correctProxyPhone) : undefined,
    });
    toast.success(`AGM registration corrected for ${updated.fullName}.`);
  }

  const latestSessions = activity.slice(0, 5);

  return (
    <AppShell>
      <div className="page-shell space-y-6" data-ocid="agm.admin.page">
        <AgmSubnav />

        <section className="hero-panel">
          <div className="hero-panel__content">
            <div className="page-kicker">Admin Workspace</div>
            <div className="space-y-4">
              <h1 className="text-4xl font-display font-bold text-foreground sm:text-5xl">
                AGM {activeYear} Administration
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Manage live AGM settings, correct desk activity, reset
                verification codes, and reopen registrations from inside the
                portal.
              </p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="metric-card min-h-[136px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Registered
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {registeredShareholders.length}
            </div>
          </div>
          <div className="metric-card min-h-[136px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Operator Activity
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {activity.length}
            </div>
          </div>
          <div className="metric-card min-h-[136px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              AGM Year
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {activeYear}
            </div>
          </div>
          <div className="metric-card min-h-[136px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Quorum
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {settings.quorumRequiredPct}%
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_1fr]">
          <PortalCard
            elevated
            title="AGM Settings"
            subtitle="Live meeting configuration shared across dashboard, board view, and reports."
            data-ocid="agm.admin.settings.card"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>AGM Name</Label>
                <Input
                  value={settings.agmName}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, agmName: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Venue</Label>
                <Input
                  value={settings.venue}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, venue: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>AGM Date</Label>
                <Input
                  value={settings.agmDate}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, agmDate: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Quorum Threshold (%)</Label>
                <Input
                  value={String(settings.quorumRequiredPct)}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      quorumRequiredPct: Number(event.target.value || 0),
                    }))
                  }
                />
              </div>
              <div className="panel-sharp flex items-center gap-3 border border-primary/25 bg-primary/10 p-4 md:col-span-2">
                <Settings className="h-5 w-5 text-primary" />
                <div className="text-sm text-muted-foreground">
                  Saving here updates the live AGM dashboard, board view, and reports.
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                className="glass-button h-12 px-5 text-sm font-bold uppercase tracking-[0.14em]"
                onClick={handleSaveSettings}
              >
                Save Settings
              </Button>
              <Button variant="outline" className="h-12 px-5 text-sm font-semibold">
                <RefreshCw className="mr-2 h-4 w-4" />
                Clone to Next Year
              </Button>
            </div>
          </PortalCard>

          <PortalCard
            elevated
            title="Registration Corrections"
            subtitle="Reset verification codes, reopen registrations, or correct stored registration data."
            data-ocid="agm.admin.corrections.card"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Registered Shareholder</Label>
                <select
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                  className="control-sharp glass-input border-input h-11 w-full border bg-transparent px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">Choose a registered shareholder</option>
                  {registeredShareholders.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.fullName} ({record.shareholderNumber})
                    </option>
                  ))}
                </select>
              </div>

              {selectedShareholder ? (
                <div className="space-y-4">
                  <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                    <div className="font-semibold text-foreground">
                      {selectedShareholder.fullName}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {selectedShareholder.branch} • {selectedShareholder.registrationType} • Last updated{" "}
                      {selectedShareholder.registeredAt
                        ? formatTimestamp(selectedShareholder.registeredAt)
                        : "Not registered"}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant={correctMode === "in-person" ? "default" : "outline"}
                      className="h-12 justify-start gap-2"
                      onClick={() => setCorrectMode("in-person")}
                    >
                      <Users className="h-4 w-4" />
                      In-Person
                    </Button>
                    <Button
                      type="button"
                      variant={correctMode === "proxy" ? "default" : "outline"}
                      className="h-12 justify-start gap-2"
                      onClick={() => setCorrectMode("proxy")}
                    >
                      <Shield className="h-4 w-4" />
                      Proxy
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={correctPhone} onChange={(event) => setCorrectPhone(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Ghana Card ID</Label>
                      <Input value={correctCard} onChange={(event) => setCorrectCard(event.target.value.toUpperCase())} />
                    </div>
                    <div className="space-y-2">
                      <Label>Verification Code</Label>
                      <Input value={correctCode} onChange={(event) => setCorrectCode(event.target.value)} />
                    </div>
                  </div>

                  {correctMode === "proxy" ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Proxy Name</Label>
                        <Input value={correctProxyName} onChange={(event) => setCorrectProxyName(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Proxy Phone</Label>
                        <Input value={correctProxyPhone} onChange={(event) => setCorrectProxyPhone(event.target.value)} />
                      </div>
                    </div>
                  ) : null}

                  <div className="panel-sharp border border-border/40 bg-background/60 p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Correction Notes
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {buildRegistrationNotes([
                        ["Mode", correctMode === "proxy" ? "Proxy" : "In Person"],
                        ["Phone", normalizePhone(correctPhone)],
                        ["Ghana Card", correctCard.trim().toUpperCase()],
                        ["Verification", correctCode.trim()],
                        ["Proxy Name", correctProxyName.trim()],
                        ["Proxy Phone", normalizePhone(correctProxyPhone)],
                      ])}
                    </pre>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="h-10 text-xs" onClick={handleResetCode}>
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Reset Verification Code
                    </Button>
                    <Button variant="outline" className="h-10 text-xs" onClick={handleCorrectRegistration}>
                      <UserCog className="mr-2 h-3.5 w-3.5" />
                      Save Correction
                    </Button>
                    <Button variant="outline" className="h-10 text-xs" onClick={handleReopenRegistration}>
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                      Reopen Registration
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="panel-sharp border border-border/40 bg-muted/20 p-5 text-sm text-muted-foreground">
                  Select a registered shareholder to manage verification codes or correct their AGM registration.
                </div>
              )}
            </div>
          </PortalCard>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
          <PortalCard
            elevated
            title="Live Desk Activity"
            subtitle="Recent operator actions coming from the live AGM workspace."
            data-ocid="agm.admin.sessions.card"
          >
            <div className="space-y-3">
              {latestSessions.length === 0 ? (
                <div className="panel-sharp border border-border/40 bg-muted/20 p-4 text-sm text-muted-foreground">
                  No AGM operator activity has been recorded yet.
                </div>
              ) : (
                latestSessions.map((entry) => (
                  <div
                    key={entry.id}
                    className="panel-sharp flex items-center justify-between gap-3 border border-border/40 bg-muted/20 p-4"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{entry.operatorName}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.action} • {entry.target} • {entry.branch}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <Clock className="mr-1 h-3 w-3" />
                      {formatTimestamp(entry.timestamp)}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </PortalCard>

          <PortalCard
            elevated
            title="Risk Controls"
            subtitle="Important controls to review before AGM day."
            data-ocid="agm.admin.risk.card"
          >
            <div className="space-y-4">
              <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Shield className="h-4 w-4 text-primary" />
                  <div className="font-semibold">Settings Governance</div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Changes to AGM name, venue, date, and quorum thresholds now feed directly into the live AGM workspace.
                </div>
              </div>
              <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  <div className="font-semibold">Registration Recovery</div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Reset verification codes, reopen registrations, and correct proxy or in-person details without leaving the AGM module.
                </div>
              </div>
              <div className="panel-sharp border border-primary/25 bg-primary/10 p-4">
                <div className="flex items-center gap-2 text-primary">
                  <AlertTriangle className="h-4 w-4" />
                  <div className="font-semibold">Operator Traceability</div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  AGM desk activity is now recorded as live operator events so admin users can see who changed what and when.
                </div>
              </div>
            </div>
          </PortalCard>
        </div>
      </div>
    </AppShell>
  );
}

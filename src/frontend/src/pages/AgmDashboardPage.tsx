import { AgmLayout } from "@/components/AgmLayout";
import { useAgmYear } from "@/context/AgmYearContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AGM_UPDATED_EVENT,
  apiGetAgmOverview,
  apiGetAgmSettings,
  apiGetAgmShareholders,
  type AgmOverview,
} from "@/lib/backend-client";
import { AGM_SUMMARY, type AgmSettingsRecord, type AgmShareholderRecord } from "@/lib/agm-module";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  Upload,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function exportAgmDashboardCsv(
  overview: AgmOverview,
  settings: AgmSettingsRecord,
  records: AgmShareholderRecord[],
  activeYear: string,
) {
  const headers = [
    "AGM Year",
    "AGM Name",
    "Venue",
    "AGM Date",
    "Total Shareholders",
    "Registered",
    "Checked In",
    "Pending",
    "Attendance Rate",
    "Quorum Threshold",
  ];
  const summary = overview.summary;
  const row = [
    activeYear,
    settings.agmName,
    settings.venue,
    settings.agmDate,
    summary.totalShareholders.toString(),
    summary.registered.toString(),
    summary.checkedIn.toString(),
    Math.max(summary.totalShareholders - summary.registered, 0).toString(),
    `${overview.attendanceRate.toFixed(1)}%`,
    `${settings.quorumRequiredPct}%`,
  ];
  const csv = [
    headers.map((value) => `"${value}"`).join(","),
    row.map((value) => `"${value}"`).join(","),
    "",
    '"Attendee","Type","Shareholder","Contact","Verification Code","Registered At","Status"',
    ...records.map((item) =>
      [
        item.fullName,
        item.registrationType,
        item.shareholderNumber,
        item.phone,
        item.verificationCode,
        item.registeredAt ?? "",
        item.checkedInAt ? "Checked In" : item.registrationType === "Not Registered" ? "Pending" : "Registered",
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agm-dashboard-snapshot-${activeYear}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatRegisteredAt(value: string | null) {
  if (!value) return "Not yet registered";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DashboardMetricCard({
  label,
  value,
  icon,
  accent = "text-primary",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="panel-sharp border border-border/40 bg-card/70 p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center border border-primary/25 bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className={`mt-1 text-4xl font-display font-bold ${accent}`}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({
  to,
  icon,
  title,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Link
      to={to}
      className="panel-sharp flex min-h-[96px] flex-col items-center justify-center gap-3 border border-border/40 bg-card/70 p-4 text-center transition-smooth hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="flex h-10 w-10 items-center justify-center border border-primary/25 bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="text-sm font-semibold text-foreground">{title}</div>
    </Link>
  );
}

export default function AgmDashboardPage() {
  const { activeYear } = useAgmYear();
  const [overview, setOverview] = useState<AgmOverview | null>(null);
  const [settings, setSettings] = useState<AgmSettingsRecord | null>(null);
  const [shareholders, setShareholders] = useState<AgmShareholderRecord[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All attendees" | "In Person" | "Proxy" | "Pending">(
    "All attendees",
  );

  useEffect(() => {
    const load = () => {
      void Promise.all([
        apiGetAgmOverview(),
        apiGetAgmSettings(),
        apiGetAgmShareholders(),
      ]).then(([nextOverview, nextSettings, nextShareholders]) => {
        setOverview(nextOverview);
        setSettings(nextSettings);
        setShareholders(nextShareholders);
      });
    };
    load();
    window.addEventListener(AGM_UPDATED_EVENT, load);
    return () => window.removeEventListener(AGM_UPDATED_EVENT, load);
  }, []);

  const summary = overview?.summary ?? {
    agmName: AGM_SUMMARY.agmName,
    venue: AGM_SUMMARY.venue,
    agmDate: AGM_SUMMARY.agmDate,
    quorumRequiredPct: AGM_SUMMARY.quorumRequiredPct,
    totalShareholders: 0,
    registered: 0,
    inPerson: 0,
    proxy: 0,
    checkedIn: 0,
  };
  const liveSettings = settings ?? {
    agmName: summary.agmName,
    venue: summary.venue,
    agmDate: summary.agmDate,
    quorumRequiredPct: summary.quorumRequiredPct,
  };
  const attendanceRate = overview?.attendanceRate ?? 0;
  const quorumReached = overview?.quorumReached ?? false;
  const recentRegistrations = overview?.recentRegistrations ?? [];
  const pendingCount = Math.max(summary.totalShareholders - summary.registered, 0);

  const attendeeRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...shareholders]
      .filter((item) => item.registrationType !== "Not Registered")
      .filter((item) => {
        if (typeFilter === "All attendees") return true;
        if (typeFilter === "Pending") return !item.checkedInAt;
        return item.registrationType === typeFilter;
      })
      .filter((item) => {
        if (!query) return true;
        return [
          item.fullName,
          item.shareholderNumber,
          item.phone,
          item.verificationCode,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        const aTime = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
        const bTime = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [search, shareholders, typeFilter]);

  return (
    <AgmLayout>
      <div className="page-shell space-y-6" data-ocid="agm.dashboard.page">
        <section className="panel-sharp-lg border border-border/40 bg-card/70 p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="font-display text-4xl font-bold text-foreground">Dashboard</h1>
              <p className="mt-2 text-lg text-muted-foreground">
                Live attendance metrics and analytics for AGM {activeYear}
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
              <div className="panel-sharp border border-border/40 bg-background/60 px-4 py-3">
                <div className="text-xs font-bold uppercase tracking-wider text-primary">AGM Year</div>
                <div className="mt-1 text-lg font-semibold text-foreground">{activeYear}</div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-12 px-5 text-sm font-semibold"
                onClick={() =>
                  overview &&
                  exportAgmDashboardCsv(overview, liveSettings, attendeeRows, activeYear)
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Export Snapshot
              </Button>
            </div>
          </div>
        </section>

        <section className="panel-sharp border border-border/40 bg-card/70 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center border border-primary/25 bg-primary/10 text-primary">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-foreground">
                  Quorum Status: {quorumReached ? "REACHED" : "NOT YET REACHED"}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Attendance: {attendanceRate.toFixed(1)}% • Required: {liveSettings.quorumRequiredPct}%
                </div>
              </div>
            </div>
            <div className="text-sm font-medium text-muted-foreground">
              Threshold at {liveSettings.quorumRequiredPct}%
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardMetricCard
            label="Total Shareholders"
            value={summary.totalShareholders.toLocaleString()}
            icon={<Users className="h-5 w-5" />}
          />
          <DashboardMetricCard
            label="Registered"
            value={summary.registered.toLocaleString()}
            icon={<ClipboardCheck className="h-5 w-5" />}
          />
          <DashboardMetricCard
            label="Checked In"
            value={summary.checkedIn.toLocaleString()}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <DashboardMetricCard
            label="Pending"
            value={pendingCount.toLocaleString()}
            icon={<UserX className="h-5 w-5" />}
            accent="text-emerald-400"
          />
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.7fr]">
          <section className="panel-sharp-lg border border-border/40 bg-card/70 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-3xl font-display font-bold text-foreground">Attendance Breakdown</h2>
              <Badge variant="outline" className="text-xs uppercase tracking-wider">
                {quorumReached ? "Leading category stable" : "Monitoring"}
              </Badge>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
              <div>
                <div className="text-4xl font-display font-bold text-foreground">{summary.inPerson}</div>
                <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  In Person
                </div>
              </div>
              <div>
                <div className="text-4xl font-display font-bold text-foreground">{summary.proxy}</div>
                <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Proxy
                </div>
              </div>
              <div>
                <div className="text-4xl font-display font-bold text-foreground">{summary.checkedIn}</div>
                <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Checked In
                </div>
              </div>
              <div>
                <div className="text-4xl font-display font-bold text-foreground">{pendingCount}</div>
                <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Not Registered
                </div>
              </div>
            </div>

            <div className="mt-8 panel-sharp border border-border/40 bg-background/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Total Shareholders
                  </div>
                  <div className="mt-1 text-4xl font-display font-bold text-foreground">
                    {summary.totalShareholders.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Leading Category
                  </div>
                  <div className="mt-1 text-2xl font-display font-bold text-foreground">
                    {pendingCount >= summary.inPerson &&
                    pendingCount >= summary.proxy &&
                    pendingCount >= summary.checkedIn
                      ? "Not Registered"
                      : summary.inPerson >= summary.proxy
                        ? "In Person"
                        : "Proxy"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-muted-foreground">Attendance Rate</div>
                <div className="text-xl font-display font-bold text-foreground">
                  {attendanceRate.toFixed(1)}%
                </div>
              </div>
              <div className="h-3 overflow-hidden border border-border/40 bg-background/60">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(attendanceRate, 100)}%` }}
                />
              </div>
            </div>
          </section>

          <section className="panel-sharp-lg border border-border/40 bg-card/70 p-6">
            <h2 className="text-3xl font-display font-bold text-foreground">AGM Information</h2>
            <div className="mt-8 space-y-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  AGM Name
                </div>
                <div className="mt-2 text-2xl font-display font-bold text-foreground">
                  {liveSettings.agmName}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-1 h-4 w-4 text-primary" />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Date
                  </div>
                  <div className="mt-1 text-lg font-semibold text-foreground">
                    {liveSettings.agmDate || "Not set"}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="mt-1 h-4 w-4 text-primary" />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Venue
                  </div>
                  <div className="mt-1 text-lg font-semibold text-foreground">
                    {liveSettings.venue || "Not set"}
                  </div>
                </div>
              </div>
              <div className="panel-sharp border border-border/40 bg-background/50 px-4 py-3">
                <div className="text-sm font-medium text-muted-foreground">Quorum Threshold</div>
                <div className="mt-2 text-2xl font-display font-bold text-foreground">
                  {liveSettings.quorumRequiredPct}%
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.7fr]">
          <section className="panel-sharp-lg border border-border/40 bg-card/70 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-3xl font-display font-bold text-foreground">Recent Activity</h2>
              <Badge variant="outline" className="text-xs uppercase tracking-wider">
                Auto-refreshes
              </Badge>
            </div>
            <div className="mt-6 min-h-[270px] panel-sharp border border-border/40 bg-background/40 p-6">
              {recentRegistrations.length > 0 ? (
                <div className="space-y-3">
                  {recentRegistrations.map((record) => (
                    <div
                      key={`${record.name}-${record.time}`}
                      className="panel-sharp border border-border/40 bg-card/60 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-foreground">{record.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {record.branch} • {record.type}
                          </div>
                        </div>
                        <Badge variant="outline">{record.time}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
                  <Users className="mb-4 h-10 w-10 text-muted-foreground/50" />
                  <div className="text-2xl font-display font-bold text-foreground">
                    No registrations for AGM {activeYear} yet
                  </div>
                  <div className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                    Activity will appear here once shareholders are registered in this AGM year.
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="panel-sharp-lg border border-border/40 bg-card/70 p-6">
            <h2 className="text-3xl font-display font-bold text-foreground">Quick Actions</h2>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <QuickActionCard
                to="/agm/registration"
                icon={<UserPlus className="h-5 w-5" />}
                title="Register Shareholder"
              />
              <QuickActionCard
                to="/agm/shareholders"
                icon={<Users className="h-5 w-5" />}
                title="View Registered List"
              />
              <QuickActionCard
                to="/agm/import"
                icon={<Upload className="h-5 w-5" />}
                title="Import Shareholders"
              />
              <QuickActionCard
                to="/agm/reports"
                icon={<FileText className="h-5 w-5" />}
                title="View Reports"
              />
            </div>
          </section>
        </div>

        <section className="panel-sharp-lg border border-border/40 bg-card/70 p-6">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-3xl font-display font-bold text-foreground">Registered Attendees</h2>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DashboardMetricCard
              label="Total Attendees"
              value={summary.registered.toLocaleString()}
              icon={<Users className="h-5 w-5" />}
            />
            <DashboardMetricCard
              label="In Person"
              value={summary.inPerson.toLocaleString()}
              icon={<UserPlus className="h-5 w-5" />}
            />
            <DashboardMetricCard
              label="Proxies"
              value={summary.proxy.toLocaleString()}
              icon={<ClipboardCheck className="h-5 w-5" />}
            />
            <DashboardMetricCard
              label="Pending"
              value={pendingCount.toLocaleString()}
              icon={<UserX className="h-5 w-5" />}
              accent="text-emerald-400"
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 xl:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search attendee, shareholder, phone, or code"
                className="h-12 pl-11"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_180px_auto]">
              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as "All attendees" | "In Person" | "Proxy" | "Pending")
                }
                className="panel-sharp h-12 border border-border/40 bg-background px-4 text-sm text-foreground"
              >
                <option>All attendees</option>
                <option>In Person</option>
                <option>Proxy</option>
                <option>Pending</option>
              </select>
              <div className="panel-sharp flex h-12 items-center border border-border/40 bg-background px-4 text-sm text-foreground">
                Latest first
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="h-12 gap-2 px-4 text-sm">
                  <FileText className="h-4 w-4" />
                  CSV
                </Button>
                <Button variant="outline" className="h-12 gap-2 px-4 text-sm">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
                <Button variant="outline" className="h-12 gap-2 px-4 text-sm">
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-none border border-border/40">
            <div className="grid grid-cols-[1.2fr_0.8fr_0.9fr_1fr_1fr_1fr_0.8fr] gap-4 border-b border-border/40 bg-background/60 px-4 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <div>Attendee</div>
              <div>Type</div>
              <div>Shareholder</div>
              <div>Contact</div>
              <div>Verification Code</div>
              <div>Registered At</div>
              <div>Status</div>
            </div>

            {attendeeRows.length > 0 ? (
              attendeeRows.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.2fr_0.8fr_0.9fr_1fr_1fr_1fr_0.8fr] gap-4 border-b border-border/20 bg-card/40 px-4 py-4 text-sm text-foreground last:border-b-0"
                >
                  <div className="font-semibold">{item.fullName}</div>
                  <div>{item.registrationType}</div>
                  <div>{item.shareholderNumber}</div>
                  <div>{item.phone || "-"}</div>
                  <div>{item.verificationCode || "-"}</div>
                  <div>{formatRegisteredAt(item.registeredAt)}</div>
                  <div>
                    <Badge variant="outline">
                      {item.checkedInAt ? "Checked In" : "Registered"}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-16 text-center text-base text-muted-foreground">
                No registered attendees match the current search or filters.
              </div>
            )}
          </div>
        </section>
      </div>
    </AgmLayout>
  );
}

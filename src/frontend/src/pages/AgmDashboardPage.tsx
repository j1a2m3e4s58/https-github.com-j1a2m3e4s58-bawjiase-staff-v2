import { AgmSubnav } from "@/components/AgmSubnav";
import { AppShell } from "@/components/AppShell";
import { PortalCard } from "@/components/PortalCard";
import { useAgmYear } from "@/context/AgmYearContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AGM_UPDATED_EVENT,
  apiGetAgmOverview,
  type AgmOverview,
} from "@/lib/backend-client";
import { AGM_SUMMARY } from "@/lib/agm-module";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Cog,
  Download,
  FileBarChart2,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

function exportAgmDashboardCsv(overview: AgmOverview, activeYear: string) {
  const { summary, attendanceRate, registrationRate, quorumReached } = overview;
  const rows = [
    ["Metric", "Value"],
    ["AGM Year", activeYear],
    ["AGM Name", summary.agmName],
    ["Venue", summary.venue],
    ["AGM Date", summary.agmDate],
    ["Total Shareholders", summary.totalShareholders.toString()],
    ["Registered", summary.registered.toString()],
    ["In Person", summary.inPerson.toString()],
    ["Proxy", summary.proxy.toString()],
    ["Checked In", summary.checkedIn.toString()],
    ["Attendance Rate", `${attendanceRate.toFixed(1)}%`],
    ["Registration Rate", `${registrationRate.toFixed(1)}%`],
    ["Quorum Status", quorumReached ? "Reached" : "Pending"],
  ];
  const csv = rows.map((row) => row.map((value) => `"${value}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agm-dashboard-${activeYear}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MetricTile({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="metric-card min-h-[156px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-5 font-display text-3xl font-bold text-foreground">
            {value}
          </p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}

export default function AgmDashboardPage() {
  const { activeYear } = useAgmYear();
  const [overview, setOverview] = useState<AgmOverview | null>(null);

  useEffect(() => {
    const load = () => {
      void apiGetAgmOverview().then(setOverview);
    };
    load();
    window.addEventListener(AGM_UPDATED_EVENT, load);
    return () => {
      window.removeEventListener(AGM_UPDATED_EVENT, load);
    };
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
  const attendanceRate = overview?.attendanceRate ?? 0;
  const registrationRate = overview?.registrationRate ?? 0;
  const quorumReached = overview?.quorumReached ?? false;
  const branchTurnout = overview?.branchTurnout ?? [];
  const recentRegistrations = overview?.recentRegistrations ?? [];

  return (
    <AppShell>
      <div className="page-shell space-y-6" data-ocid="agm.dashboard.page">
        <AgmSubnav />

        <section className="hero-panel">
          <div className="hero-panel__content">
            <div className="page-kicker">AGM Dashboard</div>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl space-y-4">
                <h1 className="text-4xl font-display font-bold text-foreground sm:text-5xl">
                  AGM {activeYear} Operations Dashboard
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Live-style summary for AGM registration, turnout, and board
                  readiness, now embedded directly into the staff portal.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 px-6 text-sm font-semibold"
                onClick={() => overview && exportAgmDashboardCsv(overview, activeYear)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Snapshot
                </Button>
                <Button
                  asChild
                  className="glass-button h-12 px-6 text-sm font-bold uppercase tracking-[0.16em]"
                >
                  <Link to="/agm/board">
                    Open Board View
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="panel-sharp border border-border/40 bg-primary/10 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Quorum status
              </div>
              <div className="mt-2 font-display text-2xl font-bold text-foreground">
                {quorumReached ? "Reached and Stable" : "Below Threshold"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Attendance is {attendanceRate.toFixed(1)}% against a required{" "}
                {summary.quorumRequiredPct}% threshold.
              </p>
            </div>
            <Badge className="border border-primary/30 bg-primary/15 px-3 py-1 text-primary">
              {summary.agmDate}
            </Badge>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Total shareholders"
            value={summary.totalShareholders.toLocaleString()}
            detail="Full shareholder base in scope for the active AGM year."
            icon={<Users className="h-5 w-5" />}
          />
          <MetricTile
            label="Registered"
            value={summary.registered.toLocaleString()}
            detail={`${registrationRate.toFixed(1)}% of the expected attendance base is already registered.`}
            icon={<ClipboardList className="h-5 w-5" />}
          />
          <MetricTile
            label="Checked in"
            value={summary.checkedIn.toLocaleString()}
            detail="Confirmed event-day participants currently recorded in the queue."
            icon={<UserCheck className="h-5 w-5" />}
          />
          <MetricTile
            label="Proxy"
            value={summary.proxy.toLocaleString()}
            detail="Proxy registrations captured for the board-facing attendance view."
            icon={<ShieldCheck className="h-5 w-5" />}
          />
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <PortalCard
            elevated
            title="Branch Turnout Progress"
            subtitle="Registration and check-in performance by branch."
            data-ocid="agm.dashboard.turnout.card"
          >
            <div className="space-y-4">
              {branchTurnout.map((branch) => {
                const turnoutPct =
                  branch.registered > 0
                    ? (branch.checkedIn / branch.registered) * 100
                    : 0;
                return (
                  <div key={branch.branch} className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-semibold text-foreground">{branch.branch}</div>
                        <div className="text-xs text-muted-foreground">
                          {branch.checkedIn.toLocaleString()} checked in of{" "}
                          {branch.registered.toLocaleString()} registered
                        </div>
                      </div>
                      <Badge variant="outline" className="w-fit text-xs">
                        {turnoutPct.toFixed(1)}% turnout
                      </Badge>
                    </div>
                    <div className="h-2.5 overflow-hidden border border-border/40 bg-muted/40">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(turnoutPct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </PortalCard>

          <PortalCard
            elevated
            title="AGM Event Snapshot"
            subtitle="Core meeting context for the current operational cycle."
            data-ocid="agm.dashboard.snapshot.card"
          >
            <div className="space-y-4 text-sm text-muted-foreground">
              <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-foreground">
                  AGM Name
                </div>
                <div className="mt-2 font-semibold text-foreground">
                  {summary.agmName}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <div className="font-semibold text-foreground">Meeting Date</div>
                  <div>{summary.agmDate}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <div className="font-semibold text-foreground">Venue</div>
                  <div>{summary.venue}</div>
                </div>
              </div>
              <div className="panel-sharp border border-border/40 bg-background/60 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Recommended next actions
                </div>
                <div className="mt-3 space-y-2">
                  <div>1. Review board-facing turnout summary</div>
                  <div>2. Finalize registration desk setup</div>
                  <div>3. Validate proxy list before event day</div>
                </div>
              </div>
            </div>
          </PortalCard>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
          <PortalCard
            elevated
            title="Recent Registrations"
            subtitle="Latest AGM participant activity for the active year."
            data-ocid="agm.dashboard.recent.card"
          >
            <div className="space-y-3">
              {recentRegistrations.map((record) => (
                <div
                  key={`${record.name}-${record.time}`}
                  className="panel-sharp flex items-center justify-between gap-3 border border-border/40 bg-muted/20 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground">{record.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {record.branch} • {record.type}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {record.time}
                  </Badge>
                </div>
              ))}
            </div>
          </PortalCard>

          <PortalCard
            elevated
            title="AGM Quick Actions"
            subtitle="Fast routes for the next AGM screens being integrated."
            data-ocid="agm.dashboard.actions.card"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button asChild variant="outline" className="h-14 justify-start gap-3">
                <Link to="/agm/board">
                  <ShieldCheck className="h-4 w-4" />
                  Board View
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-14 justify-start gap-3">
                <Link to="/agm/registration">
                  <UserPlus className="h-4 w-4" />
                  Registration Queue
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-14 justify-start gap-3">
                <Link to="/agm/reports">
                  <FileBarChart2 className="h-4 w-4" />
                  Reports
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-14 justify-start gap-3">
                <Link to="/agm/shareholders">
                  <Users className="h-4 w-4" />
                  Shareholders
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-14 justify-start gap-3">
                <Link to="/agm/admin">
                  <Cog className="h-4 w-4" />
                  Admin
                </Link>
              </Button>
            </div>
          </PortalCard>
        </div>
      </div>
    </AppShell>
  );
}

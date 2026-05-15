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
import {
  Download,
  Expand,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

function exportBoardSummaryCsv(overview: AgmOverview, activeYear: string) {
  const { summary, attendanceRate, quorumReached } = overview;
  const rows = [
    ["Metric", "Value"],
    ["AGM Year", activeYear],
    ["AGM Name", summary.agmName],
    ["Total Shareholders", summary.totalShareholders.toString()],
    ["Registered", summary.registered.toString()],
    ["Checked In", summary.checkedIn.toString()],
    ["Proxy", summary.proxy.toString()],
    ["In Person", summary.inPerson.toString()],
    ["Attendance Rate", `${attendanceRate.toFixed(1)}%`],
    ["Quorum Required", `${summary.quorumRequiredPct}%`],
    ["Quorum Status", quorumReached ? "Reached" : "Pending"],
  ];
  const csv = rows.map((row) => row.map((value) => `"${value}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agm-board-view-${activeYear}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AgmBoardViewPage() {
  const { activeYear } = useAgmYear();
  const [liveRefresh, setLiveRefresh] = useState(true);
  const [fullscreenMode, setFullscreenMode] = useState(false);
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
  const quorumReached = overview?.quorumReached ?? false;
  const boardHighlights = overview?.boardHighlights ?? [];
  const recentRegistrations = overview?.recentRegistrations ?? [];
  const branchTurnout = overview?.branchTurnout ?? [];

  return (
    <AppShell>
      <div className="page-shell space-y-6" data-ocid="agm.board.page">
        <AgmSubnav />

        <section className="hero-panel">
          <div className="hero-panel__content">
            <div className="page-kicker">Board View</div>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl space-y-4">
                <h1 className="text-4xl font-display font-bold text-foreground sm:text-5xl">
                  AGM {activeYear} Executive Summary
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  A board-facing summary screen for live turnout, quorum
                  confidence, and executive visibility, embedded directly in the
                  staff portal.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 px-6 text-sm font-semibold"
                  onClick={() => overview && exportBoardSummaryCsv(overview, activeYear)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Board CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 px-6 text-sm font-semibold"
                  onClick={() => setLiveRefresh((value) => !value)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {liveRefresh ? "Live Refresh On" : "Live Refresh Off"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 px-6 text-sm font-semibold"
                  onClick={() => setFullscreenMode((value) => !value)}
                >
                  <Expand className="mr-2 h-4 w-4" />
                  {fullscreenMode ? "Compact View" : "Focus View"}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section
          className={`panel-sharp border border-primary/30 bg-primary/10 ${
            fullscreenMode ? "px-7 py-7" : "px-5 py-5"
          }`}
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Quorum Status
              </div>
              <div className={`mt-2 font-display font-bold text-foreground ${fullscreenMode ? "text-4xl" : "text-2xl"}`}>
                {quorumReached ? "Reached" : "Pending"}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Attendance {attendanceRate.toFixed(1)}% • Required {summary.quorumRequiredPct}%
              </p>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Registered
              </div>
              <div className={`mt-2 font-display font-bold text-foreground ${fullscreenMode ? "text-5xl" : "text-3xl"}`}>
                {summary.registered.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Checked In
              </div>
              <div className={`mt-2 font-display font-bold text-foreground ${fullscreenMode ? "text-5xl" : "text-3xl"}`}>
                {summary.checkedIn.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Proxy
              </div>
              <div className={`mt-2 font-display font-bold text-foreground ${fullscreenMode ? "text-5xl" : "text-3xl"}`}>
                {summary.proxy.toLocaleString()}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {[
            {
              label: "Total Shareholders",
              value: summary.totalShareholders.toLocaleString(),
              icon: <Users className="h-5 w-5 text-primary" />,
            },
            {
              label: "In-Person",
              value: summary.inPerson.toLocaleString(),
              icon: <UserCheck className="h-5 w-5 text-primary" />,
            },
            {
              label: "Attendance Rate",
              value: `${attendanceRate.toFixed(1)}%`,
              icon: <TrendingUp className="h-5 w-5 text-primary" />,
            },
            {
              label: "Board Confidence",
              value: quorumReached ? "Stable" : "Watch",
              icon: <ShieldCheck className="h-5 w-5 text-primary" />,
            },
          ].map((item) => (
            <PortalCard
              key={item.label}
              elevated
              className="min-h-[160px]"
              data-ocid={`agm.board.metric.${item.label.toLowerCase().replace(/\s+/g, "_")}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </div>
                  <div className="mt-5 font-display text-3xl font-bold text-foreground">
                    {item.value}
                  </div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center border border-primary/20 bg-primary/10">
                  {item.icon}
                </div>
              </div>
            </PortalCard>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.95fr]">
          <PortalCard
            elevated
            title="Board Highlights"
            subtitle="Executive indicators for the current AGM cycle."
            data-ocid="agm.board.highlights.card"
          >
            <div className="space-y-3">
              {boardHighlights.map((item) => (
                <div
                  key={item.label}
                  className="panel-sharp flex items-center justify-between gap-3 border border-border/40 bg-muted/20 px-4 py-3"
                >
                  <div className="text-sm text-muted-foreground">{item.label}</div>
                  <div className="font-semibold text-foreground">{item.value}</div>
                </div>
              ))}
            </div>
          </PortalCard>

          <PortalCard
            elevated
            title="Latest Registration Signals"
            subtitle="Fresh entries most likely to matter in board review."
            data-ocid="agm.board.recent.card"
          >
            <div className="space-y-3">
              {recentRegistrations.slice(0, 4).map((record) => (
                <div
                  key={`${record.name}-${record.time}`}
                  className="panel-sharp border border-border/40 bg-muted/20 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-foreground">{record.name}</div>
                    <Badge variant="outline" className="text-xs">
                      {record.type}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {record.branch} • {record.time}
                  </div>
                </div>
              ))}
            </div>
          </PortalCard>
        </div>

        <PortalCard
          elevated
          title="Branch Readiness"
          subtitle="Board-ready turnout posture across AGM branches."
          data-ocid="agm.board.readiness.card"
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {branchTurnout.map((branch) => {
              const checkedInPct =
                branch.registered > 0
                  ? (branch.checkedIn / branch.registered) * 100
                  : 0;
              return (
                <div
                  key={branch.branch}
                  className="panel-sharp border border-border/40 bg-muted/20 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-foreground">{branch.branch}</div>
                      <div className="text-xs text-muted-foreground">
                        {branch.checkedIn.toLocaleString()} checked in • {branch.registered.toLocaleString()} registered
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {checkedInPct.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden border border-border/40 bg-background/70">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.min(checkedInPct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </PortalCard>
      </div>
    </AppShell>
  );
}

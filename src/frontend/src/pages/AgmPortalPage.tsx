import { AgmLayout } from "@/components/AgmLayout";
import { PortalCard } from "@/components/PortalCard";
import { useAgmYear } from "@/context/AgmYearContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AGM_UPDATED_EVENT,
  apiGetAgmImportBatches,
  apiGetAgmOverview,
  apiGetAgmSettings,
  type AgmOverview,
} from "@/lib/backend-client";
import { AGM_SUMMARY, type AgmImportBatchRecord, type AgmSettingsRecord } from "@/lib/agm-module";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Cog,
  FileBarChart2,
  ShieldCheck,
  Upload,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AgmMetric({
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

function AgmModuleTile({
  title,
  detail,
  icon,
  status,
  to,
}: {
  title: string;
  detail: string;
  icon: ReactNode;
  status: string;
  to?: string;
}) {
  const body = (
    <div className="glass-card panel-sharp flex min-h-[176px] flex-col gap-4 p-5 transition-smooth hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
          {icon}
        </div>
        <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
          {status}
        </Badge>
      </div>
      <div className="space-y-2">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {detail}
        </p>
      </div>
    </div>
  );

  if (to) {
    return <Link to={to}>{body}</Link>;
  }

  return body;
}

export default function AgmPortalPage() {
  const { activeYear } = useAgmYear();
  const [overview, setOverview] = useState<AgmOverview | null>(null);
  const [settings, setSettings] = useState<AgmSettingsRecord | null>(null);
  const [importBatches, setImportBatches] = useState<AgmImportBatchRecord[]>([]);

  useEffect(() => {
    const load = () => {
      void Promise.all([
        apiGetAgmOverview(),
        apiGetAgmSettings(),
        apiGetAgmImportBatches(),
      ]).then(([nextOverview, nextSettings, nextBatches]) => {
        setOverview(nextOverview);
        setSettings(nextSettings);
        setImportBatches(nextBatches);
      });
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
  const latestBatch = importBatches[0] ?? null;
  const controlState = useMemo(() => {
    if (!latestBatch) return "Awaiting first live import";
    if (latestBatch.status === "Completed With Issues") return "Needs operator review";
    if (quorumReached) return "Stable and live";
    return "Live and below quorum";
  }, [latestBatch, quorumReached]);

  return (
    <AgmLayout>
      <div className="page-shell space-y-6" data-ocid="agm.page">
        <section className="hero-panel">
          <div className="hero-panel__content">
            <div className="page-kicker">Embedded module</div>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-4">
                <h1 className="text-4xl font-display font-bold text-foreground sm:text-5xl">
                  AGM Portal {activeYear}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Live AGM workspace for registration, turnout, shareholder
                  control, import activity, and executive reporting inside the
                  main staff portal.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  className="glass-button h-12 px-6 text-sm font-bold uppercase tracking-[0.16em]"
                >
                  <Link to="/agm/dashboard">
                    Open AGM Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-12 px-6 text-sm font-semibold"
                >
                  <Link to="/forms">Back to Portal Tools</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="panel-sharp border border-primary/30 bg-primary/10 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Live AGM Status
              </div>
              <div className="mt-2 font-display text-2xl font-bold text-foreground">
                {controlState}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {summary.agmName} at {settings?.venue ?? summary.venue} on{" "}
                {settings?.agmDate ?? summary.agmDate}. Registration is{" "}
                {registrationRate.toFixed(1)}% and attendance is{" "}
                {attendanceRate.toFixed(1)}%.
              </p>
            </div>
            <Badge className="border border-primary/30 bg-primary/15 px-3 py-1 text-primary">
              {quorumReached ? "Quorum reached" : "Quorum pending"}
            </Badge>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AgmMetric
            label="Total shareholders"
            value={summary.totalShareholders.toLocaleString()}
            detail="Current AGM shareholder base loaded into the live register."
            icon={<BriefcaseBusiness className="h-5 w-5" />}
          />
          <AgmMetric
            label="Registered"
            value={summary.registered.toLocaleString()}
            detail={`${registrationRate.toFixed(1)}% of the active AGM register is already processed.`}
            icon={<CalendarDays className="h-5 w-5" />}
          />
          <AgmMetric
            label="Checked in"
            value={summary.checkedIn.toLocaleString()}
            detail="Event-day attendees currently confirmed in the live AGM queue."
            icon={<ShieldCheck className="h-5 w-5" />}
          />
          <AgmMetric
            label="Import batches"
            value={importBatches.length.toString()}
            detail={
              latestBatch
                ? `Latest batch ${latestBatch.filename} from ${latestBatch.branch}.`
                : "No live AGM import batches have been completed yet."
            }
            icon={<Users className="h-5 w-5" />}
          />
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <PortalCard
            elevated
            title="AGM Module Workspace"
            subtitle="Every AGM tool below now routes into the same live data layer."
            data-ocid="agm.roadmap.card"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <AgmModuleTile
                to="/agm/board"
                title="Board View"
                detail="Executive-facing live attendance, quorum progress, and board summary metrics."
                icon={<ShieldCheck className="h-5 w-5" />}
                status={quorumReached ? "Live / quorum reached" : "Live / monitoring"}
              />
              <AgmModuleTile
                to="/agm/dashboard"
                title="Dashboard"
                detail="Core AGM operations dashboard for turnout, readiness, and module entry points."
                icon={<CalendarDays className="h-5 w-5" />}
                status="Live data"
              />
              <AgmModuleTile
                title="Registration Desk"
                detail="Staff-facing registration workflow for in-person and proxy attendee processing."
                icon={<UserPlus className="h-5 w-5" />}
                status={`${summary.registered.toLocaleString()} processed`}
                to="/agm/registration"
              />
              <AgmModuleTile
                title="Shareholders"
                detail="AGM shareholder register, attendance records, and searchable participant views."
                icon={<Users className="h-5 w-5" />}
                status={`${summary.totalShareholders.toLocaleString()} live records`}
                to="/agm/shareholders"
              />
              <AgmModuleTile
                title="Reports & Analytics"
                detail="Export summaries, turnout analysis, and executive reporting for AGM sessions."
                icon={<FileBarChart2 className="h-5 w-5" />}
                status={`${summary.checkedIn.toLocaleString()} checked in`}
                to="/agm/reports"
              />
              <AgmModuleTile
                title="Import & Data Prep"
                detail="Bulk shareholder imports and year-based AGM setup tools for prep teams."
                icon={<Upload className="h-5 w-5" />}
                status={latestBatch ? latestBatch.status : "Awaiting first import"}
                to="/agm/import"
              />
              <AgmModuleTile
                title="Admin Workspace"
                detail="AGM settings, user control, and operational oversight for event preparation."
                icon={<Cog className="h-5 w-5" />}
                status="Live controls"
                to="/agm/admin"
              />
            </div>
          </PortalCard>

          <PortalCard
            elevated
            title="Current Operational Posture"
            subtitle="Live status pulled from the AGM settings and activity layer."
            data-ocid="agm.phase.card"
          >
            <div className="space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                The AGM entry page now reflects the same live settings and totals
                used by the dashboard, board view, reports, import, registration,
                and admin screens.
              </p>
              <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Active meeting settings
                </div>
                <div className="mt-3 space-y-2">
                  <div>1. AGM Name: {settings?.agmName ?? summary.agmName}</div>
                  <div>2. Venue: {settings?.venue ?? summary.venue}</div>
                  <div>3. AGM Date: {settings?.agmDate ?? summary.agmDate}</div>
                  <div>4. Quorum Threshold: {(settings?.quorumRequiredPct ?? summary.quorumRequiredPct)}%</div>
                </div>
              </div>
              <div className="panel-sharp border border-border/40 bg-background/60 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Latest live batch
                </div>
                <div className="mt-3 space-y-2">
                  {latestBatch ? (
                    <>
                      <div>1. File: {latestBatch.filename}</div>
                      <div>2. Branch: {latestBatch.branch}</div>
                      <div>3. Imported Rows: {latestBatch.importedRows}</div>
                      <div>4. Logged: {formatTimestamp(latestBatch.importedAt)}</div>
                    </>
                  ) : (
                    <div>No AGM import batch has been completed yet.</div>
                  )}
                </div>
              </div>
            </div>
          </PortalCard>
        </div>
      </div>
    </AgmLayout>
  );
}

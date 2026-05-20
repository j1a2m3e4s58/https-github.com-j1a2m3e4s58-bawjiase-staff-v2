import { AgmYearSwitcher } from "@/components/AgmYearSwitcher";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgmYear } from "@/context/AgmYearContext";
import {
  useAllCheckIns,
  useAllRegistrations,
  useAllShareholders,
  useRecordAuditEvent,
  useSettings,
  RegistrationType,
} from "@/hooks/use-backend";
import {
  buildYearScopedShareholders,
  filterCheckInsByRegistrations,
  filterRegistrationsByYear,
} from "@/lib/agm-year";
import { Download, Expand, RefreshCw, ShieldCheck, TrendingUp, Users, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

function exportBoardCsv(
  activeYear: string,
  agmName: string,
  metrics: Array<[string, string]>,
) {
  const rows = [
    ["AGM Year", activeYear],
    ["AGM Name", agmName],
    ["Generated", new Date().toISOString()],
    ...metrics,
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agm-${activeYear}-board-summary-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function BoardViewPage() {
  const { activeYear } = useAgmYear();
  const queryClient = useQueryClient();
  const recordAuditEvent = useRecordAuditEvent();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveRefresh, setLiveRefresh] = useState(true);
  const { data: settings } = useSettings();
  const { data: shareholders = [] } = useAllShareholders();
  const { data: registrations = [] } = useAllRegistrations();
  const { data: checkIns = [] } = useAllCheckIns();

  const registrationsForYear = filterRegistrationsByYear(registrations, activeYear);
  const checkInsForYear = filterCheckInsByRegistrations(checkIns, registrationsForYear);
  const scopedShareholders = buildYearScopedShareholders(
    shareholders,
    registrationsForYear,
    checkInsForYear,
  );

  const summary = useMemo(() => {
    const total = scopedShareholders.length;
    const registered = registrationsForYear.length;
    const checkedIn = checkInsForYear.length;
    const proxy = registrationsForYear.filter(
      (registration) => registration.registrationType === RegistrationType.Proxy,
    ).length;
    const inPerson = registrationsForYear.filter(
      (registration) => registration.registrationType === RegistrationType.InPerson,
    ).length;
    const attendanceRate = total > 0 ? (checkedIn / total) * 100 : 0;
    const quorumRequired = Number(settings?.quorumThreshold ?? 50n);
    const quorumReached = attendanceRate >= quorumRequired;

    return {
      total,
      registered,
      checkedIn,
      proxy,
      inPerson,
      attendanceRate,
      quorumRequired,
      quorumReached,
    };
  }, [checkInsForYear, registrationsForYear, scopedShareholders, settings]);

  const recentNames = useMemo(
    () =>
      [...registrationsForYear]
        .sort((left, right) => Number(right.registeredAt - left.registeredAt))
        .slice(0, 5)
        .map((registration) => {
          const shareholder = scopedShareholders.find(
            (item) => item.id === registration.shareholderId,
          );
          return {
            name: shareholder?.fullName ?? registration.shareholderId,
            type:
              registration.registrationType === RegistrationType.Proxy
                ? "Proxy"
                : "In Person",
          };
        }),
    [registrationsForYear, scopedShareholders],
  );

  const exportMetrics: Array<[string, string]> = [
    ["Total Shareholders", summary.total.toLocaleString()],
    ["Registered", summary.registered.toLocaleString()],
    ["Checked In", summary.checkedIn.toLocaleString()],
    ["In Person", summary.inPerson.toLocaleString()],
    ["Proxy", summary.proxy.toLocaleString()],
    ["Attendance Rate", `${summary.attendanceRate.toFixed(1)}%`],
    ["Quorum Required", `${summary.quorumRequired}%`],
    ["Quorum Status", summary.quorumReached ? "Reached" : "Not Reached"],
  ];

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!liveRefresh) return;
    const interval = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["registrations"] });
      void queryClient.invalidateQueries({ queryKey: ["checkins"] });
      void queryClient.invalidateQueries({ queryKey: ["shareholders"] });
    }, 8000);
    return () => window.clearInterval(interval);
  }, [liveRefresh, queryClient]);

  const handleExport = () => {
    exportBoardCsv(activeYear, settings?.agmName ?? "AGM Pro", exportMetrics);
    void recordAuditEvent.mutateAsync({
      action: "EXPORT_REPORT",
      entityType: "board",
      entityId: activeYear,
      details: `Exported board summary for AGM ${activeYear}`,
    });
  };

  const handleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
  };

  return (
    <Layout>
      <div
        className={`mx-auto ${
          isFullscreen
            ? "max-w-none min-h-screen bg-background px-3 py-5 sm:px-6 lg:px-10"
            : "max-w-6xl"
        } space-y-6`}
        data-ocid="board.page"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Chairman / Board View
            </p>
            <h1 className="font-display text-2xl font-bold text-foreground">
              AGM {activeYear} Executive Summary
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live board-facing attendance and quorum view for {settings?.agmName ?? "the AGM"}.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <AgmYearSwitcher compact />
            <Button
              variant="outline"
              className="min-h-[44px] gap-2"
              onClick={handleExport}
              data-ocid="board.export_button"
            >
              <Download className="h-4 w-4" />
              Export Board CSV
            </Button>
            <Button
              variant="outline"
              className="min-h-[44px] gap-2"
              onClick={() => setLiveRefresh((value) => !value)}
            >
              <RefreshCw className={`h-4 w-4 ${liveRefresh ? "animate-spin" : ""}`} />
              {liveRefresh ? "Live Refresh On" : "Live Refresh Off"}
            </Button>
            <Button
              variant="outline"
              className="min-h-[44px] gap-2"
              onClick={() => void handleFullscreen()}
            >
              <Expand className="h-4 w-4" />
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </Button>
          </div>
        </div>

        <Card className="border-primary/25 bg-primary/10">
          <CardContent
            className={`grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4 ${
              isFullscreen ? "lg:gap-6 lg:p-8" : ""
            }`}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-primary/80">
                Quorum Status
              </p>
              <p
                className={`mt-2 font-display font-bold text-foreground ${
                  isFullscreen ? "text-4xl" : "text-2xl"
                }`}
              >
                {summary.quorumReached ? "Reached" : "Not Reached"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Attendance {summary.attendanceRate.toFixed(1)}% · Required {summary.quorumRequired}%
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-primary/80">
                Registered
              </p>
              <p
                className={`mt-2 font-display font-bold text-foreground ${
                  isFullscreen ? "text-5xl" : "text-3xl"
                }`}
              >
                {summary.registered.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-primary/80">
                Checked In
              </p>
              <p
                className={`mt-2 font-display font-bold text-foreground ${
                  isFullscreen ? "text-5xl" : "text-3xl"
                }`}
              >
                {summary.checkedIn.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-primary/80">
                Proxy
              </p>
              <p
                className={`mt-2 font-display font-bold text-foreground ${
                  isFullscreen ? "text-5xl" : "text-3xl"
                }`}
              >
                {summary.proxy.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-4">
          {[
            {
              label: "Total Shareholders",
              value: summary.total.toLocaleString(),
              icon: Users,
            },
            {
              label: "In-Person Registrations",
              value: summary.inPerson.toLocaleString(),
              icon: UserCheck,
            },
            {
              label: "Live Attendance Rate",
              value: `${summary.attendanceRate.toFixed(1)}%`,
              icon: TrendingUp,
            },
            {
              label: "Proxy Registrations",
              value: summary.proxy.toLocaleString(),
              icon: ShieldCheck,
            },
          ].map((item) => (
            <Card key={item.label}>
              <CardHeader className="pb-3">
                <CardTitle
                  className={`flex items-center gap-2 ${
                    isFullscreen ? "text-lg" : "text-base"
                  }`}
                >
                  <item.icon
                    className={`${isFullscreen ? "h-5 w-5" : "h-4 w-4"} text-primary`}
                  />
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`font-display font-bold text-foreground ${
                    isFullscreen ? "text-5xl" : "text-3xl"
                  }`}
                >
                  {item.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div
          className={`grid gap-4 ${
            isFullscreen ? "xl:grid-cols-[1.5fr_1fr]" : "lg:grid-cols-[1.4fr_1fr]"
          }`}
        >
          <Card>
            <CardHeader>
              <CardTitle
                className={`flex items-center gap-2 ${
                  isFullscreen ? "text-lg" : "text-base"
                }`}
              >
                <ShieldCheck
                  className={`${isFullscreen ? "h-5 w-5" : "h-4 w-4"} text-primary`}
                />
                Board Highlights
              </CardTitle>
            </CardHeader>
            <CardContent
              className={`space-y-3 text-muted-foreground ${
                isFullscreen ? "text-base" : "text-sm"
              }`}
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <span>AGM Year</span>
                <span className="font-semibold text-foreground">{activeYear}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <span>Venue</span>
                <span className="font-semibold text-foreground">{settings?.venue || "Not set"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <span>AGM Date</span>
                <span className="font-semibold text-foreground">{settings?.agmDate || "Not set"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Quorum Position</span>
                <Badge variant={summary.quorumReached ? "default" : "secondary"}>
                  {summary.quorumReached ? "On track" : "Below target"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className={isFullscreen ? "text-lg" : "text-base"}>
                Most Recent Registrations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentNames.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No registrations have been completed for AGM {activeYear} yet.
                </p>
              ) : (
                recentNames.map((item) => (
                  <div
                    key={`${item.name}-${item.type}`}
                    className="flex items-center justify-between border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <p
                        className={`font-medium text-foreground ${
                          isFullscreen ? "text-lg" : ""
                        }`}
                      >
                        {item.name}
                      </p>
                      <p
                        className={`${isFullscreen ? "text-sm" : "text-xs"} text-muted-foreground`}
                      >
                        {item.type}
                      </p>
                    </div>
                    <Badge variant="outline">{item.type}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

import { AgmLayout } from "@/components/AgmLayout";
import { PortalCard } from "@/components/PortalCard";
import { useAgmYear } from "@/context/AgmYearContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AGM_UPDATED_EVENT,
  apiGetAgmShareholders,
} from "@/lib/backend-client";
import { type AgmShareholderRecord } from "@/lib/agm-module";
import {
  AlertTriangle,
  Download,
  FileBarChart2,
  FileSpreadsheet,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function exportReportsCsv(records: AgmShareholderRecord[], activeYear: string) {
  const rows = [
    [
      "Shareholder Number",
      "Full Name",
      "Branch",
      "Registration Type",
      "Verification Code",
      "Registered At",
      "Checked In At",
    ],
    ...records.map((item) => [
      item.shareholderNumber,
      item.fullName,
      item.branch,
      item.registrationType,
      item.verificationCode,
      item.registeredAt ?? "",
      item.checkedInAt ?? "",
    ]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${value}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agm-reports-${activeYear}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

type ReportFilter = "all" | "registered" | "checked-in" | "pending";

export default function AgmReportsPage() {
  const { activeYear } = useAgmYear();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [shareholders, setShareholders] = useState<AgmShareholderRecord[]>([]);

  useEffect(() => {
    const load = () => {
      void apiGetAgmShareholders().then(setShareholders);
    };
    load();
    window.addEventListener(AGM_UPDATED_EVENT, load);
    return () => {
      window.removeEventListener(AGM_UPDATED_EVENT, load);
    };
  }, []);

  const registered = shareholders.filter(
    (record) => record.registrationType !== "Not Registered",
  );
  const checkedIn = shareholders.filter((record) => Boolean(record.checkedInAt));
  const pending = shareholders.filter(
    (record) => record.registrationType === "Not Registered",
  );

  const filtered = useMemo(() => {
    const base =
      filter === "registered"
        ? registered
        : filter === "checked-in"
          ? checkedIn
          : filter === "pending"
            ? pending
            : shareholders;
    const normalized = query.trim().toLowerCase();
    if (!normalized) return base;
    return base.filter((item) =>
      [
        item.fullName,
        item.shareholderNumber,
        item.branch,
        item.registrationType,
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [checkedIn, filter, pending, query, registered, shareholders]);

  return (
    <AgmLayout>
      <div className="page-shell space-y-6" data-ocid="agm.reports.page">
        <section className="hero-panel">
          <div className="hero-panel__content">
            <div className="page-kicker">Reports & Analytics</div>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl space-y-4">
                <h1 className="text-4xl font-display font-bold text-foreground sm:text-5xl">
                  AGM {activeYear} Reports
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Review the embedded attendance register, audit the current
                  AGM posture, and export executive-friendly summary data from
                  inside the portal.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-12 px-6 text-sm font-semibold"
                onClick={() => exportReportsCsv(shareholders, activeYear)}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Report CSV
              </Button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="metric-card min-h-[140px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Full Register
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {shareholders.length.toLocaleString()}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Total AGM shareholders available for reporting.
            </div>
          </div>
          <div className="metric-card min-h-[140px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Registered
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {registered.length.toLocaleString()}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Members with completed registration records.
            </div>
          </div>
          <div className="metric-card min-h-[140px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Checked In
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {checkedIn.length.toLocaleString()}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Participants already confirmed on the event queue.
            </div>
          </div>
          <div className="metric-card min-h-[140px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pending
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {pending.length.toLocaleString()}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Shareholders still awaiting registration capture.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.95fr]">
          <PortalCard
            elevated
            title="Attendance Report"
            subtitle="Search and filter the current AGM reporting dataset."
            data-ocid="agm.reports.attendance.card"
          >
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by name, member number, branch, or status"
                    className="h-12 pl-10"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "all", label: "All" },
                    { key: "registered", label: "Registered" },
                    { key: "checked-in", label: "Checked In" },
                    { key: "pending", label: "Pending" },
                  ].map((item) => (
                    <Button
                      key={item.key}
                      type="button"
                      variant={filter === item.key ? "default" : "outline"}
                      className="h-12"
                      onClick={() => setFilter(item.key as ReportFilter)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className="border-b border-border/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-3">Shareholder</th>
                      <th className="px-3 py-3">Branch</th>
                      <th className="px-3 py-3">Type</th>
                      <th className="px-3 py-3">Verification</th>
                      <th className="px-3 py-3">Registered</th>
                      <th className="px-3 py-3">Checked In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-border/30 last:border-b-0 hover:bg-muted/20"
                      >
                        <td className="px-3 py-3">
                          <div className="font-semibold text-foreground">{item.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            #{item.shareholderNumber}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{item.branch}</td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className="text-xs">
                            {item.registrationType}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {item.verificationCode || "Pending"}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {item.registeredAt ?? "Not registered"}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {item.checkedInAt ?? "Not checked in"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </PortalCard>

          <PortalCard
            elevated
            title="Report Pack"
            subtitle="Embedded export and executive pack guidance."
            data-ocid="agm.reports.pack.card"
          >
            <div className="space-y-4">
              <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-foreground">
                  <FileBarChart2 className="h-4 w-4 text-primary" />
                  <div className="font-semibold">Board Summary Pack</div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Current embedded version supports export-ready attendance and
                  participation summary data for executive review.
                </div>
              </div>
              <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-foreground">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <div className="font-semibold">Spreadsheet Exports</div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Use the CSV export to move attendance and registration data
                  into finance, compliance, or board packs.
                </div>
              </div>
              <div className="panel-sharp border border-primary/25 bg-primary/10 p-4">
                <div className="flex items-center gap-2 text-primary">
                  <AlertTriangle className="h-4 w-4" />
                  <div className="font-semibold">Next Reports Upgrade</div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  The next AGM pass can add richer exports, printable board
                  PDFs, and branch-by-branch reporting breakdowns.
                </div>
              </div>
            </div>
          </PortalCard>
        </div>
      </div>
    </AgmLayout>
  );
}

import { AgmLayout } from "@/components/AgmLayout";
import { useAgmYear } from "@/context/AgmYearContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  MapPin,
  Search,
  TrendingUp,
  Upload,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

type AttendeeRecord = {
  id: string;
  attendeeName: string;
  attendeeType: "In Person" | "Proxy";
  shareholderName: string;
  shareholderNumber: string;
  contact: string;
  verificationCode: string;
  registeredAt: string;
  status: "Registered" | "Checked In";
};

function formatTimestamp(value: string | null): string {
  if (!value) return "Not yet registered";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function timeAgo(value: string | null): string {
  if (!value) return "Just now";
  const ms = new Date(value).getTime();
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ms).toLocaleDateString();
}

function exportSnapshotCSV(
  overview: AgmOverview,
  settings: AgmSettingsRecord,
  activeYear: string,
) {
  const rows = [
    ["Metric", "Value"],
    ["AGM Year", activeYear],
    ["AGM Name", settings.agmName],
    ["AGM Date", settings.agmDate],
    ["Venue", settings.venue],
    ["Total Shareholders", overview.summary.totalShareholders.toString()],
    ["Registered", overview.summary.registered.toString()],
    ["Registered In-Person", overview.summary.inPerson.toString()],
    ["Registered Proxy", overview.summary.proxy.toString()],
    ["Checked In", overview.summary.checkedIn.toString()],
    [
      "Not Registered",
      Math.max(
        overview.summary.totalShareholders - overview.summary.registered,
        0,
      ).toString(),
    ],
    ["Attendance Rate (%)", overview.attendanceRate.toFixed(1)],
    ["Quorum Reached", overview.quorumReached ? "Yes" : "No"],
    ["Required Quorum (%)", settings.quorumRequiredPct.toString()],
    ["Snapshot Taken", new Date().toISOString()],
  ];
  const csv = rows.map((row) => row.map((value) => `"${value}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `agm-${activeYear}-snapshot-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadXlsx(filename: string, headers: string[], rows: string[][]) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Attendees");
  XLSX.writeFile(workbook, filename);
}

function downloadPdf(filename: string, title: string, headers: string[], rows: string[][]) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!printWindow) return;
  const tableRows = rows
    .map(
      (row) =>
        `<tr>${row
          .map((value) => `<td style="padding:8px;border:1px solid #d1d5db;">${value}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  const tableHeaders = headers
    .map((header) => `<th style="padding:8px;border:1px solid #d1d5db;background:#f3f4f6;">${header}</th>`)
    .join("");
  printWindow.document.write(`
    <html>
      <head>
        <title>${filename}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          h1 { margin-bottom: 8px; }
          p { margin-top: 0; color: #475569; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <table>
          <thead><tr>${tableHeaders}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function mixHex(color: string, target: string, weight: number) {
  const normalizedWeight = Math.min(Math.max(weight, 0), 1);
  const parse = (value: string) =>
    value.match(/[a-f0-9]{2}/gi)?.map((part) => Number.parseInt(part, 16)) ?? [0, 0, 0];
  const [r1, g1, b1] = parse(color);
  const [r2, g2, b2] = parse(target);
  const mix = (a: number, b: number) =>
    Math.round(a + (b - a) * normalizedWeight)
      .toString(16)
      .padStart(2, "0");
  return `#${mix(r1, r2)}${mix(g1, g2)}${mix(b1, b2)}`;
}

function DonutChart({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const nonZeroSegments = segments.filter((segment) => segment.value > 0);
  const gradient =
    total > 0 && nonZeroSegments.length > 0
      ? `conic-gradient(from -90deg, ${nonZeroSegments
          .map((segment, index) => {
            const start =
              nonZeroSegments.slice(0, index).reduce((sum, item) => sum + item.value, 0) / total;
            const end =
              nonZeroSegments.slice(0, index + 1).reduce((sum, item) => sum + item.value, 0) /
              total;
            return `${segment.color} ${Math.round(start * 1000) / 10}% ${Math.round(end * 1000) / 10}%`;
          })
          .join(", ")})`
      : "conic-gradient(from -90deg, #AEB4AF 0% 100%)";

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative flex h-[136px] w-[136px] flex-shrink-0 items-center justify-center">
        <div
          className="h-[136px] w-[136px] rounded-full border border-white/10 shadow-[0_16px_40px_rgba(8,12,24,0.28)]"
          style={{ background: gradient }}
        />
        <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full border border-border/70 bg-card">
          <span className="text-[22px] font-display font-bold text-foreground">
            {total.toLocaleString()}
          </span>
          <span className="text-[11px] text-muted-foreground">Total</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: segment.color }} />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="pl-3 font-semibold tabular-nums text-foreground">
              {segment.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stats3DChart({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const maxValue = Math.max(...segments.map((segment) => segment.value), 1);
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 overflow-x-auto pb-2">
        {segments.map((segment, index) => {
          const height = Math.max(24, (segment.value / maxValue) * 180);
          const topColor = mixHex(segment.color, "#ffffff", 0.22);
          const frontBottomColor = mixHex(segment.color, "#000000", 0.18);
          const sideColor = mixHex(segment.color, "#000000", 0.34);
          return (
            <div
              key={segment.label}
              className="chart-rise flex min-w-[72px] flex-col items-center gap-3"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="text-center">
                <p className="font-display text-lg font-bold tabular-nums text-foreground">
                  {segment.value.toLocaleString()}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {segment.label}
                </p>
              </div>
              <div className="relative flex h-[210px] items-end">
                <div className="relative w-14" style={{ height }}>
                  <div
                    className="absolute inset-0 border border-white/10 shadow-[0_20px_40px_rgba(4,16,32,0.3)]"
                    style={{
                      background: `linear-gradient(180deg, ${segment.color} 0%, ${frontBottomColor} 100%)`,
                      transform: "perspective(240px) rotateX(10deg)",
                      transformOrigin: "bottom center",
                    }}
                  />
                  <div
                    className="absolute -top-2 left-0 right-0 h-4 border border-white/15"
                    style={{
                      background: `linear-gradient(180deg, ${topColor} 0%, ${segment.color} 100%)`,
                      transform: "skewX(-45deg)",
                    }}
                  />
                  <div
                    className="absolute top-0 -right-2 h-full w-4 border border-white/10"
                    style={{
                      background: `linear-gradient(180deg, ${sideColor} 0%, ${mixHex(sideColor, "#000000", 0.2)} 100%)`,
                      transform: "skewY(-45deg)",
                      transformOrigin: "left top",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Shareholders</p>
            <p className="font-display text-2xl font-bold text-foreground">{total.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Leading Category</p>
            <p className="text-sm font-semibold text-foreground">
              {[...segments].sort((a, b) => b.value - a.value)[0]?.label ?? "N/A"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  valueColor = "text-foreground",
  ocid,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  valueColor?: string;
  ocid: string;
}) {
  return (
    <div className="panel-sharp border border-border/40 bg-card/70 p-5" data-ocid={ocid}>
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={`font-display text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  ocid,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  ocid: string;
}) {
  return (
    <Link
      to={to}
      data-ocid={ocid}
      className="flex min-h-[80px] flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-4 text-center transition-smooth hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <span className="text-xs font-medium leading-tight text-foreground/80">{label}</span>
    </Link>
  );
}

function ActivityItem({ record, index }: { record: AgmShareholderRecord; index: number }) {
  return (
    <div
      className="flex items-start gap-3 border-b border-border/40 py-3 last:border-b-0"
      data-ocid={`dashboard.activity.item.${index}`}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
        <UserCheck className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{record.fullName}</p>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            {record.registrationType}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {record.branch} • Verification code {record.verificationCode || "Pending"}
        </p>
      </div>
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        {timeAgo(record.checkedInAt || record.registeredAt)}
      </span>
    </div>
  );
}

function AGMInfoCard({ settings }: { settings: AgmSettingsRecord }) {
  return (
    <div className="panel-sharp-lg border border-border/40 bg-card/70 p-6" data-ocid="dashboard.agm_info.card">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
        <CalendarDays className="h-4 w-4 text-primary" />
        AGM Information
      </h2>
      <div className="mt-6 space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AGM Name</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{settings.agmName || "Not set"}</p>
        </div>
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="text-sm font-medium text-foreground">{settings.agmDate || "Not set"}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Venue</p>
            <p className="text-sm font-medium text-foreground">{settings.venue || "Not set"}</p>
          </div>
        </div>
        <div className="pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Quorum Threshold</p>
            <Badge variant="outline" className="text-xs">
              {settings.quorumRequiredPct}%
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function AttendeesPanel({
  shareholders,
  activeYear,
}: {
  shareholders: AgmShareholderRecord[];
  activeYear: string;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "in-person" | "proxy">("all");
  const [sortBy, setSortBy] = useState<"latest" | "name" | "shareholder" | "type">("latest");

  const attendeeRecords = useMemo<AttendeeRecord[]>(
    () =>
      shareholders
        .filter((item) => item.registrationType !== "Not Registered")
        .map((item) => ({
          id: item.id,
          attendeeName: item.registrationType === "Proxy" ? item.proxyName || "Proxy Representative" : item.fullName,
          attendeeType: item.registrationType === "Proxy" ? "Proxy" : "In Person",
          shareholderName: item.fullName,
          shareholderNumber: item.shareholderNumber,
          contact: item.registrationType === "Proxy" ? item.proxyPhone || "—" : item.phone || "—",
          verificationCode: item.verificationCode,
          registeredAt: item.registeredAt || "",
          status: item.checkedInAt ? "Checked In" : "Registered",
        })),
    [shareholders],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const nextRecords = attendeeRecords.filter((item) => {
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "in-person" && item.attendeeType === "In Person") ||
        (typeFilter === "proxy" && item.attendeeType === "Proxy");
      const matchesSearch =
        !normalizedSearch ||
        item.attendeeName.toLowerCase().includes(normalizedSearch) ||
        item.shareholderName.toLowerCase().includes(normalizedSearch) ||
        item.shareholderNumber.toLowerCase().includes(normalizedSearch) ||
        item.contact.toLowerCase().includes(normalizedSearch) ||
        item.verificationCode.toLowerCase().includes(normalizedSearch);
      return matchesType && matchesSearch;
    });

    return [...nextRecords].sort((left, right) => {
      switch (sortBy) {
        case "name":
          return left.attendeeName.localeCompare(right.attendeeName);
        case "shareholder":
          return left.shareholderName.localeCompare(right.shareholderName);
        case "type":
          return left.attendeeType.localeCompare(right.attendeeType);
        case "latest":
        default:
          return new Date(right.registeredAt).getTime() - new Date(left.registeredAt).getTime();
      }
    });
  }, [attendeeRecords, search, sortBy, typeFilter]);

  const stats = useMemo(() => {
    const total = attendeeRecords.length;
    const proxies = attendeeRecords.filter((item) => item.attendeeType === "Proxy").length;
    const inPerson = attendeeRecords.filter((item) => item.attendeeType === "In Person").length;
    return {
      total,
      proxies,
      inPerson,
      pending: Math.max(shareholders.length - total, 0),
    };
  }, [attendeeRecords, shareholders.length]);

  const exportHeaders = [
    "Attendee Name",
    "Attendee Type",
    "Shareholder Name",
    "Shareholder Number",
    "Contact",
    "Verification Code",
    "Registered At",
    "Status",
  ];
  const exportRows = filteredRecords.map((item) => [
    item.attendeeName,
    item.attendeeType,
    item.shareholderName,
    item.shareholderNumber,
    item.contact,
    item.verificationCode,
    formatTimestamp(item.registeredAt),
    item.status,
  ]);

  return (
    <div className="panel-sharp-lg border border-border/40 bg-card/70 p-6">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h2 className="font-display text-base font-bold text-foreground">Registered Attendees</h2>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Attendees" value={stats.total.toLocaleString()} icon={Users} ocid="dashboard.attendees.total" />
        <MetricCard label="In Person" value={stats.inPerson.toLocaleString()} icon={UserCheck} valueColor="text-primary" ocid="dashboard.attendees.in_person" />
        <MetricCard label="Proxies" value={stats.proxies.toLocaleString()} icon={ClipboardList} valueColor="text-primary" ocid="dashboard.attendees.proxies" />
        <MetricCard label="Pending" value={stats.pending.toLocaleString()} icon={UserX} valueColor="text-accent" ocid="dashboard.attendees.pending" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search attendee, shareholder, phone, or code"
            className="min-h-[44px] pl-9"
            data-ocid="dashboard.attendees.search_input"
          />
        </div>
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as "all" | "in-person" | "proxy")}>
          <SelectTrigger className="min-h-[44px]" data-ocid="dashboard.attendees.filter_select">
            <SelectValue placeholder="Filter type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All attendees</SelectItem>
            <SelectItem value="in-person">In person</SelectItem>
            <SelectItem value="proxy">Proxy</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as "latest" | "name" | "shareholder" | "type")}>
          <SelectTrigger className="min-h-[44px]" data-ocid="dashboard.attendees.sort_select">
            <SelectValue placeholder="Sort records" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Latest first</SelectItem>
            <SelectItem value="name">Attendee name</SelectItem>
            <SelectItem value="shareholder">Shareholder name</SelectItem>
            <SelectItem value="type">Attendee type</SelectItem>
          </SelectContent>
        </Select>
        <Tabs defaultValue="csv" className="gap-0 sm:col-span-2 lg:col-span-1">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto">
            <TabsTrigger
              value="csv"
              onClick={() =>
                downloadCsv(`agm-${activeYear}-dashboard-attendees-${Date.now()}.csv`, exportHeaders, exportRows)
              }
              data-ocid="dashboard.attendees.export_csv"
            >
              <FileText className="h-4 w-4" />
              CSV
            </TabsTrigger>
            <TabsTrigger
              value="xlsx"
              onClick={() =>
                void downloadXlsx(`agm-${activeYear}-dashboard-attendees-${Date.now()}.xlsx`, exportHeaders, exportRows)
              }
              data-ocid="dashboard.attendees.export_xlsx"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </TabsTrigger>
            <TabsTrigger
              value="pdf"
              onClick={() =>
                downloadPdf(
                  `agm-${activeYear}-dashboard-attendees-${Date.now()}.pdf`,
                  `Registered Attendees - AGM ${activeYear}`,
                  exportHeaders,
                  exportRows,
                )
              }
              data-ocid="dashboard.attendees.export_pdf"
            >
              <Download className="h-4 w-4" />
              PDF
            </TabsTrigger>
          </TabsList>
          <TabsContent value="csv" className="hidden" />
          <TabsContent value="xlsx" className="hidden" />
          <TabsContent value="pdf" className="hidden" />
        </Tabs>
      </div>

      <div className="mt-4 rounded-xl border border-border overflow-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/40">
            <tr>
              {["Attendee", "Type", "Shareholder", "Contact", "Verification Code", "Registered At", "Status"].map(
                (header) => (
                  <th
                    key={header}
                    className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No registered attendees match the current search or filters.
                </td>
              </tr>
            ) : (
              filteredRecords.map((item, index) => (
                <tr
                  key={item.id}
                  className="border-t border-border/50 transition-colors hover:bg-muted/20"
                  data-ocid={`dashboard.attendees.item.${index + 1}`}
                >
                  <td className="px-3 py-3 font-medium text-foreground">{item.attendeeName}</td>
                  <td className="px-3 py-3">
                    <Badge variant="outline" className="text-xs">
                      {item.attendeeType}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-foreground">{item.shareholderName}</div>
                    <div className="font-mono text-xs text-muted-foreground">#{item.shareholderNumber}</div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{item.contact}</td>
                  <td className="px-3 py-3 font-mono text-xs text-primary">{item.verificationCode}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{formatTimestamp(item.registeredAt)}</td>
                  <td className="px-3 py-3">
                    <Badge className="border border-primary/30 bg-primary/15 text-xs text-primary">{item.status}</Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AgmDashboardPage() {
  const { activeYear } = useAgmYear();
  const [overview, setOverview] = useState<AgmOverview | null>(null);
  const [settings, setSettings] = useState<AgmSettingsRecord | null>(null);
  const [shareholders, setShareholders] = useState<AgmShareholderRecord[]>([]);

  useEffect(() => {
    const load = () => {
      void Promise.all([apiGetAgmOverview(), apiGetAgmSettings(), apiGetAgmShareholders()]).then(
        ([nextOverview, nextSettings, nextShareholders]) => {
          setOverview(nextOverview);
          setSettings(nextSettings);
          setShareholders(nextShareholders);
        },
      );
    };
    load();
    window.addEventListener(AGM_UPDATED_EVENT, load);
    return () => window.removeEventListener(AGM_UPDATED_EVENT, load);
  }, [activeYear]);

  const liveSettings = settings ?? {
    agmName: AGM_SUMMARY.agmName,
    venue: AGM_SUMMARY.venue,
    agmDate: AGM_SUMMARY.agmDate,
    quorumRequiredPct: AGM_SUMMARY.quorumRequiredPct,
  };

  const displayMetrics = useMemo(
    () =>
      overview?.summary ?? {
        totalShareholders: shareholders.length,
        registered: shareholders.filter((item) => item.registrationType !== "Not Registered").length,
        inPerson: shareholders.filter((item) => item.registrationType === "In Person").length,
        proxy: shareholders.filter((item) => item.registrationType === "Proxy").length,
        checkedIn: shareholders.filter((item) => Boolean(item.checkedInAt)).length,
        agmName: liveSettings.agmName,
        agmDate: liveSettings.agmDate,
        venue: liveSettings.venue,
        quorumRequiredPct: liveSettings.quorumRequiredPct,
      },
    [liveSettings, overview, shareholders],
  );

  const attendanceRate =
    overview?.attendanceRate ??
    (displayMetrics.totalShareholders > 0
      ? (displayMetrics.checkedIn / displayMetrics.totalShareholders) * 100
      : 0);
  const pendingCount = Math.max(displayMetrics.totalShareholders - displayMetrics.registered, 0);
  const quorumReached = overview?.quorumReached ?? attendanceRate >= liveSettings.quorumRequiredPct;

  const recentActivity = useMemo(
    () =>
      [...shareholders]
        .filter((item) => Boolean(item.checkedInAt || item.registeredAt))
        .sort(
          (left, right) =>
            new Date(right.checkedInAt || right.registeredAt || 0).getTime() -
            new Date(left.checkedInAt || left.registeredAt || 0).getTime(),
        )
        .slice(0, 10),
    [shareholders],
  );

  const donutSegments = useMemo<DonutSegment[]>(
    () => [
      { label: "In Person", value: displayMetrics.inPerson, color: "#33c463" },
      { label: "Proxy", value: displayMetrics.proxy, color: "#d4aa2f" },
      { label: "Checked In", value: displayMetrics.checkedIn, color: "#ff7a7a" },
      { label: "Not Registered", value: pendingCount, color: "#c2c8c2" },
    ],
    [displayMetrics.checkedIn, displayMetrics.inPerson, displayMetrics.proxy, pendingCount],
  );

  return (
    <AgmLayout>
      <div className="space-y-4 p-6" data-ocid="dashboard.page">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-base text-muted-foreground">
              Live attendance metrics and analytics for AGM {activeYear}
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                AGM Year
              </div>
              <div className="h-11 min-w-[88px] border border-border bg-card px-4 py-2 text-lg font-semibold text-foreground">
                {activeYear}
              </div>
            </div>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => overview && exportSnapshotCSV(overview, liveSettings, activeYear)}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Snapshot
            </Button>
          </div>
        </div>

        <div
          className="sea-shell sea-outline surface-highlight flex flex-col gap-3 border border-border/60 px-5 py-3.5 sm:flex-row sm:items-center"
          data-ocid="dashboard.quorum.banner"
        >
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center border ${
              quorumReached ? "border-primary/30 bg-primary/12" : "border-border/70 bg-muted/50"
            }`}
          >
            {quorumReached ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`font-display text-base font-bold ${quorumReached ? "text-primary" : "text-foreground"}`}>
              Quorum Status: {quorumReached ? "REACHED" : "NOT YET REACHED"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Attendance: <span className="font-semibold text-foreground">{attendanceRate.toFixed(1)}%</span>
              {" "}• Required: <span className="font-semibold text-foreground">{liveSettings.quorumRequiredPct}%</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="h-2 w-36 overflow-hidden bg-muted">
              <div className="h-full bg-primary" style={{ width: `${Math.min(attendanceRate, 100)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">Threshold at {liveSettings.quorumRequiredPct}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-ocid="dashboard.metrics.section">
          <MetricCard label="Total Shareholders" value={displayMetrics.totalShareholders.toLocaleString()} icon={Users} ocid="dashboard.metric.total" />
          <MetricCard label="Registered" value={displayMetrics.registered.toLocaleString()} icon={ClipboardList} valueColor="text-primary" ocid="dashboard.metric.registered" />
          <MetricCard label="Checked In" value={displayMetrics.checkedIn.toLocaleString()} icon={CheckCircle2} valueColor="text-primary" ocid="dashboard.metric.checkedin" />
          <MetricCard label="Pending" value={pendingCount.toLocaleString()} icon={UserX} valueColor="text-accent" ocid="dashboard.metric.pending" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="panel-sharp-lg border border-border/60 bg-card/70 lg:col-span-2">
            <div className="border-b border-border/50 px-6 py-4">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                Attendance Breakdown
              </h2>
            </div>
            <div className="space-y-6 px-6 py-5">
              <Stats3DChart segments={donutSegments} total={displayMetrics.totalShareholders} />
              <DonutChart segments={donutSegments} total={displayMetrics.totalShareholders} />
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Attendance Rate</span>
                  <span className="font-semibold text-foreground">{attendanceRate.toFixed(1)}%</span>
                </div>
                <div className="h-2.5 overflow-hidden bg-muted" data-ocid="dashboard.attendance_bar">
                  <div className="h-full bg-primary transition-smooth" style={{ width: `${Math.min(attendanceRate, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          <AGMInfoCard settings={liveSettings} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="panel-sharp-lg border border-border/60 bg-card/70 lg:col-span-2">
            <div className="border-b border-border/50 px-6 py-4">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                <Clock className="h-4 w-4 text-primary" />
                Recent Activity
                <Badge variant="secondary" className="ml-auto text-xs">
                  Auto-refreshes
                </Badge>
              </h2>
            </div>
            <div className="px-6 py-5" data-ocid="dashboard.activity.list">
              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center" data-ocid="dashboard.activity.empty_state">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <UserCheck className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No registrations for AGM {activeYear} yet</p>
                  <p className="text-xs text-muted-foreground">
                    Activity will appear here once shareholders are registered in this AGM year
                  </p>
                </div>
              ) : (
                <div>
                  {recentActivity.map((record, index) => (
                    <ActivityItem key={record.id} record={record} index={index + 1} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel-sharp-lg border border-border/60 bg-card/70">
            <div className="border-b border-border/50 px-6 py-4">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                <ArrowRight className="h-4 w-4 text-primary" />
                Quick Actions
              </h2>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-2" data-ocid="dashboard.quick_actions.section">
                <QuickAction to="/agm/registration" icon={UserPlus} label="Register Shareholder" ocid="dashboard.register.button" />
                <QuickAction to="/agm/shareholders" icon={Users} label="View Registered List" ocid="dashboard.shareholders.button" />
                <QuickAction to="/agm/import" icon={Upload} label="Import Shareholders" ocid="dashboard.import.button" />
                <QuickAction to="/agm/reports" icon={FileBarChart2} label="View Reports" ocid="dashboard.reports.button" />
              </div>
            </div>
          </div>
        </div>

        <AttendeesPanel shareholders={shareholders} activeYear={activeYear} />
      </div>
    </AgmLayout>
  );
}

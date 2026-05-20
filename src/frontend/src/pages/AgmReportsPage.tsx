import { Layout } from "@/components/Layout";
import { AgmYearSwitcher } from "@/components/AgmYearSwitcher";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RegistrationType,
  ShareholderStatus,
  useAuditLogForExport,
  useAllCheckIns,
  useAllRegistrations,
  useAllShareholders,
  useRecordAuditEvent,
} from "@/hooks/use-backend";
import { useAgmYear } from "@/context/AgmYearContext";
import { useSettings } from "@/hooks/use-backend";
import {
  buildYearScopedShareholders,
  filterCheckInsByRegistrations,
  filterRegistrationsByYear,
} from "@/lib/agm-year";
import type { CheckIn, Registration, Shareholder } from "@/types";
import {
  AlertTriangle,
  Award,
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { parseRegistrationNotes } from "./registration/registration-form-utils";

function matchesSearch(values: Array<string | null | undefined>, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => value?.toLowerCase().includes(normalized));
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function formatBigInt(n: bigint | undefined): string {
  if (n === undefined) return "0";
  return Number(n).toLocaleString();
}

function formatDate(ns: bigint | undefined): string {
  if (!ns) return "—";
  return new Date(Number(ns) / 1_000_000).toLocaleString();
}

function buildAttendanceRows(
  shareholders: Shareholder[],
  registrations: Registration[],
  checkIns: CheckIn[],
) {
  const regMap = new Map(registrations.map((r) => [r.shareholderId, r]));
  const ciMap = new Map(checkIns.map((c) => [c.shareholderId, c]));
  return shareholders.map((s) => {
    const reg = regMap.get(s.id);
    const ci = ciMap.get(s.id);
    return {
      number: s.shareholderNumber,
      name: s.fullName,
      shareholding: s.shareholding,
      status: s.status,
      regType: reg?.registrationType ?? null,
      checkInTime: ci?.checkedInAt ?? null,
    };
  });
}

function statusLabel(status: ShareholderStatus): string {
  const map: Record<string, string> = {
    NotRegistered: "Not Registered",
    RegisteredInPerson: "In Person",
    RegisteredProxy: "Proxy",
    CheckedIn: "Checked In",
  };
  return map[status] ?? status;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ── CSV export ─────────────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const escapeCell = (v: string) => `"${v.replace(/"/g, '""')}`.concat('"');
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((r) => r.map(escapeCell).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Excel export (xlsx) ────────────────────────────────────────────────────────

async function downloadXLSX(
  filename: string,
  rows: (string | number | bigint)[][],
  headers: string[],
) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    ...rows.map((r) => r.map((v) => (typeof v === "bigint" ? Number(v) : v))),
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, filename);
}

// ── PDF export (jsPDF) ─────────────────────────────────────────────────────────

async function downloadPDF(
  filename: string,
  title: string,
  rows: string[][],
  headers: string[],
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { jsPDF } = await import("jspdf" as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { default: autoTable } = await import("jspdf-autotable" as any);
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.setTextColor(30, 100, 60);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 28,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [22, 101, 52], textColor: 255 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    margin: { left: 14, right: 14 },
  });
  doc.save(filename);
}

// ── Attendance Report ──────────────────────────────────────────────────────────

function AttendanceReport({
  shareholders,
  registrations,
  checkIns,
  agmName,
  activeYear,
  searchQuery,
  statusFilter,
}: {
  shareholders: Shareholder[];
  registrations: Registration[];
  checkIns: CheckIn[];
  agmName: string;
  activeYear: string;
  searchQuery: string;
  statusFilter: "all" | "in-person" | "proxy" | "checked-in" | "not-registered";
}) {
  const rows = buildAttendanceRows(shareholders, registrations, checkIns).filter(
    (row) => {
      const matchesText = matchesSearch(
        [
          row.number,
          row.name,
          statusLabel(row.status),
          row.regType ?? "",
          row.checkInTime ? formatDate(row.checkInTime) : "",
        ],
        searchQuery,
      );
      if (!matchesText) return false;
      if (statusFilter === "all") return true;
      if (statusFilter === "in-person") {
        return row.regType === RegistrationType.InPerson;
      }
      if (statusFilter === "proxy") {
        return row.regType === RegistrationType.Proxy;
      }
      if (statusFilter === "checked-in") {
        return row.status === ShareholderStatus.CheckedIn;
      }
      return row.status === ShareholderStatus.NotRegistered;
    },
  );
  const headers = [
    "Shareholder #",
    "Name",
    "Shareholding",
    "Status",
    "Reg. Type",
    "Check-In Time",
  ];
  const csvRows = rows.map((r) => [
    r.number,
    r.name,
    formatBigInt(r.shareholding),
    statusLabel(r.status),
    r.regType ?? "—",
    r.checkInTime ? formatDate(r.checkInTime) : "—",
  ]);
  const xlsxRows = rows.map((r) => [
    r.number,
    r.name,
    Number(r.shareholding),
    statusLabel(r.status),
    r.regType ?? "—",
    r.checkInTime ? formatDate(r.checkInTime) : "—",
  ]);

  const totalShares = shareholders.reduce(
    (sum, s) => sum + s.shareholding,
    BigInt(0),
  );
  const representedShares = shareholders
    .filter((s) => s.status !== ShareholderStatus.NotRegistered)
    .reduce((sum, s) => sum + s.shareholding, BigInt(0));
  const checkedInCount = shareholders.filter(
    (s) => s.status === ShareholderStatus.CheckedIn,
  ).length;
  const registeredCount = shareholders.filter(
    (s) => s.status !== ShareholderStatus.NotRegistered,
  ).length;

  return (
    <div className="space-y-4" data-ocid="reports.attendance.section">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex gap-3 flex-wrap">
          <StatPill label="Total" value={shareholders.length} />
          <StatPill label="Registered" value={registeredCount} color="green" />
          <StatPill label="Checked In" value={checkedInCount} color="blue" />
          <StatPill
            label="Shares Represented"
            value={Number(representedShares)}
            color="green"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCSV(
                `agm-${activeYear}-attendance-${Date.now()}.csv`,
                csvRows,
                headers,
              )
            }
            data-ocid="reports.attendance.export_csv_button"
            className="gap-2 w-full sm:w-auto"
          >
            <FileText className="w-4 h-4" /> Export CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadXLSX(
                `agm-${activeYear}-attendance-${Date.now()}.xlsx`,
                xlsxRows,
                headers,
              )
            }
            data-ocid="reports.attendance.export_excel_button"
            className="gap-2 w-full sm:w-auto"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadPDF(
                `agm-${activeYear}-attendance-${Date.now()}.pdf`,
                `${agmName} — AGM ${activeYear} Attendance Report`,
                csvRows,
                headers,
              )
            }
            data-ocid="reports.attendance.export_pdf_button"
            className="gap-2 w-full sm:w-auto"
          >
            <Download className="w-4 h-4" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-auto">
        <table className="w-full text-sm min-w-[560px] sm:min-w-[640px]">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.number}
                className="border-t border-border hover:bg-muted/30 transition-colors"
                data-ocid={`reports.attendance.item.${i + 1}`}
              >
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                  {r.number}
                </td>
                <td className="px-3 py-2.5 font-medium">{r.name}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {formatBigInt(r.shareholding)}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {r.regType ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {r.checkInTime ? formatDate(r.checkInTime) : "—"}
                </td>
              </tr>
            ))}
            {/* Summary row */}
            <tr className="border-t-2 border-border bg-muted/40 font-semibold">
              <td className="px-3 py-2.5 text-xs">TOTALS</td>
              <td className="px-3 py-2.5">
                {shareholders.length} shareholders
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {formatBigInt(totalShares)}
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                {registeredCount} reg.
              </td>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                {checkedInCount} checked in
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Proxy Report ───────────────────────────────────────────────────────────────

function ProxyReport({
  shareholders,
  registrations,
  activeYear,
  searchQuery,
}: {
  shareholders: Shareholder[];
  registrations: Registration[];
  activeYear: string;
  searchQuery: string;
}) {
  const shMap = new Map(shareholders.map((s) => [s.id, s]));
  const proxies = registrations
    .filter((r) => r.registrationType === RegistrationType.Proxy)
    .filter((r) =>
      matchesSearch(
        [
          shMap.get(r.shareholderId)?.fullName ?? "",
          shMap.get(r.shareholderId)?.shareholderNumber ?? "",
          r.proxyName ?? "",
          r.proxyContact ?? "",
          proofStatus(r),
        ],
        searchQuery,
      ),
    );
  const headers = [
    "Shareholder",
    "Proxy Name",
    "Proxy Contact",
    "Proof Status",
  ];
  const rows = proxies.map((r) => [
    shMap.get(r.shareholderId)?.fullName ?? r.shareholderId,
    r.proxyName ?? "—",
    r.proxyContact ?? "—",
    proofStatus(r),
  ]);

  const validatedCount = proxies.filter(
    (item) => item.proxyProofValidated,
  ).length;
  const flaggedCount = proxies.filter(
    (item) => item.proxyFraudFlags.length > 0,
  ).length;

  return (
    <div className="space-y-4" data-ocid="reports.proxy.section">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3 flex-wrap">
          <StatPill label="Proxy Registrations" value={proxies.length} />
          <StatPill label="Validated" value={validatedCount} color="green" />
          <StatPill label="Flagged" value={flaggedCount} color="blue" />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCSV(`agm-${activeYear}-proxy_${Date.now()}.csv`, rows, headers)
            }
            data-ocid="reports.proxy.export_csv_button"
            className="gap-2 w-full sm:w-auto"
          >
            <FileText className="w-4 h-4" /> Export CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadXLSX(`agm-${activeYear}-proxy_${Date.now()}.xlsx`, rows, headers)
            }
            data-ocid="reports.proxy.export_excel_button"
            className="gap-2 w-full sm:w-auto"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </Button>
        </div>
      </div>

      {proxies.length === 0 ? (
        <EmptyState icon={Users} message="No proxy registrations found" />
      ) : (
        <div className="rounded-xl border border-border overflow-auto">
          <table className="w-full text-sm min-w-[520px] sm:min-w-[560px]">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {proxies.map((r, i) => (
                <tr
                  key={r.id}
                  className="border-t border-border hover:bg-muted/30 transition-colors"
                  data-ocid={`reports.proxy.item.${i + 1}`}
                >
                  <td className="px-3 py-2.5 font-medium">
                    {shMap.get(r.shareholderId)?.fullName ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">{r.proxyName ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {r.proxyContact ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <ProofBadge reg={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function proofStatus(r: Registration): string {
  if (r.proxyFraudFlags.length > 0) return "Flagged";
  if (r.proxyProofValidated) return "Validated";
  if (r.proxyProofKey) return "Pending";
  return "No Proof";
}

function ProofBadge({ reg }: { reg: Registration }) {
  const s = proofStatus(reg);
  const cls =
    s === "Validated"
      ? "bg-primary/20 text-primary border-primary/30"
      : s === "Flagged"
        ? "bg-destructive/20 text-destructive border-destructive/30"
        : s === "Pending"
          ? "bg-accent/20 text-accent-foreground border-accent/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      {s}
    </span>
  );
}

// ── No-Show Report ─────────────────────────────────────────────────────────────

function NoShowReport({
  shareholders,
  activeYear,
  searchQuery,
}: {
  shareholders: Shareholder[];
  activeYear: string;
  searchQuery: string;
}) {
  const noShows = shareholders
    .filter((s) => s.status === ShareholderStatus.NotRegistered)
    .filter((s) =>
      matchesSearch(
        [s.shareholderNumber, s.fullName, s.tags.join(", ")],
        searchQuery,
      ),
    );
  const pct =
    shareholders.length > 0
      ? ((noShows.length / shareholders.length) * 100).toFixed(1)
      : "0.0";
  const headers = ["Shareholder #", "Name", "Shareholding", "Tags"];
  const rows = noShows.map((s) => [
    s.shareholderNumber,
    s.fullName,
    formatBigInt(s.shareholding),
    s.tags.join(", "),
  ]);

  return (
    <div className="space-y-4" data-ocid="reports.noshow.section">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
            <span className="text-sm font-semibold text-destructive">
              {noShows.length} shareholders did not register ({pct}% of total)
            </span>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadCSV(`agm-${activeYear}-noshow_${Date.now()}.csv`, rows, headers)
          }
          data-ocid="reports.noshow.export_csv_button"
          className="gap-2 w-full sm:w-auto"
        >
          <FileText className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {noShows.length === 0 ? (
        <EmptyState
          icon={XCircle}
          message="All shareholders have registered — excellent turnout!"
        />
      ) : (
        <div className="rounded-xl border border-border overflow-auto">
          <table className="w-full text-sm min-w-[440px] sm:min-w-[480px]">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {noShows.map((s, i) => (
                <tr
                  key={s.id}
                  className="border-t border-border hover:bg-muted/30 transition-colors"
                  data-ocid={`reports.noshow.item.${i + 1}`}
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {s.shareholderNumber}
                  </td>
                  <td className="px-3 py-2.5 font-medium">{s.fullName}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatBigInt(s.shareholding)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {s.tags.join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Badge Generation ───────────────────────────────────────────────────────────

type BadgeFilter = "all" | "in-person" | "proxy";

function BadgeGeneration({
  shareholders,
  registrations,
  agmName,
  activeYear,
  searchQuery,
  onSelectBadge,
}: {
  shareholders: Shareholder[];
  registrations: Registration[];
  agmName: string;
  activeYear: string;
  searchQuery: string;
  onSelectBadge: (shareholderId: string) => void;
}) {
  const [filter, setFilter] = useState<BadgeFilter>("all");
  const regMap = new Map(registrations.map((r) => [r.shareholderId, r]));

  const eligible = shareholders.filter((s) => {
    const reg = regMap.get(s.id);
    if (!reg) return false;
    if (
      !matchesSearch(
        [s.fullName, s.shareholderNumber, reg.verificationCode],
        searchQuery,
      )
    ) {
      return false;
    }
    if (filter === "in-person")
      return reg.registrationType === RegistrationType.InPerson;
    if (filter === "proxy")
      return reg.registrationType === RegistrationType.Proxy;
    return true;
  });

  function generateBadges() {
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>AGM Badges – ${agmName}</title>
<style>
  @media print { body { margin: 0; } }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0fdf4; }
  .page { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px; }
  .badge {
    width: 240px; height: 300px; border: 2.5px solid #16a34a; border-radius: 14px;
    background: #fff; padding: 20px; display: flex; flex-direction: column;
    align-items: center; justify-content: space-between; box-shadow: 0 2px 8px rgba(22,163,74,0.15);
    page-break-inside: avoid;
  }
  .badge-header { text-align: center; }
  .badge-title { font-size: 11px; font-weight: 700; color: #16a34a; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
  .badge-agm { font-size: 13px; font-weight: 700; color: #166534; text-align: center; line-height: 1.3; }
  .badge-name { font-size: 17px; font-weight: 800; color: #14532d; text-align: center; margin: 8px 0 4px; }
  .badge-number { font-size: 11px; color: #16a34a; font-family: monospace; letter-spacing: 0.05em; }
  .qr-placeholder { width: 80px; height: 80px; border: 2px dashed #16a34a; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #16a34a; text-align: center; padding: 4px; }
  .badge-code { font-size: 10px; color: #64748b; font-family: monospace; }
  .badge-type { font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 12px; text-transform: uppercase; }
  .type-inperson { background: #dcfce7; color: #16a34a; }
  .type-proxy { background: #fef9c3; color: #854d0e; }
</style>
</head>
<body>
<div class="page">${eligible
      .map((s) => {
        const reg = regMap.get(s.id)!;
        const isProxy = reg.registrationType === RegistrationType.Proxy;
        return `<div class="badge">
  <div class="badge-header">
    <div class="badge-title">Annual General Meeting</div>
    <div class="badge-agm">${agmName} · AGM ${activeYear}</div>
  </div>
  <div style="text-align:center">
    <div class="badge-name">${s.fullName}</div>
    <div class="badge-number">${s.shareholderNumber}</div>
  </div>
  <div class="qr-placeholder">QR\n${s.shareholderNumber}</div>
  <div style="text-align:center">
    <div class="badge-code">Code: ${reg.verificationCode}</div>
    <div class="badge-type ${isProxy ? "type-proxy" : "type-inperson"}">${isProxy ? "Proxy" : "In Person"}</div>
  </div>
</div>`;
      })
      .join("\n")}
</div>
</body>
</html>`;
    const win = window.open("", "_blank", "width=900,height=700");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
  }

  return (
    <div className="space-y-5" data-ocid="reports.badges.section">
      <div className="flex gap-3 flex-wrap items-center justify-between">
        <fieldset className="flex gap-2" aria-label="Badge filter">
          {(["all", "in-person", "proxy"] as BadgeFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] border transition-smooth capitalize ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:bg-muted"
              }`}
              data-ocid={`reports.badges.filter.${f.replace("-", "_")}_toggle`}
            >
              {f === "all"
                ? "All Registered"
                : f === "in-person"
                  ? "In Person"
                  : "Proxy"}
            </button>
          ))}
        </fieldset>
        <Button
          onClick={generateBadges}
          disabled={eligible.length === 0}
          className="gap-2 min-h-[44px]"
          data-ocid="reports.badges.generate_button"
        >
          <Printer className="w-4 h-4" />
          Generate {eligible.length} Badge{eligible.length !== 1 ? "s" : ""}
        </Button>
      </div>

      {eligible.length === 0 ? (
        <EmptyState
          icon={Award}
          message="No registered shareholders match this filter"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {eligible.slice(0, 8).map((s) => {
            const reg = regMap.get(s.id)!;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectBadge(s.id)}
                className="rounded-xl border-2 border-primary/30 bg-card p-3 flex flex-col items-center gap-1.5 text-center hover:bg-muted/30"
                data-ocid={`reports.badges.item.${s.id}`}
              >
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                  AGM Badge
                </span>
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-primary font-bold text-lg">
                    {s.fullName.slice(0, 1)}
                  </span>
                </div>
                <p className="text-sm font-bold text-foreground truncate w-full">
                  {s.fullName}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {s.shareholderNumber}
                </p>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    reg.registrationType === RegistrationType.InPerson
                      ? "bg-primary/20 text-primary"
                      : "bg-accent/30 text-accent-foreground"
                  }`}
                >
                  {reg.registrationType}
                </span>
              </button>
            );
          })}
          {eligible.length > 8 && (
            <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-3 flex items-center justify-center">
              <p className="text-sm text-muted-foreground text-center">
                +{eligible.length - 8} more badges
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Post-AGM Insights ──────────────────────────────────────────────────────────

function PostAGMInsights({
  shareholders,
  registrations,
  checkIns,
  agmName,
  activeYear,
  quorumThreshold,
}: {
  shareholders: Shareholder[];
  registrations: Registration[];
  checkIns: CheckIn[];
  agmName: string;
  activeYear: string;
  quorumThreshold: bigint;
}) {
  const total = shareholders.length;
  const registered = registrations.length;
  const checkedIn = checkIns.length;
  const noShow = total - registered;
  const attendanceRate =
    total > 0 ? ((registered / total) * 100).toFixed(1) : "0.0";
  const checkInRate =
    registered > 0 ? ((checkedIn / registered) * 100).toFixed(1) : "0.0";
  const totalShares = shareholders.reduce(
    (s, sh) => s + sh.shareholding,
    BigInt(0),
  );
  const registeredShares = shareholders
    .filter((s) => s.status !== ShareholderStatus.NotRegistered)
    .reduce((s, sh) => s + sh.shareholding, BigInt(0));
  const quorumNeeded =
    Number(totalShares) * (Number(quorumThreshold || BigInt(0)) / 100);
  const quorumMet = Number(registeredShares) >= quorumNeeded;

  async function downloadFullReport() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { jsPDF } = await import("jspdf" as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { default: autoTable } = await import("jspdf-autotable" as any);
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(22, 101, 52);
    doc.text(`${agmName}`, 14, 20);
    doc.setFontSize(14);
    doc.setTextColor(50);
    doc.text("Post-AGM Insights Report", 14, 30);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 38);

    autoTable(doc, {
      head: [["Metric", "Value"]],
      body: [
        ["Total Shareholders", total.toString()],
        ["Registered", registered.toString()],
        ["Checked In", checkedIn.toString()],
        ["No-Shows", noShow.toString()],
        ["Attendance Rate", `${attendanceRate}%`],
        ["Check-In Rate (of registered)", `${checkInRate}%`],
        ["Total Shares", formatBigInt(totalShares)],
        ["Shares Represented", formatBigInt(registeredShares)],
        ["Quorum Status", quorumMet ? "MET ✓" : "NOT MET ✗"],
      ],
      startY: 44,
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [22, 101, 52], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
    });
    doc.save(`agm-${activeYear}-post_agm_insights_${Date.now()}.pdf`);
  }

  return (
    <div className="space-y-6" data-ocid="reports.insights.section">
      <div className="flex justify-end">
        <Button
          onClick={downloadFullReport}
          className="gap-2 min-h-[44px]"
          data-ocid="reports.insights.download_report_button"
        >
          <Download className="w-4 h-4" /> Download Post-AGM Report
        </Button>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <InsightCard
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          sub={`${registered}/${total} registered`}
          highlight
        />
        <InsightCard
          label="Check-In Rate"
          value={`${checkInRate}%`}
          sub={`${checkedIn} checked in`}
        />
        <InsightCard
          label="No-Shows"
          value={noShow.toString()}
          sub={`${total > 0 ? ((noShow / total) * 100).toFixed(1) : 0}% absent`}
        />
        <InsightCard
          label="Quorum"
          value={quorumMet ? "Met ✓" : "Not Met"}
          sub={"≥10% shares needed"}
          highlight={quorumMet}
        />
      </div>

      {/* Shares breakdown */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-display font-semibold text-sm text-foreground">
          Shares Represented
        </h3>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">Represented</span>
          <span className="font-semibold tabular-nums">
            {formatBigInt(registeredShares)}
          </span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-700 rounded-full"
            style={{
              width: `${
                Number(totalShares) > 0
                  ? Math.min(
                      100,
                      (Number(registeredShares) / Number(totalShares)) * 100,
                    )
                  : 0
              }%`,
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span>Total: {formatBigInt(totalShares)}</span>
        </div>
      </div>

      {/* Comparison bar chart */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-display font-semibold text-sm text-foreground">
          Attendance Funnel
        </h3>
        {[
          { label: "Total Shareholders", count: total, color: "bg-muted" },
          { label: "Registered", count: registered, color: "bg-primary/60" },
          { label: "Checked In", count: checkedIn, color: "bg-primary" },
          { label: "No-Show", count: noShow, color: "bg-destructive/50" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-36 shrink-0">
              {item.label}
            </span>
            <div className="flex-1 h-5 bg-muted/40 rounded-full overflow-hidden">
              <div
                className={`h-full ${item.color} rounded-full transition-all duration-700`}
                style={{
                  width: `${total > 0 ? (item.count / total) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums w-10 text-right">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared UI sub-components ───────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color = "default",
}: { label: string; value: number; color?: "default" | "green" | "blue" }) {
  const cls =
    color === "green"
      ? "bg-primary/15 text-primary border-primary/25"
      : color === "blue"
        ? "bg-accent/15 text-accent-foreground border-accent/25"
        : "bg-muted text-muted-foreground border-border";
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${cls}`}
    >
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="opacity-70">{label}</span>
    </div>
  );
}

function InsightCard({
  label,
  value,
  sub,
  highlight = false,
}: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? "border-primary/40 bg-primary/10" : "border-border bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p
        className={`text-2xl font-display font-bold ${highlight ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ShareholderStatus }) {
  const cls: Record<string, string> = {
    NotRegistered: "bg-muted text-muted-foreground border-border",
    RegisteredInPerson: "bg-primary/20 text-primary border-primary/30",
    RegisteredProxy: "bg-accent/20 text-accent-foreground border-accent/30",
    CheckedIn: "bg-primary/30 text-primary border-primary/40",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls[status] ?? "bg-muted text-muted-foreground border-border"}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  message,
}: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { activeYear } = useAgmYear();
  const recordAuditEvent = useRecordAuditEvent();
  const [reportSearch, setReportSearch] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState<
    "all" | "in-person" | "proxy" | "checked-in" | "not-registered"
  >("all");
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);
  const { data: shareholders = [], isLoading: loadSh } = useAllShareholders();
  const { data: registrations = [], isLoading: loadReg } =
    useAllRegistrations();
  const { data: checkIns = [], isLoading: loadCI } = useAllCheckIns();
  const { data: auditEntries = [] } = useAuditLogForExport();
  const { data: settings } = useSettings();
  const agmName = settings?.agmName ?? "AGM Pro";
  const quorumThreshold = settings?.quorumThreshold ?? BigInt(10);
  const isLoading = loadSh || loadReg || loadCI;
  const registrationsForYear = filterRegistrationsByYear(registrations, activeYear);
  const checkInsForYear = filterCheckInsByRegistrations(checkIns, registrationsForYear);
  const shareholdersForYear = buildYearScopedShareholders(
    shareholders,
    registrationsForYear,
    checkInsForYear,
  );
  const badgeRegistrationMap = new Map(
    registrationsForYear.map((registration) => [registration.shareholderId, registration]),
  );
  const selectedBadgeShareholder =
    shareholdersForYear.find((shareholder) => shareholder.id === selectedBadgeId) ?? null;
  const selectedBadgeRegistration = selectedBadgeId
    ? badgeRegistrationMap.get(selectedBadgeId) ?? null
    : null;

  const exportYearlySummary = (
    kind: "attendance" | "proxy" | "audit" | "comparison",
  ) => {
    if (kind === "attendance") {
      const rows = shareholdersForYear.map((shareholder) => [
        activeYear,
        shareholder.shareholderNumber,
        shareholder.fullName,
        statusLabel(shareholder.status),
      ]);
      downloadCSV(
        `agm-${activeYear}-yearly-attendance-summary.csv`,
        rows,
        ["AGM Year", "Member Number", "Name", "Status"],
      );
    } else if (kind === "proxy") {
      const rows = registrationsForYear
        .filter((registration) => registration.registrationType === RegistrationType.Proxy)
        .map((registration) => {
          const shareholder = shareholdersForYear.find(
            (item) => item.id === registration.shareholderId,
          );
          return [
            activeYear,
            shareholder?.shareholderNumber ?? "",
            shareholder?.fullName ?? registration.shareholderId,
            registration.proxyName ?? "",
            registration.proxyContact ?? "",
            proofStatus(registration),
          ];
        });
      downloadCSV(
        `agm-${activeYear}-yearly-proxy-summary.csv`,
        rows,
        ["AGM Year", "Member Number", "Shareholder", "Proxy Name", "Proxy Contact", "Proof Status"],
      );
    } else if (kind === "audit") {
      const rows = auditEntries
        .filter((entry) =>
          entry.details.toLowerCase().includes(`agm year: ${activeYear.toLowerCase()}`) ||
          entry.details.toLowerCase().includes(`agm ${activeYear.toLowerCase()}`),
        )
        .map((entry) => [
          activeYear,
          entry.action,
          entry.entityType,
          entry.entityId,
          entry.performedBy,
          formatDate(entry.performedAt),
          entry.details,
        ]);
      downloadCSV(
        `agm-${activeYear}-yearly-audit-summary.csv`,
        rows,
        ["AGM Year", "Action", "Entity Type", "Entity ID", "Performed By", "Performed At", "Details"],
      );
    } else {
      const years = [...new Set(registrations.map((registration) => {
        const notes = parseRegistrationNotes(registration.notes);
        return notes["AGM Year"] ?? "Unknown";
      }))].sort();
      const rows = years.map((year) => {
        const yearRegs = filterRegistrationsByYear(registrations, year);
        const yearCheckIns = filterCheckInsByRegistrations(checkIns, yearRegs);
        const yearShareholders = buildYearScopedShareholders(
          shareholders,
          yearRegs,
          yearCheckIns,
        );
        return [
          year,
          yearShareholders.length,
          yearRegs.length,
          yearRegs.filter((item) => item.registrationType === RegistrationType.Proxy).length,
          yearCheckIns.length,
        ];
      });
      downloadCSV(
        `agm-year-comparison-report.csv`,
        rows.map((row) => row.map(String)),
        ["AGM Year", "Total Shareholders", "Registered", "Proxies", "Checked In"],
      );
    }

    void recordAuditEvent.mutateAsync({
      action: "EXPORT_REPORT",
      entityType: "report",
      entityId: kind,
      details: `Exported ${kind} summary for AGM ${activeYear}`,
    });
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6" data-ocid="reports.page">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">
              Reports & Analytics
            </h1>
            <p className="text-sm text-muted-foreground">{agmName} · AGM {activeYear}</p>
          </div>
          <div className="ml-auto w-full max-w-[180px]">
            <AgmYearSwitcher compact />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Button variant="outline" onClick={() => exportYearlySummary("attendance")}>
            Yearly Attendance Summary
          </Button>
          <Button variant="outline" onClick={() => exportYearlySummary("proxy")}>
            Yearly Proxy Summary
          </Button>
          <Button variant="outline" onClick={() => exportYearlySummary("audit")}>
            Yearly Audit Summary
          </Button>
          <Button variant="outline" onClick={() => exportYearlySummary("comparison")}>
            Year Comparison Report
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3" data-ocid="reports.loading_state">
            {[...Array(4)].map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton loader
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="attendance" data-ocid="reports.tabs">
            <div className="rounded-xl border border-border bg-card p-4 mb-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  placeholder="Search reports by name, member number, proxy, code, or status"
                  className="pl-9 min-h-[44px]"
                  data-ocid="reports.search_input"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {[
                  { value: "all", label: "All" },
                  { value: "in-person", label: "In Person" },
                  { value: "proxy", label: "Proxy" },
                  { value: "checked-in", label: "Checked In" },
                  { value: "not-registered", label: "Not Registered" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() =>
                      setAttendanceFilter(
                        item.value as
                          | "all"
                          | "in-person"
                          | "proxy"
                          | "checked-in"
                          | "not-registered",
                      )
                    }
                    className={`min-h-[40px] whitespace-nowrap border px-4 text-sm font-medium ${
                      attendanceFilter === item.value
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                    data-ocid={`reports.filter.${item.value}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <TabsList className="flex w-full h-auto gap-1 overflow-x-auto bg-muted/50 p-1 sm:grid sm:grid-cols-5">
              <TabsTrigger
                value="attendance"
                data-ocid="reports.attendance.tab"
                className="text-xs sm:text-sm min-h-[40px] shrink-0"
              >
                Attendance
              </TabsTrigger>
              <TabsTrigger
                value="proxy"
                data-ocid="reports.proxy.tab"
                className="text-xs sm:text-sm min-h-[40px] shrink-0"
              >
                Proxy
              </TabsTrigger>
              <TabsTrigger
                value="noshow"
                data-ocid="reports.noshow.tab"
                className="text-xs sm:text-sm min-h-[40px] shrink-0"
              >
                No-Show
              </TabsTrigger>
              <TabsTrigger
                value="badges"
                data-ocid="reports.badges.tab"
                className="text-xs sm:text-sm min-h-[40px] shrink-0"
              >
                Badges
              </TabsTrigger>
              <TabsTrigger
                value="insights"
                data-ocid="reports.insights.tab"
                className="text-xs sm:text-sm min-h-[40px] shrink-0"
              >
                Insights
              </TabsTrigger>
            </TabsList>

            <TabsContent value="attendance" className="mt-4">
              <SectionCard title="Attendance Report" icon={Users}>
                <AttendanceReport
                  shareholders={shareholdersForYear}
                  registrations={registrationsForYear}
                  checkIns={checkInsForYear}
                  agmName={agmName}
                  activeYear={activeYear}
                  searchQuery={reportSearch}
                  statusFilter={attendanceFilter}
                />
              </SectionCard>
            </TabsContent>

            <TabsContent value="proxy" className="mt-4">
              <SectionCard title="Proxy Report" icon={AlertTriangle}>
                <ProxyReport
                  shareholders={shareholdersForYear}
                  registrations={registrationsForYear}
                  activeYear={activeYear}
                  searchQuery={reportSearch}
                />
              </SectionCard>
            </TabsContent>

            <TabsContent value="noshow" className="mt-4">
              <SectionCard title="No-Show Report" icon={XCircle}>
                <NoShowReport
                  shareholders={shareholdersForYear}
                  activeYear={activeYear}
                  searchQuery={reportSearch}
                />
              </SectionCard>
            </TabsContent>

            <TabsContent value="badges" className="mt-4">
              <SectionCard title="Badge Generation" icon={Award}>
                <BadgeGeneration
                  shareholders={shareholdersForYear}
                  registrations={registrationsForYear}
                  agmName={agmName}
                  activeYear={activeYear}
                  searchQuery={reportSearch}
                  onSelectBadge={setSelectedBadgeId}
                />
              </SectionCard>
            </TabsContent>

            <TabsContent value="insights" className="mt-4">
              <SectionCard title="Post-AGM Insights" icon={BarChart3}>
                <PostAGMInsights
                  shareholders={shareholdersForYear}
                  registrations={registrationsForYear}
                  checkIns={checkInsForYear}
                  agmName={agmName}
                  activeYear={activeYear}
                  quorumThreshold={quorumThreshold}
                />
              </SectionCard>
            </TabsContent>
          </Tabs>
        )}

        <Dialog
          open={!!selectedBadgeShareholder && !!selectedBadgeRegistration}
          onOpenChange={(open) => !open && setSelectedBadgeId(null)}
        >
          <DialogContent className="max-w-lg" data-ocid="reports.badges.detail_dialog">
            <DialogHeader>
              <DialogTitle className="font-display">Badge Details</DialogTitle>
            </DialogHeader>
            {selectedBadgeShareholder && selectedBadgeRegistration && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Shareholder
                    </p>
                    <p className="font-semibold text-foreground">
                      {selectedBadgeShareholder.fullName}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Member Number
                    </p>
                    <p className="font-mono text-foreground">
                      {selectedBadgeShareholder.shareholderNumber}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Verification Code
                    </p>
                    <p className="font-mono text-primary break-all">
                      {selectedBadgeRegistration.verificationCode}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Registration Type
                    </p>
                    <p className="text-foreground">
                      {selectedBadgeRegistration.registrationType}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Status
                    </p>
                    <p className="text-foreground">
                      {statusLabel(selectedBadgeShareholder.status)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Shares
                    </p>
                    <p className="text-foreground">
                      {formatBigInt(selectedBadgeShareholder.shareholding)}
                    </p>
                  </div>
                </div>
                {selectedBadgeRegistration.registrationType === RegistrationType.Proxy && (
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Proxy Details
                    </p>
                    <p className="text-foreground">
                      Proxy Name: {selectedBadgeRegistration.proxyName ?? "Not provided"}
                    </p>
                    <p className="text-foreground">
                      Proxy Contact: {selectedBadgeRegistration.proxyContact ?? "Not provided"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 lg:p-6 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="font-display font-semibold text-base text-foreground">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

import { RegistrationType, ShareholderStatus } from "@/types";
import type { CheckIn, Registration, Shareholder } from "@/types";
import { AgmYearSwitcher } from "@/components/AgmYearSwitcher";
import { Layout } from "@/components/Layout";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useAgmYear } from "@/context/AgmYearContext";
import { useToast } from "@/context/ToastContext";
import {
  useAllCheckIns,
  useAllRegistrations,
  useAllShareholders,
  useCancelRegistration,
  useRecordAuditEvent,
  useUndoCheckIn,
  useUpdateRegistration,
} from "@/hooks/use-backend";
import {
  buildYearScopedShareholders,
  filterCheckInsByRegistrations,
  filterRegistrationsByYear,
} from "@/lib/agm-year";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Download,
  FileText,
  IdCard,
  Image as ImageIcon,
  Phone,
  CheckSquare,
  Trash2,
  Search,
  ShieldCheck,
  Square,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ElementType } from "react";
import { parseRegistrationNotes } from "./registration/registration-form-utils";
import { createThumbnailDataUrl } from "./registration/ProxyForm";

type RegisteredRecord = {
  id: string;
  shareholderId: string;
  registrationId: string;
  fullName: string;
  shareholderNumber: string;
  status: ShareholderStatus;
  registrationType: RegistrationType;
  verificationCode: string;
  registeredAt: bigint;
  checkedInAt?: bigint;
  registeredBy: string;
  checkedInBy: string;
  agmDate: string;
  agmYear: string;
  timeOfCheckIn: string;
  chitNumber: string;
  telephoneNumber: string;
  ghanaCardId: string;
  ghanaCardVerification: string;
  shareholderContactNumber: string;
  proxyName: string;
  proxyContactNumber: string;
  proxyGhanaCardId: string;
  proxyGhanaCardVerification: string;
  proofFile: string;
  proofPreview: string;
  consentAccepted: string;
  rawNotes: string;
};

function formatTimestamp(value?: bigint) {
  if (!value) return "Not checked in";
  return new Date(Number(value) / 1_000_000).toLocaleString();
}

function replaceRegistrationNote(
  notes: string | undefined,
  label: string,
  value: string,
) {
  const lines = (notes ?? "")
    .split("\n")
    .filter((line) => line.trim().length > 0);
  const nextLine = `${label}: ${value}`;
  const index = lines.findIndex((line) => line.startsWith(`${label}:`));
  if (index >= 0) {
    lines[index] = nextLine;
  } else {
    lines.push(nextLine);
  }
  return lines.join("\n");
}

function exportRegisteredCsv(items: RegisteredRecord[], agmYear: string) {
  const headers = [
    "Member Number",
    "Full Name",
    "Registration Type",
    "Status",
    "Contact Number",
    "Ghana Card ID",
    "Ghana Card Verification",
    "Shareholder Contact Number",
    "Proxy Name",
    "Proxy Contact Number",
    "Proxy Ghana Card ID",
    "Proxy Ghana Card Verification",
    "Verification Code",
    "Chit Number",
    "AGM Year",
    "Time of Check-in",
    "Registered By",
    "Checked In By",
    "Proof File",
    "Consent Accepted",
    "Registered At",
    "Checked In At",
  ];

  const rows = items.map((item) => [
    item.shareholderNumber,
    item.fullName,
    item.registrationType === RegistrationType.Proxy ? "Proxy" : "In Person",
    item.status,
    item.telephoneNumber,
    item.ghanaCardId,
    item.ghanaCardVerification,
    item.shareholderContactNumber,
    item.proxyName,
    item.proxyContactNumber,
    item.proxyGhanaCardId,
    item.proxyGhanaCardVerification,
    item.verificationCode,
    item.chitNumber,
    item.agmYear,
    item.timeOfCheckIn,
    item.registeredBy,
    item.checkedInBy,
    item.proofFile,
    item.consentAccepted,
    formatTimestamp(item.registeredAt),
    formatTimestamp(item.checkedInAt),
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agm-${agmYear}-registered-shareholders-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function exportRegisteredPdf(
  items: RegisteredRecord[],
  agmYear: string,
  summary: {
    total: number;
    inPerson: number;
    proxy: number;
    checkedIn: number;
  },
) {
  const jspdfModule = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const { jsPDF } = jspdfModule;
  const autoTable =
    autoTableModule.default ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (autoTableModule as any).autoTable;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(18, 28, 46);
  doc.rect(0, 0, pageWidth, 86, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("Registered Shareholders Report", 40, 42);
  doc.setFontSize(10);
  doc.setTextColor(196, 208, 226);
  doc.text(`AGM ${agmYear}`, pageWidth - 120, 42);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 62);

  const summaryCards = [
    ["Registered", summary.total.toLocaleString()],
    ["In Person", summary.inPerson.toLocaleString()],
    ["Proxy", summary.proxy.toLocaleString()],
    ["Checked In", summary.checkedIn.toLocaleString()],
  ];

  let cardX = 40;
  for (const [label, value] of summaryCards) {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(cardX, 106, 150, 56, 8, 8, "F");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(10);
    doc.text(label, cardX + 14, 126);
    doc.setTextColor(18, 28, 46);
    doc.setFontSize(18);
    doc.text(value, cardX + 14, 148);
    cardX += 162;
  }

  const headers = [
    "Member No",
    "Name",
    "Type",
    "Contact",
    "Proxy Name",
    "Verification Code",
    "Ghana Card",
    "Recorded By",
    "Checked In",
  ];

  const rows = items.map((item) => [
    item.shareholderNumber,
    item.fullName,
    item.registrationType === RegistrationType.Proxy ? "Proxy" : "In Person",
    item.telephoneNumber || item.shareholderContactNumber || item.proxyContactNumber || "Not provided",
    item.proxyName || "—",
    item.verificationCode,
    item.registrationType === RegistrationType.Proxy
      ? item.proxyGhanaCardId || "Not provided"
      : item.ghanaCardId || "Not provided",
    item.registeredBy || "System",
    formatTimestamp(item.checkedInAt),
  ]);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 186,
    margin: { left: 40, right: 40, bottom: 30 },
    styles: {
      fontSize: 9,
      cellPadding: 6,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    bodyStyles: {
      valign: "middle",
    },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Page ${pageCount}`,
        doc.internal.pageSize.getWidth() - 70,
        doc.internal.pageSize.getHeight() - 14,
      );
    },
  });

  doc.save(`agm-${agmYear}-registered-shareholders-${Date.now()}.pdf`);
}

function buildRegisteredRecords(
  shareholders: Shareholder[],
  registrations: Registration[],
  checkIns: CheckIn[],
): RegisteredRecord[] {
  const shareholderMap = new Map(shareholders.map((item) => [item.id, item]));
  const checkInMap = new Map(checkIns.map((item) => [item.registrationId, item]));

  return registrations.reduce<RegisteredRecord[]>((accumulator, registration) => {
      const shareholder = shareholderMap.get(registration.shareholderId);
      if (!shareholder) return accumulator;

      const notes = parseRegistrationNotes(registration.notes);
      const checkIn = checkInMap.get(registration.id);

      accumulator.push({
        id: registration.id,
        shareholderId: shareholder.id,
        registrationId: registration.id,
        fullName: shareholder.fullName,
        shareholderNumber: shareholder.shareholderNumber,
        status: shareholder.status,
        registrationType: registration.registrationType,
        verificationCode: registration.verificationCode,
        registeredAt: registration.registeredAt,
        checkedInAt: checkIn?.checkedInAt,
        registeredBy: registration.registeredBy ?? "",
        checkedInBy: checkIn?.checkedInBy ?? "",
        agmDate: notes["AGM Date"] ?? "",
        agmYear: notes["AGM Year"] ?? "",
        timeOfCheckIn:
          notes["Automatic Check-In Time"] ?? notes["Time of Check-in"] ?? "",
        chitNumber: notes["Chit Number"] ?? shareholder.shareholderNumber,
        telephoneNumber:
          notes["Contact Number"] ?? notes["Telephone Number"] ?? "",
        ghanaCardId: notes["Ghana Card ID Number"] ?? "",
        ghanaCardVerification: notes["Ghana Card Verification"] ?? "",
        shareholderContactNumber: notes["Shareholder Contact Number"] ?? "",
        proxyName:
          notes["Name of Proxy"] ?? registration.proxyName ?? "",
        proxyContactNumber:
          notes["Proxy Contact Number"] ?? registration.proxyContact ?? "",
        proxyGhanaCardId: notes["Proxy Ghana Card ID Number"] ?? "",
        proxyGhanaCardVerification:
          notes["Proxy Ghana Card Verification"] ?? "",
        proofFile: notes["Proof File"] ?? registration.proxyProofKey ?? "",
        proofPreview: notes["Proof Preview"] ?? "",
        consentAccepted: notes["Consent Accepted"] ?? "",
        rawNotes: registration.notes ?? "",
      });
      return accumulator;
    }, []).sort((left, right) => left.fullName.localeCompare(right.fullName));
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className="mt-1 text-sm font-medium text-foreground break-words">
        {value || "Not provided"}
      </p>
    </div>
  );
}

function RegistrationDetails({
  record,
  onPreviewProof,
}: {
  record: RegisteredRecord;
  onPreviewProof: (preview: string) => void;
}) {
  const isProxy = record.registrationType === RegistrationType.Proxy;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DetailItem icon={ShieldCheck} label="Verification Code" value={record.verificationCode} />
        <DetailItem icon={ShieldCheck} label="Chit Number" value={record.chitNumber} />
        <DetailItem icon={CalendarDays} label="AGM Year" value={record.agmYear} />
        <DetailItem icon={CalendarDays} label="Automatic Check-In Time" value={record.timeOfCheckIn} />
      </div>

      <div className="rounded-xl border border-border bg-muted/10 p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Registration Record
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <DetailItem icon={Users} label="Registered By" value={record.registeredBy} />
          <DetailItem icon={Users} label="Checked In By" value={record.checkedInBy} />
          <DetailItem icon={ShieldCheck} label="Consent Accepted" value={record.consentAccepted} />
          <DetailItem icon={CalendarDays} label="Registered At" value={formatTimestamp(record.registeredAt)} />
          <DetailItem icon={CalendarDays} label="Checked In At" value={formatTimestamp(record.checkedInAt)} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/10 p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {isProxy ? "Proxy Attendance Details" : "Attendee Details"}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {!isProxy ? (
            <>
              <DetailItem icon={Phone} label="Contact Number" value={record.telephoneNumber} />
              <DetailItem icon={IdCard} label="Ghana Card ID" value={record.ghanaCardId} />
              <DetailItem icon={ShieldCheck} label="Ghana Card Verification" value={record.ghanaCardVerification} />
            </>
          ) : (
            <>
              <DetailItem icon={Phone} label="Shareholder Contact Number" value={record.shareholderContactNumber} />
              <DetailItem icon={Users} label="Proxy Name" value={record.proxyName} />
              <DetailItem icon={Phone} label="Proxy Contact Number" value={record.proxyContactNumber} />
              <DetailItem icon={IdCard} label="Proxy Ghana Card ID" value={record.proxyGhanaCardId} />
              <DetailItem icon={ShieldCheck} label="Proxy Ghana Card Verification" value={record.proxyGhanaCardVerification} />
              <DetailItem icon={ShieldCheck} label="Proof File" value={record.proofFile} />
            </>
          )}
        </div>
        {isProxy && record.proofPreview.startsWith("data:image/") && (
          <div className="mt-3 rounded-xl border border-border bg-card/70 p-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <ImageIcon className="w-3.5 h-3.5" />
              Proxy Proof Thumbnail
            </div>
            <button
              type="button"
              className="mt-2 border border-border bg-background"
              onClick={() => onPreviewProof(record.proofPreview)}
            >
              <img
                src={record.proofPreview}
                alt="Proxy proof thumbnail"
                className="h-24 w-24 object-cover"
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShareholdersPage() {
  const { activeYear, yearOptions } = useAgmYear();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: shareholders = [], isLoading: shareholdersLoading } =
    useAllShareholders();
  const { data: registrations = [], isLoading: registrationsLoading } =
    useAllRegistrations();
  const { data: checkIns = [], isLoading: checkInsLoading } = useAllCheckIns();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "in-person" | "proxy">(
    "all",
  );
  const [selectedRecord, setSelectedRecord] = useState<RegisteredRecord | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [transferYear, setTransferYear] = useState("");
  const cancelRegistration = useCancelRegistration();
  const undoCheckIn = useUndoCheckIn();
  const updateRegistration = useUpdateRegistration();
  const recordAuditEvent = useRecordAuditEvent();

  const isLoading =
    shareholdersLoading || registrationsLoading || checkInsLoading;

  const registrationsForYear = filterRegistrationsByYear(registrations, activeYear);
  const checkInsForYear = filterCheckInsByRegistrations(checkIns, registrationsForYear);
  const scopedShareholders = buildYearScopedShareholders(
    shareholders,
    registrationsForYear,
    checkInsForYear,
  );

  const registeredRecords = useMemo(
    () => buildRegisteredRecords(scopedShareholders, registrationsForYear, checkInsForYear),
    [scopedShareholders, registrationsForYear, checkInsForYear],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return registeredRecords.filter((item) => {
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "in-person" &&
          item.registrationType === RegistrationType.InPerson) ||
        (typeFilter === "proxy" &&
          item.registrationType === RegistrationType.Proxy);

      const haystack = [
        item.fullName,
        item.shareholderNumber,
        item.telephoneNumber,
        item.ghanaCardId,
        item.shareholderContactNumber,
        item.proxyName,
        item.proxyContactNumber,
        item.proxyGhanaCardId,
        item.verificationCode,
        item.chitNumber,
      ]
        .join(" ")
        .toLowerCase();

      return matchesType && (!normalizedSearch || haystack.includes(normalizedSearch));
    });
  }, [registeredRecords, search, typeFilter]);

  const stats = useMemo(
    () => ({
      total: registeredRecords.length,
      inPerson: registeredRecords.filter(
        (item) => item.registrationType === RegistrationType.InPerson,
      ).length,
      proxy: registeredRecords.filter(
        (item) => item.registrationType === RegistrationType.Proxy,
      ).length,
      checkedIn: registeredRecords.filter(
        (item) => item.status === ShareholderStatus.CheckedIn,
      ).length,
    }),
    [registeredRecords],
  );

  const allVisibleSelected =
    filteredRecords.length > 0 &&
    filteredRecords.every((item) => selectedIds.includes(item.id));

  const selectedCount = selectedIds.length;
  const canAdminLifecycle =
    user?.role === "SuperAdmin" || user?.role === "Admin";

  async function handleRemoveRegistration(record: RegisteredRecord) {
    await cancelRegistration.mutateAsync({
      id: record.registrationId,
      reason: "Removed from registered shareholder list",
    });
    await recordAuditEvent.mutateAsync({
      action: "DELETE_SHAREHOLDER_REGISTRATION",
      entityType: "shareholder",
      entityId: record.shareholderId,
      details: `Removed registered shareholder record for AGM ${record.agmYear || activeYear}`,
    });
    setSelectedRecord(null);
    setPreviewImage(null);
    setSelectedIds((current) => current.filter((id) => id !== record.id));
  }

  async function handleRemoveSelected() {
    const targets = registeredRecords.filter((item) => selectedIds.includes(item.id));
    for (const record of targets) {
      await cancelRegistration.mutateAsync({
        id: record.registrationId,
        reason: "Removed from registered shareholder list",
      });
    }
    if (targets.length > 0) {
      await recordAuditEvent.mutateAsync({
        action: "DELETE_SHAREHOLDER_REGISTRATION",
        entityType: "shareholder",
        entityId: "*",
        details: `Removed ${targets.length} registered shareholder record(s) for AGM ${activeYear}`,
      });
    }
    setSelectedIds([]);
    setSelectedRecord(null);
    setPreviewImage(null);
  }

  async function handleReverseCheckIn(record: RegisteredRecord) {
    try {
      await undoCheckIn.mutateAsync(record.shareholderId);
      await recordAuditEvent.mutateAsync({
        action: "REVERSE_AUTO_CHECKIN",
        entityType: "registration",
        entityId: record.registrationId,
        details: `Reversed automatic check-in for AGM ${record.agmYear || activeYear}`,
      });
      showToast("Automatic check-in reversed", "success");
    } catch {
      showToast("Failed to reverse automatic check-in", "error");
    }
  }

  async function handleTransferYear(record: RegisteredRecord) {
    if (!transferYear || transferYear === record.agmYear) return;
    try {
      await updateRegistration.mutateAsync({
        id: record.registrationId,
        updates: {
          notes: replaceRegistrationNote(record.rawNotes, "AGM Year", transferYear),
        },
      });
      await recordAuditEvent.mutateAsync({
        action: "TRANSFER_REGISTRATION_YEAR",
        entityType: "registration",
        entityId: record.registrationId,
        details: `Transferred registration from AGM ${record.agmYear || activeYear} to AGM ${transferYear}`,
      });
      setTransferYear("");
      setSelectedRecord(null);
      showToast(`Moved registration to AGM ${transferYear}`, "success");
    } catch {
      showToast("Failed to transfer registration year", "error");
    }
  }

  async function handleReplaceProxyProof(
    record: RegisteredRecord,
    file: File,
  ) {
    try {
      const preview = await createThumbnailDataUrl(file);
      await updateRegistration.mutateAsync({
        id: record.registrationId,
        updates: {
          notes: replaceRegistrationNote(
            replaceRegistrationNote(record.rawNotes, "Proof File", file.name),
            "Proof Preview",
            preview ?? "",
          ),
          proxyData: {
            proxyName: record.proxyName,
            proxyContact: record.proxyContactNumber,
            proxyProofKey: file.name,
          },
        },
      });
      await recordAuditEvent.mutateAsync({
        action: "REPLACE_PROXY_PROOF",
        entityType: "registration",
        entityId: record.registrationId,
        details: `Replaced proxy proof for AGM ${record.agmYear || activeYear}`,
      });
      showToast("Proxy proof updated", "success");
    } catch {
      showToast("Failed to replace proxy proof", "error");
    }
  }

  function handleSelectRecord(record: RegisteredRecord) {
    setSelectedRecord((current) =>
      current?.id === record.id ? null : record,
    );
    setTransferYear(record.agmYear || activeYear);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      allVisibleSelected ? current.filter((id) => !filteredRecords.some((item) => item.id === id)) : filteredRecords.map((item) => item.id),
    );
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    try {
      await exportRegisteredPdf(filteredRecords, activeYear, stats);
      await recordAuditEvent.mutateAsync({
        action: "EXPORT_REPORT",
        entityType: "shareholder",
        entityId: activeYear,
        details: `Exported shareholders PDF for AGM ${activeYear}`,
      });
      showToast(`AGM ${activeYear} PDF export downloaded`, "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to export PDF";
      showToast(message, "error");
    } finally {
      setExportingPdf(false);
    }
  }

  function handleExportCsv() {
    exportRegisteredCsv(filteredRecords, activeYear);
    void recordAuditEvent.mutateAsync({
      action: "EXPORT_REPORT",
      entityType: "shareholder",
      entityId: activeYear,
      details: `Exported shareholders CSV for AGM ${activeYear}`,
    });
  }

  return (
    <Layout>
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4">
          <div className="relative max-w-3xl w-full border border-border bg-card p-4">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-3 top-3 min-h-[40px] min-w-[40px] border border-border bg-background/90 text-foreground"
              aria-label="Close preview"
            >
              <X className="w-4 h-4 mx-auto" />
            </button>
            <img
              src={previewImage}
              alt="Proxy proof preview"
              className="max-h-[80vh] w-full object-contain bg-muted/20"
            />
          </div>
        </div>
      )}
      <div className="space-y-4" data-ocid="shareholders.page">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: "Registered", value: stats.total, color: "text-foreground" },
            { label: "In Person", value: stats.inPerson, color: "text-primary" },
            { label: "Proxy", value: stats.proxy, color: "text-primary" },
            { label: "Checked In", value: stats.checkedIn, color: "text-primary" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-card border border-border px-4 py-3"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
              <p className={cn("text-2xl font-display font-bold", stat.color)}>
                {stat.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search registered name, member no, phone, Ghana Card, proxy, or code"
              className="pl-9 pr-9 min-h-[44px]"
              data-ocid="shareholders.search_input"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { label: "All", value: "all" },
              { label: "In Person", value: "in-person" },
              { label: "Proxy", value: "proxy" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() =>
                  setTypeFilter(item.value as "all" | "in-person" | "proxy")
                }
                className={cn(
                  "min-h-[44px] px-4 border text-sm font-medium whitespace-nowrap",
                  typeFilter === item.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/40",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="w-full lg:w-auto">
            <AgmYearSwitcher compact />
          </div>

          <Button
            variant="outline"
            className="min-h-[44px] gap-2 w-full lg:w-auto"
            onClick={handleExportCsv}
            disabled={filteredRecords.length === 0}
            data-ocid="shareholders.export_button"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            className="min-h-[44px] gap-2 w-full lg:w-auto"
            onClick={() => void handleExportPdf()}
            disabled={filteredRecords.length === 0 || exportingPdf}
            data-ocid="shareholders.export_pdf_button"
          >
            <FileText className="w-4 h-4" />
            {exportingPdf ? "Preparing PDF..." : "Export PDF"}
          </Button>

          {selectedCount > 0 && (
            <Button
              variant="outline"
              className="min-h-[44px] gap-2 w-full lg:w-auto border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => void handleRemoveSelected()}
              disabled={cancelRegistration.isPending}
              data-ocid="shareholders.bulk_remove_button"
            >
              <Trash2 className="w-4 h-4" />
              {cancelRegistration.isPending
                ? "Removing..."
                : `Remove Selected (${selectedCount})`}
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          AGM {activeYear}: {filteredRecords.length.toLocaleString()} registered record
          {filteredRecords.length !== 1 ? "s" : ""} shown
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border overflow-hidden">
            <div className="overflow-x-auto md:overflow-visible">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 text-xs"
                        aria-label={
                          allVisibleSelected
                            ? "Clear selected rows"
                            : "Select all visible rows"
                        }
                      >
                        {allVisibleSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                        <span>Select all</span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      No.
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Member No / Chit
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Verification Code
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Proof
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    [...Array(8)].map((_, index) => (
                      <tr key={index} className="border-b border-border/50">
                        <td colSpan={9} className="px-4 py-3">
                          <Skeleton className="h-8 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 border border-border bg-muted/30 flex items-center justify-center">
                            <Users className="w-7 h-7 text-muted-foreground" />
                          </div>
                          <p className="font-medium text-foreground">
                            No registered shareholders yet
                          </p>
                          <p className="max-w-md text-sm text-muted-foreground">
                            This page stays empty until someone is registered.
                            As soon as a registration is completed, the full
                            record will appear here automatically.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record, index) => (
                      <tr
                        key={record.id}
                        className={cn(
                          "border-b border-border/50 cursor-pointer hover:bg-muted/20 transition-colors",
                          selectedRecord?.id === record.id && "bg-primary/10",
                        )}
                        onClick={() => handleSelectRecord(record)}
                        data-ocid={`shareholders.item.${index + 1}`}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="flex items-center justify-center"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSelected(record.id);
                            }}
                            aria-label={
                              selectedIds.includes(record.id)
                                ? `Deselect ${record.fullName}`
                                : `Select ${record.fullName}`
                            }
                          >
                            {selectedIds.includes(record.id) ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-foreground">
                            {record.chitNumber || record.shareholderNumber}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Member: {record.shareholderNumber}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {record.fullName}
                          </div>
                          {record.proxyName && (
                            <div className="text-xs text-muted-foreground">
                              Proxy: {record.proxyName}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">
                            {record.registrationType === RegistrationType.Proxy
                              ? "Proxy"
                              : "In Person"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1 text-xs">
                            {record.telephoneNumber ? (
                              <div className="text-foreground">
                                {record.telephoneNumber}
                              </div>
                            ) : record.shareholderContactNumber ? (
                              <div className="text-foreground">
                                {record.shareholderContactNumber}
                              </div>
                            ) : (
                              <div className="text-muted-foreground">
                                Not provided
                              </div>
                            )}
                            {record.proxyContactNumber && (
                              <div className="text-muted-foreground">
                                Proxy: {record.proxyContactNumber}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-primary">
                          {record.verificationCode}
                        </td>
                        <td className="px-4 py-3">
                          {record.proofPreview.startsWith("data:image/") ? (
                            <button
                              type="button"
                              className="border border-border bg-muted/20 p-1"
                              onClick={(event) => {
                                event.stopPropagation();
                                setPreviewImage(record.proofPreview);
                              }}
                              aria-label="Preview proxy proof"
                            >
                              <img
                                src={record.proofPreview}
                                alt="Proxy proof thumbnail"
                                className="h-10 w-10 object-cover"
                              />
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <ImageIcon className="w-3.5 h-3.5" />
                              None
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={cn(
                              "border text-xs",
                              record.status === ShareholderStatus.CheckedIn
                                ? "bg-primary/15 text-primary border-primary/30"
                                : "bg-muted text-foreground border-border",
                            )}
                          >
                            {record.status === ShareholderStatus.RegisteredInPerson
                              ? "Registered In Person"
                              : record.status === ShareholderStatus.RegisteredProxy
                                ? "Registered Proxy"
                                : record.status === ShareholderStatus.CheckedIn
                                  ? "Checked In"
                                  : record.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedRecord && (
            <div
              className="bg-card border border-border p-4"
              data-ocid="shareholders.details_panel"
            >
              <div className="space-y-4">
                <div className="border-b border-border pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-semibold text-foreground">
                        {selectedRecord.fullName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Member No: {selectedRecord.shareholderNumber}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-[40px] gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => void handleRemoveRegistration(selectedRecord)}
                      disabled={cancelRegistration.isPending}
                      data-ocid="shareholders.remove_button"
                    >
                      <Trash2 className="w-4 h-4" />
                      {cancelRegistration.isPending ? "Removing..." : "Remove"}
                    </Button>
                  </div>
                </div>

                <RegistrationDetails record={selectedRecord} onPreviewProof={setPreviewImage} />

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {selectedRecord.status === ShareholderStatus.CheckedIn && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleReverseCheckIn(selectedRecord)}
                      disabled={undoCheckIn.isPending}
                    >
                      {undoCheckIn.isPending ? "Reversing..." : "Reverse Check-In"}
                    </Button>
                  )}
                  {selectedRecord.registrationType === RegistrationType.Proxy && (
                    <label className="flex items-center justify-center min-h-[44px] border border-border bg-card px-4 text-sm font-medium cursor-pointer hover:bg-muted/30">
                      Replace Proxy Proof
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void handleReplaceProxyProof(selectedRecord, file);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  )}
                  {canAdminLifecycle && (
                    <>
                      <Select value={transferYear} onValueChange={setTransferYear}>
                        <SelectTrigger>
                          <SelectValue placeholder="Transfer year" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {yearOptions.map((year) => (
                            <SelectItem key={year} value={year}>
                              AGM {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleTransferYear(selectedRecord)}
                        disabled={
                          updateRegistration.isPending ||
                          !transferYear ||
                          transferYear === selectedRecord.agmYear
                        }
                      >
                        Transfer to AGM {transferYear || "Year"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

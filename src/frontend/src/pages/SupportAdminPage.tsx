import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { RoleGuard } from "@/components/RoleGuard";
import { RetryPanel } from "@/components/RetryPanel";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  apiClearAllAmendments,
  apiClearAllIncidents,
  apiDeleteResolvedAmendments,
  apiDeleteResolvedIncidents,
  apiExportAmendmentsCsv,
  apiExportIncidentsCsv,
  apiGetIncidentReports,
  apiGetProfileAmendments,
  apiResolveIncidentReport,
  apiResolveProfileAmendment,
  userHasPermission,
} from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import type { IncidentReport, ProfileAmendment } from "@/types";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Download,
  MapPin,
  Phone,
  Settings2,
  Shield,
  Trash2,
  UserCog,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatDate(ts: bigint) {
  return new Date(Number(ts)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: string) {
  return status === "resolved" ? "Resolved" : "Open";
}

function StatusChip({ status }: { status: string }) {
  const resolved = status === "resolved";
  return (
    <Badge
      variant="outline"
      className={
        resolved
          ? "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30"
          : "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30"
      }
    >
      {statusLabel(status)}
    </Badge>
  );
}

function IncidentIssueBadge({ issue }: { issue: string }) {
  return (
    <Badge
      variant="outline"
      className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/25"
    >
      {issue}
    </Badge>
  );
}

function AmendmentTypeBadge({ type }: { type: string }) {
  return (
    <Badge
      variant="outline"
      className="bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/25"
    >
      {type}
    </Badge>
  );
}

function SummaryStrip({
  incidents,
  amendments,
}: {
  incidents: IncidentReport[];
  amendments: ProfileAmendment[];
}) {
  const openIncidents = incidents.filter((item) => item.status !== "resolved");
  const openAmendments = amendments.filter(
    (item) => item.status !== "resolved",
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="glass-card panel-sharp p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
        </div>
        <div>
          <div className="text-2xl font-display font-bold text-foreground">
            {openIncidents.length}
          </div>
          <div className="text-xs text-muted-foreground">Open Incidents</div>
        </div>
      </div>
      <div className="glass-card panel-sharp p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
          <UserCog className="h-5 w-5 text-cyan-500" />
        </div>
        <div>
          <div className="text-2xl font-display font-bold text-foreground">
            {openAmendments.length}
          </div>
          <div className="text-xs text-muted-foreground">Open T24 Requests</div>
        </div>
      </div>
    </div>
  );
}

function IncidentsSection({ onDataChanged }: { onDataChanged: () => void }) {
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectionNotice, setSelectionNotice] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetIncidentReports();
      setIncidents(data);
      setSelected(new Set());
      setLoadError(false);
    } catch {
      setIncidents([]);
      setLoadError(true);
      toast.error("Incident reports could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resolvedIds = useMemo(
    () =>
      incidents
        .filter((incident) => incident.status === "resolved")
        .map((i) => i.id),
    [incidents],
  );

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleResolve(id: number) {
    setBusy(true);
    const result = await apiResolveIncidentReport(id, "Resolved by IT Admin.");
    if ("err" in result) {
      toast.error(result.err);
    } else {
      toast.success("Incident resolved.");
      await load();
      onDataChanged();
    }
    setBusy(false);
    setConfirmResolve(null);
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) {
      setSelectionNotice(true);
      return;
    }
    setBusy(true);
    const result = await apiDeleteResolvedIncidents(Array.from(selected));
    if ("err" in result) {
      toast.error(result.err);
    } else {
      toast.success(`${selected.size} resolved incident(s) deleted.`);
      await load();
      onDataChanged();
    }
    setBusy(false);
    setConfirmDelete(false);
  }

  async function handleClearAll() {
    setBusy(true);
    const result = await apiClearAllIncidents();
    if ("err" in result) {
      toast.error(result.err);
    } else {
      toast.success("All incident reports cleared.");
      await load();
      onDataChanged();
    }
    setBusy(false);
    setConfirmClearAll(false);
  }

  function handleExport() {
    downloadCsv(apiExportIncidentsCsv(incidents), "IT_Incident_Reports.csv");
    toast.success("IT_Incident_Reports.csv downloaded.");
  }

  if (loading) return <SkeletonCard lines={6} />;

  if (loadError && incidents.length === 0) {
    return (
      <RetryPanel
        title="Incident reports failed to load"
        description="Retry this section without leaving the IT Admin Center."
        onRetry={() => void load()}
        icon={<AlertCircle className="h-4 w-4 text-yellow-500" />}
      />
    );
  }

  return (
    <div className="glass-card panel-sharp overflow-hidden">
      <div className="p-5 border-b border-border/40 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Incident Reports
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track and resolve reported technical issues.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={handleExport}
            data-ocid="incidents.export_button"
          >
            <Download className="h-4 w-4" />
            Export Data
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="gap-2"
            onClick={() =>
              selected.size > 0
                ? setConfirmDelete(true)
                : setSelectionNotice(true)
            }
            data-ocid="incidents.delete_button"
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmClearAll(true)}
            data-ocid="incidents.clear_all_button"
          >
            <Trash2 className="h-4 w-4" />
            Clear All
          </Button>
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={<ClipboardList className="h-8 w-8" />}
            title="All Clear! No incidents pending."
            description=""
            data-ocid="incidents.empty_state"
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="p-3 text-left text-xs uppercase tracking-wide text-muted-foreground w-14">
                  Select
                </th>
                <th className="p-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Date
                </th>
                <th className="p-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Location
                </th>
                <th className="p-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Reporter Details
                </th>
                <th className="p-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Issue Type
                </th>
                <th className="p-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Description
                </th>
                <th className="p-3 text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident, index) => {
                const resolved = incident.status === "resolved";
                return (
                  <tr
                    key={incident.id}
                    className={`border-b border-border/30 ${
                      resolved ? "bg-muted/25" : "hover:bg-muted/10"
                    }`}
                    data-ocid={`incidents.row.${index + 1}`}
                  >
                    <td className="p-3">
                      {resolved ? (
                        <Checkbox
                          checked={selected.has(incident.id)}
                          onCheckedChange={() => toggleSelect(incident.id)}
                          data-ocid={`incidents.checkbox.${index + 1}`}
                        />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground font-medium whitespace-nowrap">
                      {formatDate(incident.createdAt)}
                    </td>
                    <td className="p-3 font-semibold text-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                        {incident.agency ?? "-"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-foreground">
                        {incident.reporterName}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-emerald-500" />
                        {incident.contact ?? "-"}
                      </div>
                    </td>
                    <td className="p-3">
                      <IncidentIssueBadge
                        issue={incident.issueCategory ?? incident.subject}
                      />
                    </td>
                    <td className="p-3 text-foreground/90 max-w-[320px]">
                      <span className="line-clamp-2 block">
                        {incident.description}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {resolved ? (
                        <StatusChip status={incident.status} />
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1 text-green-600 border-green-500/30 hover:bg-green-500/10"
                          onClick={() => setConfirmResolve(incident.id)}
                          disabled={busy}
                          data-ocid={`incidents.resolve_button.${index + 1}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Resolve
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={selectionNotice}
        onOpenChange={setSelectionNotice}
        title="No resolved item selected"
        description="Select at least one resolved incident to delete."
        confirmLabel="OK"
        cancelLabel="Close"
        onConfirm={() => setSelectionNotice(false)}
      />
      <ConfirmDialog
        open={confirmResolve !== null}
        onOpenChange={() => setConfirmResolve(null)}
        title="Resolve Incident?"
        description="This incident will be marked as resolved."
        confirmLabel="Resolve"
        onConfirm={() =>
          confirmResolve !== null && handleResolve(confirmResolve)
        }
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${selected.size} resolved incident(s)?`}
        description="Only resolved items can be deleted."
        confirmLabel="Delete Selected"
        variant="destructive"
        onConfirm={handleDeleteSelected}
      />
      <ConfirmDialog
        open={confirmClearAll}
        onOpenChange={setConfirmClearAll}
        title="Clear all incident reports?"
        description="This will permanently remove every incident record in the IT Admin Center."
        confirmLabel={busy ? "Clearing..." : "Clear All"}
        variant="destructive"
        onConfirm={handleClearAll}
      />

      <span className="hidden">{resolvedIds.length}</span>
    </div>
  );
}

function AmendmentsSection({ onDataChanged }: { onDataChanged: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [amendments, setAmendments] = useState<ProfileAmendment[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectionNotice, setSelectionNotice] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetProfileAmendments();
      setAmendments(data);
      setSelected(new Set());
      setLoadError(false);
    } catch {
      setAmendments([]);
      setLoadError(true);
      toast.error("Amendment requests could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleResolve(id: number) {
    setBusy(true);
    const result = await apiResolveProfileAmendment(
      id,
      true,
      "Resolved by IT Admin.",
      user?.id ?? "",
    );
    if ("err" in result) {
      toast.error(result.err);
    } else {
      toast.success("Amendment request resolved.");
      await load();
      onDataChanged();
    }
    setBusy(false);
    setConfirmResolve(null);
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) {
      setSelectionNotice(true);
      return;
    }
    setBusy(true);
    const result = await apiDeleteResolvedAmendments(Array.from(selected));
    if ("err" in result) {
      toast.error(result.err);
    } else {
      toast.success(`${selected.size} resolved amendment(s) deleted.`);
      await load();
      onDataChanged();
    }
    setBusy(false);
    setConfirmDelete(false);
  }

  async function handleClearAll() {
    setBusy(true);
    const result = await apiClearAllAmendments();
    if ("err" in result) {
      toast.error(result.err);
    } else {
      toast.success("All amendment requests cleared.");
      await load();
      onDataChanged();
    }
    setBusy(false);
    setConfirmClearAll(false);
  }

  function handleExport() {
    downloadCsv(
      apiExportAmendmentsCsv(amendments),
      "T24_Amendment_Requests.csv",
    );
    toast.success("T24_Amendment_Requests.csv downloaded.");
  }

  if (loading) return <SkeletonCard lines={6} />;

  if (loadError && amendments.length === 0) {
    return (
      <RetryPanel
        title="Amendment requests failed to load"
        description="Retry this section without leaving the IT Admin Center."
        onRetry={() => void load()}
        icon={<UserCog className="h-4 w-4 text-cyan-500" />}
      />
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="p-5 border-b border-border/40 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <UserCog className="h-5 w-5 text-cyan-500" />
            T24 Amendment Requests
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage profile changes and T24 user updates.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={handleExport}
            data-ocid="amendments.export_button"
          >
            <Download className="h-4 w-4" />
            Export Data
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="gap-2"
            onClick={() =>
              selected.size > 0
                ? setConfirmDelete(true)
                : setSelectionNotice(true)
            }
            data-ocid="amendments.delete_button"
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmClearAll(true)}
            data-ocid="amendments.clear_all_button"
          >
            <Trash2 className="h-4 w-4" />
            Clear All
          </Button>
        </div>
      </div>

      {amendments.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={<Settings2 className="h-8 w-8" />}
            title="No pending requests."
            description=""
            data-ocid="amendments.empty_state"
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="p-3 text-left text-xs uppercase tracking-wide text-muted-foreground w-14">
                  Select
                </th>
                <th className="p-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Date
                </th>
                <th className="p-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  T24 User / Agency
                </th>
                <th className="p-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Request Type
                </th>
                <th className="p-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Contact
                </th>
                <th className="p-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Change Details
                </th>
                <th className="p-3 text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {amendments.map((amendment, index) => {
                const resolved = amendment.status === "resolved";
                return (
                  <tr
                    key={amendment.id}
                    className={`border-b border-border/30 ${
                      resolved ? "bg-muted/25" : "hover:bg-muted/10"
                    }`}
                    data-ocid={`amendments.row.${index + 1}`}
                  >
                    <td className="p-3">
                      {resolved ? (
                        <Checkbox
                          checked={selected.has(amendment.id)}
                          onCheckedChange={() => toggleSelect(amendment.id)}
                          data-ocid={`amendments.checkbox.${index + 1}`}
                        />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground font-medium whitespace-nowrap">
                      {formatDate(amendment.createdAt)}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-primary">
                        {amendment.t24Username ?? "-"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {amendment.agency ?? "-"}
                      </div>
                    </td>
                    <td className="p-3">
                      <AmendmentTypeBadge
                        type={amendment.requestType ?? amendment.field}
                      />
                    </td>
                    <td className="p-3 font-medium text-foreground">
                      {amendment.phone ?? "-"}
                    </td>
                    <td className="p-3 text-foreground/90 max-w-[320px]">
                      <div className="space-y-1 text-sm">
                        {amendment.newRole && (
                          <div className="text-emerald-600 dark:text-emerald-400">
                            New Role: {amendment.newRole}
                          </div>
                        )}
                        {amendment.deptChange && (
                          <div>{amendment.deptChange}</div>
                        )}
                        {amendment.transferLocation && (
                          <div className="text-primary">
                            To: {amendment.transferLocation}
                          </div>
                        )}
                        {!amendment.newRole &&
                          !amendment.deptChange &&
                          !amendment.transferLocation && (
                            <div>{amendment.reason}</div>
                          )}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      {resolved ? (
                        <StatusChip status={amendment.status} />
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1 text-green-600 border-green-500/30 hover:bg-green-500/10"
                          onClick={() => setConfirmResolve(amendment.id)}
                          disabled={busy}
                          data-ocid={`amendments.resolve_button.${index + 1}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Resolve
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={selectionNotice}
        onOpenChange={setSelectionNotice}
        title="No resolved item selected"
        description="Select at least one resolved amendment to delete."
        confirmLabel="OK"
        cancelLabel="Close"
        onConfirm={() => setSelectionNotice(false)}
      />
      <ConfirmDialog
        open={confirmResolve !== null}
        onOpenChange={() => setConfirmResolve(null)}
        title="Resolve Amendment?"
        description="This T24 amendment request will be marked as resolved."
        confirmLabel="Resolve"
        onConfirm={() =>
          confirmResolve !== null && handleResolve(confirmResolve)
        }
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${selected.size} resolved amendment(s)?`}
        description="Only resolved items can be deleted."
        confirmLabel="Delete Selected"
        variant="destructive"
        onConfirm={handleDeleteSelected}
      />
      <ConfirmDialog
        open={confirmClearAll}
        onOpenChange={setConfirmClearAll}
        title="Clear all amendment requests?"
        description="This will permanently remove every T24 amendment request in the IT Admin Center."
        confirmLabel={busy ? "Clearing..." : "Clear All"}
        variant="destructive"
        onConfirm={handleClearAll}
      />
    </div>
  );
}

export default function SupportAdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canAccess = userHasPermission(user, "support");
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [amendments, setAmendments] = useState<ProfileAmendment[]>([]);
  const [summaryLoadError, setSummaryLoadError] = useState(false);
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);

  useEffect(() => {
    if (!canAccess) {
      navigate({ to: "/support/incident" });
    }
  }, [canAccess, navigate]);

  const triggerSummaryRefresh = useCallback(() => {
    setSummaryRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiGetIncidentReports(), apiGetProfileAmendments()])
      .then(([nextIncidents, nextAmendments]) => {
        if (cancelled) return;
        setIncidents(nextIncidents);
        setAmendments(nextAmendments);
        setSummaryLoadError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIncidents([]);
        setAmendments([]);
        setSummaryLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [summaryRefreshKey]);

  if (!canAccess) return null;

  return (
    <AppShell>
      <RoleGuard
        roles={["SuperAdmin", "HRAdmin", "Supervisor"]}
        permission="support"
        fallback={
          <div className="py-16 text-center text-muted-foreground">
            You do not have permission to view this page.
          </div>
        }
      >
      <div
        className="page-shell"
        data-ocid="support_admin.page"
      >
        <section className="page-header">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="page-kicker">Support operations</div>
            <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-primary/20 bg-primary/15">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              IT ADMIN CENTER
            </h1>
          </div>
            <p className="page-subtitle mt-4">
              Resolve incidents, process T24 amendments, and keep IT support records organized.
            </p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/">Dashboard</Link>
          </Button>
        </div>
        </section>

        {summaryLoadError ? (
          <RetryPanel
            title="Support summary failed to refresh"
            description="The IT Admin summary could not refresh just now. The sections below can still be retried separately."
            onRetry={() => window.location.reload()}
            icon={<Shield className="h-4 w-4 text-primary" />}
          />
        ) : (
          <SummaryStrip incidents={incidents} amendments={amendments} />
        )}

        <div className="space-y-6">
          <IncidentsSection onDataChanged={triggerSummaryRefresh} />
          <AmendmentsSection onDataChanged={triggerSummaryRefresh} />
        </div>
      </div>
      </RoleGuard>
    </AppShell>
  );
}

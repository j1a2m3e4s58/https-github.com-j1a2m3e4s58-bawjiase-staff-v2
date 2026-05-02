import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  apiGetCachedAuditLogs,
  apiDeleteAuditLog,
  apiDeleteAuditLogs,
  apiGetAuditLogs,
} from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import type { AuditLog } from "@/types";
import { useNavigate } from "@tanstack/react-router";
import {
  ClipboardList,
  Download,
  FileSpreadsheet,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function formatTime(ts: bigint) {
  return new Date(Number(ts)).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getDateLabel(ts: bigint): string {
  const d = new Date(Number(ts));
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function groupByDate(logs: AuditLog[]): [string, AuditLog[]][] {
  const map = new Map<string, AuditLog[]>();
  for (const log of logs) {
    const label = getDateLabel(log.timestamp);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(log);
  }
  return Array.from(map.entries());
}

function isKnownActor(actorName: string) {
  const actor = actorName.toLowerCase();
  return !actor.includes("anonymous") && !actor.includes("unknown");
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function exportLogsCsv(logs: AuditLog[]) {
  const headers = ["Time", "Actor", "Action", "IP Address", "Details"];
  const rows = logs.map((log) => [
    new Date(Number(log.timestamp)).toLocaleString("en-GB"),
    log.actorName,
    log.action,
    log.ipAddress,
    log.target,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "Bawjiase_Security_Log.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] ?? char;
  });
}

function printLogs(logs: AuditLog[]) {
  const printable = window.open("", "_blank", "width=1100,height=800");
  if (!printable) {
    toast.error("Please allow pop-ups to download the PDF.");
    return;
  }

  const rows = logs
    .map(
      (log) => `
        <tr>
          <td>${escapeHtml(new Date(Number(log.timestamp)).toLocaleString("en-GB"))}</td>
          <td>${escapeHtml(log.actorName)}</td>
          <td>${escapeHtml(log.action)}</td>
          <td>${escapeHtml(log.ipAddress)}</td>
          <td>${escapeHtml(log.target)}</td>
        </tr>
      `,
    )
    .join("");

  printable.document.write(`
    <html>
      <head>
        <title>Bawjiase Security Audit Logs</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
          h1 { margin: 0 0 6px; font-size: 22px; }
          p { margin: 0 0 18px; color: #4b5563; }
          table { border-collapse: collapse; width: 100%; font-size: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h1>Bawjiase Security Audit Logs</h1>
        <p>Recent ${logs.length} visible log entries</p>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>IP Address</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `);
  printable.document.close();
  printable.focus();
  printable.print();
}

function ActionBadge({ action }: { action: string }) {
  const colorMap: Record<string, string> = {
    LOGIN:
      "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
    LOGOUT: "bg-muted text-muted-foreground border-border",
    CREATE:
      "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    UPDATE: "bg-primary/15 text-primary border-primary/30",
    SUPERVISOR: "bg-primary/15 text-primary border-primary/30",
    DELETE: "bg-destructive/15 text-destructive border-destructive/30",
    ARCHIVE:
      "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
    RESTORE:
      "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30",
    RESOLVE: "bg-secondary/20 text-secondary border-secondary/30",
  };

  const key = Object.keys(colorMap).find((k) =>
    action.toUpperCase().startsWith(k),
  );
  const className = key ? colorMap[key] : "bg-muted text-muted-foreground";

  return (
    <Badge
      variant="outline"
      className={`${className} font-mono text-[10px] tracking-wide`}
    >
      {action}
    </Badge>
  );
}

function LogRow({
  log,
  index,
  selected,
  onToggle,
  onDelete,
}: {
  log: AuditLog;
  index: number;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 border-b border-border/30 px-4 py-3 transition-colors group hover:bg-muted/20 ${
        selected ? "bg-primary/5" : ""
      }`}
      data-ocid={`audit.row.${index}`}
    >
      <div className="mt-0.5 flex-shrink-0">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          data-ocid={`audit.checkbox.${index}`}
        />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm font-semibold truncate ${
              isKnownActor(log.actorName)
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive"
            }`}
          >
            {log.actorName}
          </span>
          <ActionBadge action={log.action} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>
            Target:{" "}
            <span className="text-foreground/70 font-medium">{log.target}</span>
          </span>
          <span className="text-border">.</span>
          <span>IP: {log.ipAddress}</span>
          <span className="text-border">.</span>
          <span>{formatTime(log.timestamp)}</span>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={onDelete}
        aria-label="Delete log entry"
        data-ocid={`audit.delete_button.${index}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function AuditLogsPage() {
  const { user } = useAuth();
  const canViewAudit = user?.department?.toUpperCase() === "IT";
  const navigate = useNavigate();
  const cachedLogs = apiGetCachedAuditLogs();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>(() => cachedLogs);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectionNotice, setSelectionNotice] = useState(false);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleteSingle, setDeleteSingle] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!canViewAudit) {
      toast.error("Audit logs are restricted to IT and Super Admin users.");
      navigate({ to: "/" });
    }
  }, [canViewAudit, navigate]);

  const loadLogs = useCallback(async () => {
    const data = await apiGetAuditLogs();
    setLogs(data.slice(0, 150));
    setLoading(false);
    setSelected(new Set());
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.actorName.toLowerCase().includes(q) ||
        l.ipAddress.toLowerCase().includes(q) ||
        l.target.toLowerCase().includes(q),
    );
  }, [logs, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const selectedVisibleCount = filtered.filter((log) =>
    selected.has(log.id),
  ).length;
  const allVisibleSelected =
    filtered.length > 0 && selectedVisibleCount === filtered.length;

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const log of filtered) next.delete(log.id);
      } else {
        for (const log of filtered) next.add(log.id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleDeleteSingle(id: number) {
    setActionLoading(true);
    const res = await apiDeleteAuditLog(id);
    if ("err" in res) {
      toast.error(res.err);
    } else {
      toast.success("Log entry deleted.");
      await loadLogs();
    }
    setActionLoading(false);
    setDeleteSingle(null);
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) {
      setSelectionNotice(true);
      return;
    }
    setActionLoading(true);
    const ids = Array.from(selected);
    const res = await apiDeleteAuditLogs(ids);
    if ("err" in res) {
      toast.error(res.err);
    } else {
      toast.success(`${ids.length} log entries deleted.`);
      await loadLogs();
    }
    setActionLoading(false);
    setConfirmDeleteSelected(false);
  }

  async function handleDeleteAll() {
    setActionLoading(true);
    const ids = logs.map((l) => l.id);
    const res = await apiDeleteAuditLogs(ids);
    if ("err" in res) {
      toast.error(res.err);
    } else {
      toast.success("All audit logs cleared.");
      await loadLogs();
    }
    setActionLoading(false);
    setConfirmDeleteAll(false);
  }

  if (!canViewAudit) return null;

  return (
    <AppShell>
      <div className="page-shell-narrow" data-ocid="audit.page">
        <section className="page-header">
          <div className="page-kicker">Security and oversight</div>
          <div className="mt-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border border-primary/20 bg-primary/15">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              IT Security Center
            </h1>
            <p className="text-sm text-muted-foreground">
              System security audit logs from the most recent 150 entries.
            </p>
          </div>
          </div>
          <p className="page-subtitle mt-4">
            Search activity, export filtered entries, and clean up resolved log history when needed.
          </p>
        </section>

        <div className="toolbar-surface">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by actor, action, IP, or details..."
              className="pl-9"
              data-ocid="audit.search_input"
            />
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary">
            Recent 150 logs
          </Badge>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={toggleSelectVisible}
              disabled={filtered.length === 0}
              data-ocid="audit.select_visible_checkbox"
            />
            Select all visible logs
          </div>
          <div className="flex flex-wrap gap-2 ml-auto">
            {selected.size > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                data-ocid="audit.deselect_button"
              >
                Deselect
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => exportLogsCsv(filtered)}
              disabled={filtered.length === 0}
              data-ocid="audit.export_excel_button"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Export Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => printLogs(filtered)}
              disabled={filtered.length === 0}
              data-ocid="audit.export_pdf_button"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                selected.size > 0
                  ? setConfirmDeleteSelected(true)
                  : setSelectionNotice(true)
              }
              disabled={filtered.length === 0 || actionLoading}
              data-ocid="audit.delete_selected_button"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected
              {selected.size > 0 ? ` (${selected.size})` : ""}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setConfirmDeleteAll(true)}
              disabled={logs.length === 0 || actionLoading}
              data-ocid="audit.delete_all_button"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete All
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={3} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-8 w-8" />}
            title={search ? "No matching log entries" : "No audit logs"}
            description={
              search
                ? "Try a different search term."
                : "System activity will appear here as users interact with the portal."
            }
            data-ocid="audit.empty_state"
          />
        ) : (
          <div className="space-y-5" data-ocid="audit.log_groups">
            {grouped.map(([dateLabel, groupLogs]) => {
              const groupStart = filtered.findIndex(
                (l) => l.id === groupLogs[0]?.id,
              );
              return (
                <div key={dateLabel} className="space-y-1.5">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {dateLabel}
                    </span>
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-xs text-muted-foreground">
                      {groupLogs.length} entries
                    </span>
                  </div>

                  <div className="glass-card panel-sharp overflow-hidden">
                    {groupLogs.map((log, i) => (
                      <LogRow
                        key={log.id}
                        log={log}
                        index={groupStart + i + 1}
                        selected={selected.has(log.id)}
                        onToggle={() => toggleSelect(log.id)}
                        onDelete={() => setDeleteSingle(log.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Showing {filtered.length} of {logs.length} entries
            {search && ` matching "${search}"`}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={selectionNotice}
        onOpenChange={setSelectionNotice}
        title="No log selected"
        description="Please select at least one visible log entry before deleting selected logs."
        confirmLabel="OK"
        cancelLabel="Close"
        onConfirm={() => setSelectionNotice(false)}
      />
      <ConfirmDialog
        open={deleteSingle !== null}
        onOpenChange={() => setDeleteSingle(null)}
        title="Delete log entry?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() =>
          deleteSingle !== null && handleDeleteSingle(deleteSingle)
        }
      />
      <ConfirmDialog
        open={confirmDeleteSelected}
        onOpenChange={setConfirmDeleteSelected}
        title={`Delete ${selected.size} log entries?`}
        description="These entries will be permanently removed."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteSelected}
      />
      <ConfirmDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        title="Delete ALL audit logs?"
        description="This will permanently clear all log entries. This action cannot be undone."
        confirmLabel="Delete All"
        variant="destructive"
        onConfirm={handleDeleteAll}
      />
    </AppShell>
  );
}

import { AppShell } from "@/components/AppShell";
import { LiveSyncBadge } from "@/components/LiveSyncBadge";
import { PortalCard } from "@/components/PortalCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiDownloadProductionBackup } from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import { AlertTriangle, Database, Download, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const BACKUP_ITEMS = [
  "Staff directory and profile records",
  "Announcements, forms, training videos, and training documents",
  "Notifications, video progress, document opens, and reminders",
  "Presence/session stores and audit logs",
];
const BACKUP_STORAGE_KEY = "bcb_last_backup_download";
const BACKUP_SAFETY_STEPS = [
  "Download a fresh backup before any major cPanel edit or migration.",
  "Keep one copy on your laptop and one in a secure IT-only folder.",
  "Never share the backup JSON through public WhatsApp groups.",
];

interface BackupDownloadSnapshot {
  filename: string;
  downloadedAt: number;
}

function loadLastBackupSnapshot(): BackupDownloadSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BACKUP_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BackupDownloadSnapshot;
  } catch {
    return null;
  }
}

function persistLastBackupSnapshot(snapshot: BackupDownloadSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(snapshot));
}

const BACKUP_INCLUDED_ITEMS = [
  "Announcements, forms, training videos, and training documents",
  "Notifications, video progress, document opens, and reminders",
  "Presence/session stores and audit logs",
];

export default function BackupCenterPage() {
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [lastBackup, setLastBackup] = useState<BackupDownloadSnapshot | null>(
    () => loadLastBackupSnapshot(),
  );
  const canBackup =
    user?.role === "SuperAdmin" || user?.role === "HRAdmin";
  const lastBackupLabel = useMemo(() => {
    if (!lastBackup) return "No backup downloaded on this browser yet.";
    return `${lastBackup.filename} • ${new Date(lastBackup.downloadedAt).toLocaleString(
      "en-GB",
    )}`;
  }, [lastBackup]);

  async function handleDownload() {
    setDownloading(true);
    const result = await apiDownloadProductionBackup();
    setDownloading(false);
    if ("err" in result) {
      toast.error(result.err);
      return;
    }
    const snapshot = {
      filename: result.ok,
      downloadedAt: Date.now(),
    };
    persistLastBackupSnapshot(snapshot);
    setLastBackup(snapshot);
    toast.success(`Backup downloaded: ${result.ok}`);
  }

  return (
    <AppShell>
      <div className="page-shell-narrow py-2">
        <section className="page-header">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
            <Badge variant="outline" className="mb-3 gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              IT/HR protected
            </Badge>
            <div className="page-kicker">Protected operations</div>
            <h1 className="page-title">
              Backup Center
            </h1>
            <p className="page-subtitle">
              Download one production JSON backup before migration, major
              deployments, or client handover.
            </p>
          </div>
          <div className="page-actions">
            <LiveSyncBadge eventNames={[]} />
            <Button
            type="button"
            onClick={handleDownload}
            disabled={!canBackup || downloading}
            className="gap-2"
            data-ocid="backup.download_production_backup"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Preparing backup..." : "Download Backup"}
          </Button>
          </div>
        </div>
        </section>
        <div className="toolbar-surface">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Last backup:</span>{" "}
            {lastBackupLabel}
          </div>
        </div>

        <PortalCard elevated>
            <div className="mb-4">
            <h2 className="section-title">
              <Database className="h-5 w-5 text-primary" />
              What This Backup Includes
            </h2>
            <p className="section-copy">
              The file is meant for IT/HR only and should be stored securely.
            </p>
          </div>
          <div className="space-y-3">
            {BACKUP_INCLUDED_ITEMS.map((item) => (
              <div
                key={item}
                className="surface-muted px-4 py-3 text-sm"
              >
                {item}
              </div>
            ))}
          </div>
        </PortalCard>

        <PortalCard>
            <div className="mb-4">
            <h2 className="section-title">
              Recommended backup routine
            </h2>
            <p className="section-copy">
              These steps help you avoid panic before client handover, cPanel
              work, or major content updates.
            </p>
          </div>
          <div className="space-y-3">
            {BACKUP_SAFETY_STEPS.map((step) => (
              <div
                key={step}
                className="surface-muted px-4 py-3 text-sm text-muted-foreground"
              >
                {step}
              </div>
            ))}
          </div>
        </PortalCard>

        <div className="panel-sharp border border-amber-500/30 bg-amber-500/10 px-6 py-6 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Security warning</p>
              <p className="mt-1 leading-6">
                This backup can contain sensitive staff and authentication data.
                Do not send it through public WhatsApp groups or leave it on a
                shared computer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

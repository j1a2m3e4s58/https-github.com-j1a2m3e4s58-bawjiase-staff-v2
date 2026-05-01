import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { useHasRole } from "@/components/RoleGuard";
import { SkeletonRow } from "@/components/SkeletonCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  apiGetCachedArchivedStaff,
  apiDeleteStaff,
  apiGetArchivedStaff,
  apiRestoreStaff,
  resolveStoredAssetUrl,
} from "@/lib/backend-client";
import type { User } from "@/types";
import { useNavigate } from "@tanstack/react-router";
import {
  ArchiveRestore,
  Building2,
  MapPin,
  ShieldOff,
  Trash2,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(fullname: string): string {
  return fullname
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(ts: bigint): string {
  const d = new Date(Number(ts));
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const ROLE_LABELS: Record<User["role"], string> = {
  SuperAdmin: "Super Admin",
  HRAdmin: "HR Admin",
  Supervisor: "Supervisor",
  GeneralStaff: "Staff",
};

// ── Past Staff Row ─────────────────────────────────────────────────────────────

interface PastStaffRowProps {
  staff: User;
  index: number;
  onRestore: (staff: User) => void;
  onDelete: (staff: User) => void;
}

function PastStaffRow({
  staff,
  index,
  onRestore,
  onDelete,
}: PastStaffRowProps) {
  const initials = getInitials(staff.fullname);
  const profileImage = resolveStoredAssetUrl(staff.imageFile);

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 glass-card rounded-xl hover:glass-card-elevated transition-smooth"
      data-ocid={`past_staff.item.${index}`}
    >
      {/* Avatar */}
      <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-border/30">
        {profileImage ? (
          <AvatarImage src={profileImage} alt={staff.fullname} />
        ) : null}
        <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-sm">
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-sm text-foreground truncate">
            {staff.fullname}
          </span>
          <Badge variant="outline" className="text-[10px] flex-shrink-0">
            {ROLE_LABELS[staff.role]}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {staff.email}
        </div>
        <div className="flex items-center flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {staff.department}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {staff.branch}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground/70">
            Archived {formatDate(staff.lastSeen)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 text-secondary hover:text-secondary"
          onClick={() => onRestore(staff)}
          data-ocid={`past_staff.restore_button.${index}`}
        >
          <ArchiveRestore className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Restore</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(staff)}
          data-ocid={`past_staff.delete_button.${index}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
        </Button>
      </div>
    </div>
  );
}

// ── Past Staff Page ────────────────────────────────────────────────────────────

export default function PastStaffPage() {
  const canAccess = useHasRole(["SuperAdmin", "HRAdmin"]);
  const navigate = useNavigate();
  const cachedStaff = apiGetCachedArchivedStaff();

  const [staff, setStaff] = useState<User[]>(() => cachedStaff);
  const [loading, setLoading] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (!canAccess) {
      void navigate({ to: "/directory" });
    }
  }, [canAccess, navigate]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGetArchivedStaff();
        if (cancelled) return;
        setStaff(data);
      } catch {
        if (cancelled) return;
        setStaff([]);
        toast.error("Archived staff could not be loaded.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRestoreConfirm() {
    if (!restoreTarget) return;
    setBusy(true);
    const result = await apiRestoreStaff(restoreTarget.id);
    setBusy(false);
    if ("ok" in result) {
      toast.success(`${restoreTarget.fullname} has been restored`);
      setStaff((prev) => prev.filter((u) => u.id !== restoreTarget.id));
    } else {
      toast.error(result.err ?? "Failed to restore staff member");
    }
    setRestoreTarget(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setBusy(true);
    const result = await apiDeleteStaff(deleteTarget.id);
    setBusy(false);
    if ("ok" in result) {
      toast.success(`${deleteTarget.fullname} has been permanently deleted`);
      setStaff((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    } else {
      toast.error(result.err ?? "Failed to delete staff member");
    }
    setDeleteTarget(null);
  }

  if (!canAccess) return null;

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto" data-ocid="past_staff.page">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <UserX className="h-6 w-6 text-muted-foreground" />
            Past Staff
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Archived staff members — restore or permanently remove records.
          </p>
        </div>

        {/* Access notice */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          <ShieldOff className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Archived staff cannot log in. Restoring grants them portal access
            again.
          </span>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => `sk-${i}`).map((k) => (
              <SkeletonRow key={k} />
            ))}
          </div>
        ) : staff.length === 0 ? (
          <EmptyState
            icon={<UserX className="h-10 w-10 text-muted-foreground/40" />}
            title="No past staff"
            description="Archived staff members will appear here."
            data-ocid="past_staff.empty_state"
          />
        ) : (
          <div className="space-y-2" data-ocid="past_staff.list">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {staff.length} archived member{staff.length !== 1 ? "s" : ""}
              </span>
            </div>
            {staff.map((member, i) => (
              <PastStaffRow
                key={member.id}
                staff={member}
                index={i + 1}
                onRestore={setRestoreTarget}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Restore Confirm */}
      <ConfirmDialog
        open={!!restoreTarget}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null);
        }}
        title="Restore Staff Member"
        description={`Restore ${restoreTarget?.fullname} to active staff? They will regain portal access.`}
        confirmLabel={busy ? "Restoring…" : "Restore"}
        cancelLabel="Cancel"
        variant="default"
        onConfirm={handleRestoreConfirm}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Permanently Delete Staff Record"
        description={`This will permanently delete ${deleteTarget?.fullname}'s record. This action cannot be undone.`}
        confirmLabel={busy ? "Deleting…" : "Delete Permanently"}
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </AppShell>
  );
}

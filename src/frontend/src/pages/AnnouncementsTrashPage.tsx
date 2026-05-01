import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonCard } from "@/components/SkeletonCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  apiGetCachedTrashedAnnouncements,
  apiDeleteAnnouncement,
  apiEmptyAnnouncementTrash,
  apiGetTrashedAnnouncements,
  apiRestoreAnnouncement,
  formatAudienceSummary,
  getManageableBranches,
  getManageableDepartmentsForBranch,
} from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import type { Announcement } from "@/types";
import { useNavigate } from "@tanstack/react-router";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ── Helpers ────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  HR: "bg-secondary/20 text-secondary border-secondary/30",
  IT: "bg-accent/20 text-accent-foreground border-accent/30",
  General: "bg-primary/15 text-primary border-primary/30",
};

// ── Trashed Announcement Card ──────────────────────────────────────────────────

function TrashedCard({
  ann,
  onRestore,
  onDelete,
}: {
  ann: Announcement;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const category = ann.category || "General";
  const colorClass = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.General;
  const audienceSummary = formatAudienceSummary(
    ann.branchScope,
    ann.departmentScope,
  );
  const date = new Date(Number(ann.createdAt)).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className="glass-card rounded-xl p-5 flex items-start gap-4 opacity-80"
      data-ocid={`trash.item.${ann.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge
            variant="outline"
            className={`text-[10px] px-2 py-0.5 border ${colorClass}`}
          >
            {category}
          </Badge>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
        <h3 className="font-display font-semibold text-sm text-foreground line-clamp-1 mb-1">
          {ann.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {ann.content}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {audienceSummary}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-2">
          By {ann.authorName}
        </p>
      </div>

      <div className="flex flex-col gap-2 flex-shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onRestore(ann.id)}
          className="text-secondary border-secondary/30 hover:bg-secondary/10 hover:text-secondary"
          data-ocid={`trash.restore.${ann.id}`}
        >
          <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
          Restore
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              data-ocid={`trash.delete.${ann.id}`}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent data-ocid={`trash.delete_dialog.${ann.id}`}>
            <AlertDialogHeader>
              <AlertDialogTitle>Permanently delete?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &ldquo;{ann.title}&rdquo;. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-ocid={`trash.delete_cancel.${ann.id}`}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(ann.id)}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                data-ocid={`trash.delete_confirm.${ann.id}`}
              >
                Delete permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnnouncementsTrashPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const cachedTrashed = apiGetCachedTrashedAnnouncements();
  const [trashed, setTrashed] = useState<Announcement[]>(() => cachedTrashed);
  const [loading, setLoading] = useState(false);
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const manageableBranches = getManageableBranches(user);

  useEffect(() => {
    let cancelled = false;

    async function loadTrash() {
      try {
        const data = await apiGetTrashedAnnouncements();
        if (cancelled) return;
        setTrashed(data);
      } catch {
        if (cancelled) return;
        setTrashed([]);
        toast.error("Recycle Bin could not be loaded. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTrash();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRestore(id: number) {
    const result = await apiRestoreAnnouncement(id);
    if ("err" in result) {
      toast.error(result.err);
      return;
    }
    setTrashed((prev) => prev.filter((a) => a.id !== id));
    toast.success("Announcement restored");
  }

  async function handleDelete(id: number) {
    const result = await apiDeleteAnnouncement(id);
    if ("err" in result) {
      toast.error(result.err);
      return;
    }
    setTrashed((prev) => prev.filter((a) => a.id !== id));
    toast.success("Announcement permanently deleted");
  }

  async function handleEmptyTrash() {
    const result = await apiEmptyAnnouncementTrash();
    if ("err" in result) {
      toast.error(result.err);
      return;
    }
    setTrashed([]);
    setEmptyTrashOpen(false);
    toast.success("Trash emptied");
  }

  const availableBranches = useMemo(() => {
    const visible = new Set<string>();
    trashed.forEach((announcement) => {
      (announcement.branchScope ?? ["ALL"]).forEach((branch) => {
        if (branch !== "ALL") visible.add(branch);
      });
    });
    const ordered = manageableBranches.length > 0 ? manageableBranches : Array.from(visible);
    return ordered.filter((branch) => visible.has(branch));
  }, [manageableBranches, trashed]);

  const availableDepartments = useMemo(() => {
    const visible = new Set<string>();
    trashed
      .filter((announcement) => {
        if (branchFilter === "ALL") return true;
        const branches = announcement.branchScope ?? ["ALL"];
        return branches.includes("ALL") || branches.includes(branchFilter);
      })
      .forEach((announcement) => {
        (announcement.departmentScope ?? ["ALL"]).forEach((department) => {
          if (department !== "ALL") visible.add(department);
        });
      });
    if (branchFilter !== "ALL") {
      const manageable = getManageableDepartmentsForBranch(user, branchFilter);
      return manageable.filter((department) => visible.has(department));
    }
    return Array.from(visible).sort();
  }, [branchFilter, trashed, user]);

  const filteredTrash = useMemo(
    () =>
      trashed.filter((announcement) => {
        const branches = announcement.branchScope ?? ["ALL"];
        const departments = announcement.departmentScope ?? ["ALL"];
        const branchMatches =
          branchFilter === "ALL" ||
          branches.includes("ALL") ||
          branches.includes(branchFilter);
        const departmentMatches =
          departmentFilter === "ALL" ||
          departments.includes("ALL") ||
          departments.includes(departmentFilter);
        return branchMatches && departmentMatches;
      }),
    [branchFilter, departmentFilter, trashed],
  );

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6" data-ocid="trash.page">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <Trash2 className="h-6 w-6 text-destructive/70" />
              Recycle Bin
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Trashed announcements — restore or delete permanently
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Branch scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All branches</SelectItem>
                {availableBranches.map((branch) => (
                  <SelectItem key={branch} value={branch}>
                    {branch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Department scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All departments</SelectItem>
                {availableDepartments.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/announcements" })}
              data-ocid="trash.back.link"
            >
              ← Back to Announcements
            </Button>
            {trashed.length > 0 && (
              <AlertDialog
                open={emptyTrashOpen}
                onOpenChange={setEmptyTrashOpen}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    data-ocid="trash.empty_trash.delete_button"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Empty Trash
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent data-ocid="trash.empty_trash_dialog.dialog">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Empty the trash?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All {trashed.length} trashed announcement
                      {trashed.length !== 1 ? "s" : ""} will be permanently
                      deleted. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      onClick={() => setEmptyTrashOpen(false)}
                      data-ocid="trash.empty_cancel.cancel_button"
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleEmptyTrash}
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                      data-ocid="trash.empty_confirm.confirm_button"
                    >
                      Delete all permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Count badge */}
        {!loading && filteredTrash.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {filteredTrash.length} item{filteredTrash.length !== 1 ? "s" : ""} in trash
            </Badge>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <SkeletonCard key={String(i)} lines={3} />
            ))}
          </div>
        ) : filteredTrash.length === 0 ? (
          <EmptyState
            icon={<Trash2 className="h-10 w-10" />}
            title="Trash is empty"
            description="No trashed announcements match the current branch or department filter."
            data-ocid="trash.empty_state"
          />
        ) : (
          <div className="space-y-3" data-ocid="trash.list">
            {filteredTrash.map((ann) => (
              <TrashedCard
                key={String(ann.id)}
                ann={ann}
                onRestore={handleRestore}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

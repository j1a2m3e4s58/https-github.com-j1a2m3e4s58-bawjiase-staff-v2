import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { RoleGuard } from "@/components/RoleGuard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  apiCreateAnnouncement,
  apiDismissAnnouncement,
  apiGetAnnouncements,
  apiGetCachedAnnouncements,
  resolveAnnouncementAssetUrl,
  apiTrashAnnouncement,
  apiUpdateAnnouncement,
  apiVoteAnnouncementPoll,
  canManageAllDepartmentsForBranch,
  formatAudienceSummary,
  getManageableBranches,
  getManageableDepartmentsForBranch,
  getScopeCoverageWarning,
  userCanManageScopedItem,
  userHasPermission,
} from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import { DEPARTMENTS, type AnnouncementWithPoll, type PollOption, type User } from "@/types";
import { Link } from "@tanstack/react-router";
import {
  Download,
  Eye,
  FileText,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const ANNOUNCEMENTS_PAGE_SIZE = 12;

// ── Helpers ────────────────────────────────────────────────────────────────────

function getAnnouncementCategory(announcement: AnnouncementWithPoll): string {
  return announcement.category || "General";
}

const CATEGORY_COLORS: Record<string, string> = {
  HR: "bg-secondary/20 text-secondary border-secondary/30",
  IT: "bg-accent/20 text-accent-foreground border-accent/30",
  General: "bg-primary/15 text-primary border-primary/30",
};

function getDateLabel(ts: bigint): string {
  const d = new Date(Number(ts));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (itemDay.getTime() === today.getTime()) return "Today";
  if (itemDay.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-GH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function groupByDate(items: AnnouncementWithPoll[]) {
  const groups: Record<string, AnnouncementWithPoll[]> = {};
  for (const item of items) {
    const label = getDateLabel(item.createdAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  return groups;
}

// ── Poll Widget ────────────────────────────────────────────────────────────────

function PollWidget({
  poll,
  announcementId,
}: {
  poll: NonNullable<AnnouncementWithPoll["poll"]>;
  announcementId: number;
}) {
  const { user } = useAuth();
  const [voted, setVoted] = useState<number | null>(poll.userVotedOptionId);
  const [options, setOptions] = useState<PollOption[]>(poll.options);
  const [total, setTotal] = useState(poll.totalVotes);
  const [submittingVote, setSubmittingVote] = useState(false);

  async function handleVote(optionId: number) {
    if (voted !== null || !poll.isActive || !user || submittingVote) return;
    setSubmittingVote(true);
    const result = await apiVoteAnnouncementPoll(poll.id, optionId, user.id);
    setSubmittingVote(false);
    if ("err" in result) {
      toast.error(result.err);
      return;
    }
    setVoted(result.ok.userVotedOptionId);
    setTotal(result.ok.totalVotes);
    setOptions(result.ok.options);
    toast.success("Vote recorded!");
  }

  return (
    <div
      className="mt-4 pt-4 border-t border-border/30 space-y-2"
      data-ocid={`announcements.poll.${announcementId}`}
    >
      <p className="text-sm font-semibold text-foreground/80">
        {poll.question}
      </p>
      <div className="space-y-2">
        {options.map((opt) => {
          const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
          const isVoted = voted === opt.id;
          return (
            <button
              key={String(opt.id)}
              type="button"
              onClick={() => handleVote(opt.id)}
              disabled={voted !== null || !poll.isActive || submittingVote}
              className={`w-full text-left rounded-lg overflow-hidden border transition-smooth ${
                isVoted
                  ? "border-primary/50 bg-primary/10"
                  : "border-border/40 hover:border-primary/30 hover:bg-muted/40"
              } disabled:cursor-default`}
              data-ocid={`announcements.poll.option.${opt.id}`}
            >
              <div className="relative px-4 py-2">
                {voted !== null && (
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/10 rounded-lg transition-all"
                    style={{ width: `${pct}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between">
                  <span className="text-sm text-foreground/90">{opt.text}</span>
                  {voted !== null && (
                    <span className="text-sm font-bold text-primary">
                      {pct}%
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {total} {total === 1 ? "vote" : "votes"} ·{" "}
        {poll.isActive ? "Poll open" : "Poll closed"}
      </p>
    </div>
  );
}

function AnnouncementAttachment({ ann }: { ann: AnnouncementWithPoll }) {
  if (!ann.fileUrl && !ann.imageUrl) return null;
  const resolvedImageUrl = resolveAnnouncementAssetUrl(ann.imageUrl);
  const resolvedFileUrl = resolveAnnouncementAssetUrl(ann.fileUrl);

  const filename = ann.attachmentName || "Attached file";
  const linkLabel = ann.allowDownload ? "Download File" : "View File";

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border/30 bg-background/40 p-4">
      {resolvedImageUrl && (
        <div className="overflow-hidden rounded-xl border border-border/30 bg-muted/30">
          <img
            src={resolvedImageUrl}
            alt={ann.title}
            className="max-h-[420px] w-full object-cover"
          />
        </div>
      )}

      {resolvedFileUrl && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-border/30 bg-card/70 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {filename}
              </p>
              <p className="text-xs text-muted-foreground">
                {ann.allowDownload ? "Download available" : "View only"}
              </p>
            </div>
          </div>

          <Button asChild size="sm" variant="outline">
            <a
              href={resolvedFileUrl}
              target="_blank"
              rel="noreferrer"
              download={ann.allowDownload ? filename : undefined}
            >
              {ann.allowDownload ? (
                <Download className="mr-2 h-4 w-4" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              {linkLabel}
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Announcement Card ─────────────────────────────────────────────────────────

function AnnouncementCard({
  ann,
  onDismiss,
  onEdit,
  onTrash,
  isAdmin,
}: {
  ann: AnnouncementWithPoll;
  onDismiss: (id: number) => void;
  onEdit: (ann: AnnouncementWithPoll) => void;
  onTrash: (id: number) => void;
  isAdmin: boolean;
}) {
  const category = getAnnouncementCategory(ann);
  const colorClass = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.General;
  const audienceSummary = formatAudienceSummary(
    ann.branchScope,
    ann.departmentScope,
  );
  const date = new Date(Number(ann.createdAt)).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="glass-card rounded-xl p-5 group relative"
      data-ocid={`announcements.item.${ann.id}`}
    >
      <div className="flex items-start gap-2 mb-2">
        <Badge
          variant="outline"
          className={`text-[10px] px-2 py-0.5 border ${colorClass}`}
        >
          {category}
        </Badge>
        <span className="text-xs text-muted-foreground ml-auto pt-0.5 whitespace-nowrap">
          {date}
        </span>
      </div>
      <h3 className="font-display font-bold text-base text-foreground leading-snug mb-2">
        {ann.title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {ann.content}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        {audienceSummary}
      </p>
      <AnnouncementAttachment ann={ann} />
      <p className="text-xs text-muted-foreground/70 mt-3">
        By {ann.authorName}
      </p>

      {ann.poll && <PollWidget poll={ann.poll} announcementId={ann.id} />}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/20">
        <button
          type="button"
          onClick={() => onDismiss(ann.id)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-smooth px-2 py-1 rounded hover:bg-muted/60"
          data-ocid={`announcements.dismiss.${ann.id}`}
        >
          <X className="h-3.5 w-3.5" />
          Dismiss
        </button>
        {isAdmin && (
          <>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => onEdit(ann)}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1.5 transition-smooth px-2 py-1 rounded hover:bg-primary/10"
              data-ocid={`announcements.edit.${ann.id}`}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onTrash(ann.id)}
              className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1.5 transition-smooth px-2 py-1 rounded hover:bg-destructive/10"
              data-ocid={`announcements.trash.${ann.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Move to Trash
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────

interface AnnouncementFormData {
  title: string;
  content: string;
  category: string;
  pollQuestion: string;
  pollOptions: string[];
  branchScope: string[];
  departmentScope: string[];
  visibility: "General" | "Department";
  department: string | null;
}

function AnnouncementModal({
  open,
  onClose,
  onSave,
  editing,
  currentUser,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: AnnouncementFormData) => Promise<void>;
  editing: AnnouncementWithPoll | null;
  currentUser: User | null;
}) {
  const [form, setForm] = useState<AnnouncementFormData>({
    title: editing?.title ?? "",
    content: editing?.content ?? "",
    category: editing ? getAnnouncementCategory(editing) : "General",
    pollQuestion: editing?.poll?.question ?? "",
    pollOptions: editing?.poll?.options.map((o) => o.text) ?? ["", ""],
    branchScope: editing?.branchScope ?? ["ALL"],
    departmentScope:
      editing?.departmentScope ??
      (editing?.visibility === "Department" && editing.department
        ? [editing.department]
        : ["ALL"]),
    visibility: editing?.visibility ?? "General",
    department: editing?.department ?? null,
  });
  const [submitting, setSubmitting] = useState(false);
  const manageableBranches = useMemo(
    () => getManageableBranches(currentUser),
    [currentUser],
  );
  const canTargetAllBranches =
    currentUser?.role === "SuperAdmin" || currentUser?.role === "HRAdmin";
  const branchTarget = form.branchScope[0] ?? "ALL";
  const manageableDepartments = useMemo(
    () =>
      branchTarget === "ALL"
        ? [...DEPARTMENTS]
        : getManageableDepartmentsForBranch(currentUser, branchTarget),
    [branchTarget, currentUser],
  );

  useEffect(() => {
    setForm({
      title: editing?.title ?? "",
      content: editing?.content ?? "",
      category: editing ? getAnnouncementCategory(editing) : "General",
      pollQuestion: editing?.poll?.question ?? "",
      pollOptions: editing?.poll?.options.map((o) => o.text) ?? ["", ""],
      branchScope:
        editing?.branchScope ??
        (canTargetAllBranches ? ["ALL"] : manageableBranches.slice(0, 1)),
      departmentScope:
        editing?.departmentScope ??
        (editing?.visibility === "Department" && editing.department
          ? [editing.department]
          : ["ALL"]),
      visibility: editing?.visibility ?? "General",
      department: editing?.department ?? null,
    });
  }, [canTargetAllBranches, editing, manageableBranches]);

  useEffect(() => {
    if (
      !canTargetAllBranches &&
      branchTarget === "ALL" &&
      manageableBranches.length > 0
    ) {
      setForm((current) => ({
        ...current,
        branchScope: [manageableBranches[0]],
      }));
      return;
    }
    if (
      form.visibility === "General" &&
      branchTarget !== "ALL" &&
      !canManageAllDepartmentsForBranch(currentUser, branchTarget)
    ) {
      setForm((current) => ({
        ...current,
        visibility: "Department",
        department: manageableDepartments[0] ?? current.department,
        departmentScope: manageableDepartments[0] ? [manageableDepartments[0]] : current.departmentScope,
      }));
      return;
    }
    if (
      form.visibility === "Department" &&
      !form.department &&
      manageableDepartments.length > 0
    ) {
      setForm((current) => ({
        ...current,
        department: manageableDepartments[0],
        departmentScope: [manageableDepartments[0]],
      }));
    }
  }, [
    branchTarget,
    canTargetAllBranches,
    currentUser,
    form.department,
    form.visibility,
    manageableBranches,
    manageableDepartments,
  ]);

  const audienceSummary = formatAudienceSummary(
    form.branchScope,
    form.departmentScope,
  );
  const scopeWarning = getScopeCoverageWarning(
    currentUser,
    branchTarget,
    form.visibility === "Department" ? form.department ?? "" : "ALL",
  );

  function addPollOption() {
    setForm((f) => ({ ...f, pollOptions: [...f.pollOptions, ""] }));
  }

  function updatePollOption(idx: number, val: string) {
    setForm((f) => {
      const newOpts = [...f.pollOptions];
      newOpts[idx] = val;
      return { ...f, pollOptions: newOpts };
    });
  }

  function removePollOption(idx: number) {
    setForm((f) => ({
      ...f,
      pollOptions: f.pollOptions.filter((_, i) => i !== idx),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSubmitting(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-ocid="announcements.create_dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? "Edit Announcement" : "Create Announcement"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Title *</Label>
            <Input
              id="ann-title"
              placeholder="Announcement title"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              data-ocid="announcements.title.input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ann-body">Content *</Label>
            <Textarea
              id="ann-body"
              placeholder="Write the full announcement body..."
              rows={5}
              value={form.content}
              onChange={(e) =>
                setForm((f) => ({ ...f, content: e.target.value }))
              }
              data-ocid="announcements.content.textarea"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger data-ocid="announcements.category.select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General">General</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="IT">IT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ann-image">Image URL (optional)</Label>
              <Input
                id="ann-image"
                placeholder="https://..."
                disabled
                className="opacity-50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Branch Audience</Label>
              <Select
                value={branchTarget}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    branchScope: [value],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canTargetAllBranches ? (
                    <SelectItem value="ALL">All branches</SelectItem>
                  ) : null}
                  {manageableBranches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department Audience</Label>
              <Select
                value={form.visibility === "Department" ? form.department ?? "" : "ALL"}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    visibility: value === "ALL" ? "General" : "Department",
                    department: value === "ALL" ? null : value,
                    departmentScope: value === "ALL" ? ["ALL"] : [value],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canTargetAllBranches ||
                  canManageAllDepartmentsForBranch(currentUser, branchTarget) ? (
                    <SelectItem value="ALL">All departments</SelectItem>
                  ) : null}
                  {manageableDepartments.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
            <p className="text-sm font-medium text-foreground">
              {audienceSummary}
            </p>
            {scopeWarning ? (
              <p className="mt-1 text-xs text-amber-500">{scopeWarning}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                This announcement will only appear for the branch and department audience shown above.
              </p>
            )}
          </div>

          {/* Poll section */}
          <div className="space-y-3 pt-3 border-t border-border/30">
            <Label className="text-sm font-semibold">Poll (optional)</Label>
            <Input
              placeholder="Poll question"
              value={form.pollQuestion}
              onChange={(e) =>
                setForm((f) => ({ ...f, pollQuestion: e.target.value }))
              }
              data-ocid="announcements.poll_question.input"
            />
            {form.pollQuestion && (
              <div className="space-y-2">
                {form.pollOptions.map((opt, idx) => (
                  <div key={String(idx)} className="flex gap-2">
                    <Input
                      placeholder={`Option ${idx + 1}`}
                      value={opt}
                      onChange={(e) => updatePollOption(idx, e.target.value)}
                      data-ocid={`announcements.poll_option.input.${idx + 1}`}
                    />
                    {form.pollOptions.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePollOption(idx)}
                        data-ocid={`announcements.remove_poll_option.${idx + 1}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPollOption}
                  data-ocid="announcements.add_poll_option.button"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Option
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-ocid="announcements.cancel.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              data-ocid="announcements.submit.submit_button"
            >
              {submitting ? "Saving..." : editing ? "Save Changes" : "Publish"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<AnnouncementWithPoll[]>(
    () => apiGetCachedAnnouncements(user?.id),
  );
  const [loading, setLoading] = useState(() =>
    apiGetCachedAnnouncements(user?.id).length === 0,
  );
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [filterCategory, setFilterCategory] = useState("all");
  const manageableBranches = getManageableBranches(user);
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementWithPoll | null>(null);
  const [visibleCount, setVisibleCount] = useState(ANNOUNCEMENTS_PAGE_SIZE);
  const isAdmin = userHasPermission(user, "announcements");

  useEffect(() => {
    if (!user) return;
    const currentUserId = user.id;
    let cancelled = false;

    async function loadAnnouncements() {
      setAnnouncements(apiGetCachedAnnouncements(currentUserId));
      try {
        const data = await apiGetAnnouncements(currentUserId);
        if (cancelled) return;
        setAnnouncements(data);
      } catch {
        if (cancelled) return;
        setAnnouncements(apiGetCachedAnnouncements(currentUserId));
        toast.error("Announcements could not be loaded. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAnnouncements();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    setVisibleCount(ANNOUNCEMENTS_PAGE_SIZE);
  }, [branchFilter, deferredSearch, departmentFilter, filterCategory]);

  async function handleDismiss(id: number) {
    if (!user) return;
    const result = await apiDismissAnnouncement(id, user.id);
    if ("err" in result) {
      toast.error(result.err);
      return;
    }
    setAnnouncements((prev) => prev.filter((announcement) => announcement.id !== id));
  }

  async function handleTrash(id: number) {
    const result = await apiTrashAnnouncement(id);
    if ("err" in result) {
      toast.error(result.err);
      return;
    }
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    toast.success("Moved to trash");
  }

  function handleEdit(ann: AnnouncementWithPoll) {
    setEditing(ann);
    setModalOpen(true);
  }

  function handleCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  async function handleSave(data: AnnouncementFormData) {
    if (!user) return;
    if (editing) {
      const result = await apiUpdateAnnouncement(editing.id, {
        title: data.title,
        content: data.content,
        category: data.category,
        pollQuestion: data.pollQuestion,
        pollOptions: data.pollOptions,
        branchScope: data.branchScope,
        departmentScope: data.departmentScope,
        visibility: data.visibility,
        department: data.department,
      });
      if ("err" in result) {
        toast.error(result.err);
        return;
      }
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === editing.id ? result.ok : a)),
      );
      toast.success("Announcement updated");
    } else {
      const result = await apiCreateAnnouncement(
        {
          title: data.title,
          content: data.content,
          category: data.category,
          pollQuestion: data.pollQuestion,
          pollOptions: data.pollOptions,
          branchScope: data.branchScope,
          departmentScope: data.departmentScope,
          visibility: data.visibility,
          department: data.department,
        },
        {
          id: user.id,
          fullname: user.fullname,
          department: user.department,
        },
      );
      if ("err" in result) {
        toast.error(result.err);
        return;
      }
      setAnnouncements((prev) => [result.ok, ...prev]);
      toast.success("Announcement published");
    }
  }

  const availableBranches = useMemo(() => {
    const visible = new Set<string>();
    announcements.forEach((announcement) => {
      (announcement.branchScope ?? ["ALL"]).forEach((branch) => {
        if (branch !== "ALL") visible.add(branch);
      });
    });
    const ordered = manageableBranches.length > 0 ? manageableBranches : Array.from(visible);
    return ordered.filter((branch) => visible.has(branch));
  }, [announcements, manageableBranches]);

  const availableDepartments = useMemo(() => {
    const visible = new Set<string>();
    announcements
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
  }, [announcements, branchFilter, user]);

  useEffect(() => {
    if (branchFilter !== "ALL" && availableBranches.length > 0 && !availableBranches.includes(branchFilter)) {
      setBranchFilter("ALL");
    }
  }, [availableBranches, branchFilter]);

  useEffect(() => {
    if (
      departmentFilter !== "ALL" &&
      availableDepartments.length > 0 &&
      !availableDepartments.includes(departmentFilter)
    ) {
      setDepartmentFilter("ALL");
    }
  }, [availableDepartments, departmentFilter]);

  const filtered = useMemo(() => announcements.filter((a) => {
    if (a.isTrashed) return false;
    const cat = getAnnouncementCategory(a);
    const branches = a.branchScope ?? ["ALL"];
    const departments = a.departmentScope ?? ["ALL"];
    const branchMatches =
      branchFilter === "ALL" ||
      branches.includes("ALL") ||
      branches.includes(branchFilter);
    const departmentMatches =
      departmentFilter === "ALL" ||
      departments.includes("ALL") ||
      departments.includes(departmentFilter);
    if (!branchMatches || !departmentMatches) return false;
    if (filterCategory !== "all" && cat !== filterCategory) return false;
    if (
      deferredSearch &&
      !a.title.toLowerCase().includes(deferredSearch.toLowerCase())
    )
      return false;
    return true;
  }), [announcements, branchFilter, deferredSearch, departmentFilter, filterCategory]);

  const visibleAnnouncements = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const grouped = useMemo(
    () => groupByDate(visibleAnnouncements),
    [visibleAnnouncements],
  );
  const dateGroups = Object.keys(grouped);

  return (
    <AppShell>
      <div
        className="max-w-5xl mx-auto space-y-6"
        data-ocid="announcements.page"
      >
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">
              Announcements
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Bank-wide news, policies and updates
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RoleGuard roles={["SuperAdmin", "HRAdmin", "Supervisor"]} permission="announcements">
              <Button
                asChild
                size="sm"
                data-ocid="announcements.news_portal.link"
              >
                <Link to="/news-portal">
                  <Megaphone className="h-4 w-4 mr-2" />
                  Post News
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                data-ocid="announcements.recycle_bin.link"
              >
                <Link to="/announcements/trash">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Recycle Bin
                </Link>
              </Button>
            </RoleGuard>
          </div>
        </div>

        {/* Filter bar */}
        <div
          className="flex items-center gap-3 flex-wrap"
          data-ocid="announcements.filter.section"
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search announcements..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-ocid="announcements.search.search_input"
            />
            </div>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger
              className="w-44"
              data-ocid="announcements.branch_filter.select"
            >
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
            <SelectTrigger
              className="w-44"
              data-ocid="announcements.department_filter.select"
            >
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
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger
              className="w-36"
              data-ocid="announcements.category_filter.select"
            >
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="General">General</SelectItem>
              <SelectItem value="HR">HR</SelectItem>
              <SelectItem value="IT">IT</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={String(i)} lines={4} hasImage />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-10 w-10" />}
            title="No announcements"
            description={
              search || filterCategory !== "all"
                ? "Try adjusting your search or filter."
                : "No announcements have been posted yet."
            }
            data-ocid="announcements.empty_state"
          />
        ) : (
          <div className="space-y-8">
            {dateGroups.map((group) => (
              <div key={group}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {group}
                  </span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
                <div className="space-y-4">
                  {grouped[group].map((ann) => (
                    <AnnouncementCard
                      key={String(ann.id)}
                      ann={ann}
                      onDismiss={handleDismiss}
                      onEdit={handleEdit}
                      onTrash={handleTrash}
                      isAdmin={userCanManageScopedItem(user, ann, "announcements")}
                    />
                  ))}
                </div>
              </div>
            ))}
            {filtered.length > visibleAnnouncements.length ? (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setVisibleCount((current) => current + ANNOUNCEMENTS_PAGE_SIZE)
                  }
                  data-ocid="announcements.load_more_button"
                >
                  Load more announcements
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {/* Floating action button (admin) */}
        <RoleGuard roles={["SuperAdmin", "HRAdmin", "Supervisor"]} permission="announcements">
          <button
            type="button"
            onClick={handleCreate}
            className="fixed bottom-24 md:bottom-6 right-6 w-14 h-14 rounded-full glass-card-elevated bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-smooth z-30"
            aria-label="Create announcement"
            data-ocid="announcements.create.open_modal_button"
          >
            <Plus className="h-6 w-6" />
          </button>
        </RoleGuard>

      <AnnouncementModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        editing={editing}
        currentUser={user ?? null}
      />
      </div>
    </AppShell>
  );
}

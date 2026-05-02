import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LiveSyncBadge } from "@/components/LiveSyncBadge";
import { RoleGuard } from "@/components/RoleGuard";
import { RetryPanel } from "@/components/RetryPanel";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  apiGetCachedDashboardOverview,
  apiGetCachedAnnouncements,
  apiDismissAnnouncement,
  apiGetAnnouncements,
  apiGetDashboardOverview,
  resolveAnnouncementAssetUrl,
  apiTrashAnnouncement,
  apiVoteAnnouncementPoll,
  formatAudienceSummary,
  getManageableBranches,
  getManageableDepartmentsForBranch,
  userCanManageScopedItem,
  userHasPermission,
} from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import type {
  AnnouncementWithPoll,
  DashboardOverview,
  PollOption,
} from "@/types";
import { DEPARTMENTS } from "@/types";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  Download,
  Eye,
  FileText,
  HeadphonesIcon,
  Lock,
  Megaphone,
  Monitor,
  Newspaper,
  Pencil,
  ShieldCheck,
  Ticket,
  Trash2,
  UserRoundCog,
  Users,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

const USERS_UPDATED_EVENT = "bcb:users-updated";
const BRANCH_BAR_COLORS: Record<string, string> = {
  "HEAD OFFICE": "#4F8EF7",
  BAWJIASE: "#2FBF71",
  ADEISO: "#F59E0B",
  OFAAKOR: "#EF4444",
  "KASOA NEW MARKET": "#8B5CF6",
  "KASOA MAIN": "#06B6D4",
};

function StatTile({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="metric-card min-h-[160px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p className="mt-6 font-display text-3xl font-bold text-foreground">
            {value}
          </p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}

function ShortcutTile({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="glass-card panel-sharp min-h-[148px] p-5 flex flex-col items-center justify-center gap-3 text-center font-display font-bold text-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 transition-smooth"
    >
      <div className="flex h-12 w-12 items-center justify-center border border-primary/20 bg-primary/10 text-primary">{icon}</div>
      <span>{label}</span>
    </Link>
  );
}

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

function AnnouncementAttachment({
  ann,
  compact = false,
}: {
  ann: AnnouncementWithPoll;
  compact?: boolean;
}) {
  if (!ann.fileUrl && !ann.imageUrl) return null;
  const resolvedImageUrl = resolveAnnouncementAssetUrl(ann.imageUrl);
  const resolvedFileUrl = resolveAnnouncementAssetUrl(ann.fileUrl);

  const filename = ann.attachmentName || "Attached file";
  const linkLabel = ann.allowDownload ? "Download File" : "View File";

  return (
    <div className={compact ? "mt-3 space-y-3" : "mt-4 space-y-4"}>
      {resolvedImageUrl && (
        <div className="panel-sharp overflow-hidden border border-border/30 bg-muted/30">
          <img
            src={resolvedImageUrl}
            alt={ann.title}
            loading="lazy"
            decoding="async"
            className={
              compact
                ? "h-44 w-full object-cover"
                : "max-h-[70vh] w-full object-contain"
            }
          />
        </div>
      )}

      {resolvedFileUrl && (
        <div className="panel-sharp flex flex-wrap items-center justify-between gap-3 border border-border/30 bg-background/50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {filename}
            </p>
            <p className="text-xs text-muted-foreground">
              {ann.allowDownload ? "Download available" : "View only"}
            </p>
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

function PollWidget({
  announcement,
  onPollUpdated,
}: {
  announcement: AnnouncementWithPoll;
  onPollUpdated: (nextPoll: NonNullable<AnnouncementWithPoll["poll"]>) => void;
}) {
  const { user } = useAuth();
  const poll = announcement.poll;
  const [voted, setVoted] = useState<number | null>(
    poll?.userVotedOptionId ?? null,
  );
  const [options, setOptions] = useState<PollOption[]>(poll?.options ?? []);
  const [total, setTotal] = useState(poll?.totalVotes ?? 0);
  const [submittingVote, setSubmittingVote] = useState(false);

  useEffect(() => {
    setVoted(poll?.userVotedOptionId ?? null);
    setOptions(poll?.options ?? []);
    setTotal(poll?.totalVotes ?? 0);
  }, [poll]);

  if (!poll) return null;
  const activePoll = poll;

  async function handleVote(optionId: number) {
    if (voted !== null || !activePoll.isActive || !user || submittingVote) {
      return;
    }
    setSubmittingVote(true);
    const result = await apiVoteAnnouncementPoll(
      activePoll.id,
      optionId,
      user.id,
    );
    setSubmittingVote(false);
    if ("err" in result) {
      toast.error(result.err);
      return;
    }
    setVoted(result.ok.userVotedOptionId);
    setOptions(result.ok.options);
    setTotal(result.ok.totalVotes);
    onPollUpdated(result.ok);
    toast.success("Vote recorded!");
  }

  return (
    <div className="mt-4 border-t border-border/30 pt-4 space-y-2">
      <p className="text-sm font-semibold text-foreground">{poll.question}</p>
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
            className={`panel-sharp w-full overflow-hidden border text-left transition-smooth ${
                isVoted
                  ? "border-primary/50 bg-primary/10"
                  : "border-border/40 hover:border-primary/30 hover:bg-muted/40"
              } disabled:cursor-default`}
            >
              <div className="relative px-4 py-2.5">
                {voted !== null && (
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/10"
                    style={{ width: `${pct}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between gap-3">
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

function NewsViewDialog({
  ann,
  open,
  onOpenChange,
  onPollUpdated,
  onDismiss,
  onTrash,
  canManage,
}: {
  ann: AnnouncementWithPoll | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPollUpdated: (
    announcementId: number,
    nextPoll: NonNullable<AnnouncementWithPoll["poll"]>,
  ) => void;
  onDismiss: (announcementId: number) => void;
  onTrash: (announcementId: number) => void;
  canManage: boolean;
}) {
  if (!ann) return null;

  const date = new Date(Number(ann.createdAt)).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(96vw,1400px)] max-h-[96vh] overflow-hidden p-0">
        <div className="flex flex-col max-h-[96vh]">
          <DialogHeader className="border-b border-border/30 px-6 py-5 text-left">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge variant="outline">{ann.category}</Badge>
                  <span className="text-xs text-muted-foreground">{date}</span>
                </div>
                <DialogTitle className="font-display text-2xl leading-tight">
                  {ann.title}
                </DialogTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Posted by {ann.authorName}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatAudienceSummary(ann.branchScope, ann.departmentScope)}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="overflow-y-auto px-6 py-5">
            <AnnouncementAttachment ann={ann} />
            <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-foreground/90">
              {ann.content}
            </div>
            {ann.poll && (
              <PollWidget
                announcement={ann}
                onPollUpdated={(nextPoll) => onPollUpdated(ann.id, nextPoll)}
              />
            )}
          </div>

          <DialogFooter className="border-t border-border/30 px-6 py-4 sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onDismiss(ann.id);
                  onOpenChange(false);
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Dismiss
              </Button>
              {canManage && (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/announcements">
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      onTrash(ann.id);
                      onOpenChange(false);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
            </div>
            <Button onClick={() => onOpenChange(false)}>
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnnouncementCard({
  ann,
  onOpen,
  onDismiss,
  onTrash,
  canManage,
}: {
  ann: AnnouncementWithPoll;
  onOpen: (announcement: AnnouncementWithPoll) => void;
  onDismiss: (announcementId: number) => void;
  onTrash: (announcementId: number) => void;
  canManage: boolean;
}) {
  const date = new Date(Number(ann.createdAt)).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="glass-card panel-sharp block w-full p-4 text-left transition-smooth hover:border-primary/40 hover:bg-primary/5">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="outline" className="text-[10px]">
          News
        </Badge>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{date}</span>
          <button
            type="button"
            onClick={() => onDismiss(ann.id)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          {canManage && (
            <>
              <Link
                to="/announcements"
                className="rounded-md p-1 text-primary hover:bg-primary/10"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => onTrash(ann.id)}
                className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onOpen(ann)}
        className="mt-3 block w-full text-left"
      >
        <h3 className="font-display text-base font-bold text-foreground">
          {ann.title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
          {ann.content}
        </p>
      </button>
      <AnnouncementAttachment ann={ann} compact />
      <p className="mt-3 text-xs text-muted-foreground">
        Posted by {ann.authorName}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatAudienceSummary(ann.branchScope, ann.departmentScope)}
      </p>
      {ann.poll && (
        <div className="panel-sharp mt-3 bg-muted/40 p-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Poll:</span>{" "}
          {ann.poll.question}
          <div className="mt-2 text-primary font-medium flex items-center gap-1.5">
            Open and choose an option
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>
      )}
    </div>
  );
}

function WelcomePanel({ fullname }: { fullname: string }) {
  const { user } = useAuth();
  const manageableBranches = getManageableBranches(user);
  const supervisorScopeSummary =
    user?.role === "Supervisor"
      ? manageableBranches.map((branch) =>
          formatAudienceSummary(
            [branch],
            getManageableDepartmentsForBranch(user, branch).length === DEPARTMENTS.length
              ? ["ALL"]
              : getManageableDepartmentsForBranch(user, branch),
          ),
        )
      : [];
  return (
    <section className="page-header min-h-[184px] flex flex-col justify-between gap-6">
      <div>
        <div className="page-kicker">Executive workspace</div>
        <h1 className="page-title max-w-3xl text-balance text-foreground md:text-[2.6rem]">
          Welcome, {fullname}!
        </h1>
        <p className="page-subtitle">
          Executive workspace for staff operations, internal communication, and
          branch-level oversight.
        </p>
      </div>
      <RoleGuard roles={["SuperAdmin", "HRAdmin", "Supervisor"]} permission="announcements">
        <div className="page-actions md:min-w-[260px] md:justify-end">
          <Button asChild size="sm" className="font-bold">
            <Link to="/news-portal">
              <Megaphone className="h-4 w-4 mr-2" />
              Post News
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary" className="font-bold">
            <Link to="/announcements/trash">
              <Trash2 className="h-4 w-4 mr-2" />
              Recycle Bin
            </Link>
          </Button>
        </div>
      </RoleGuard>
      {supervisorScopeSummary.length > 0 ? (
        <div className="surface-muted w-full p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            My Supervisor Scope
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {supervisorScopeSummary.map((summary) => (
              <Badge key={summary} variant="outline">
                {summary}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function NewsFeed({
  announcements,
}: {
  announcements: AnnouncementWithPoll[];
}) {
  const { user } = useAuth();
  const [newsItems, setNewsItems] =
    useState<AnnouncementWithPoll[]>(announcements);
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<AnnouncementWithPoll | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const canManage = userHasPermission(user, "announcements");

  useEffect(() => {
    setNewsItems(announcements);
  }, [announcements]);

  async function handleDismiss(announcementId: number) {
    if (!user) return;
    const result = await apiDismissAnnouncement(announcementId, user.id);
    if ("err" in result) {
      toast.error(result.err);
      return;
    }
    setNewsItems((current) =>
      current.filter((item) => item.id !== announcementId),
    );
    setSelectedAnnouncement((current) =>
      current?.id === announcementId ? null : current,
    );
  }

  async function handleTrash(announcementId: number) {
    if (!canManage) return;
    const result = await apiTrashAnnouncement(announcementId);
    if ("err" in result) {
      toast.error(result.err);
      return;
    }
    setNewsItems((current) =>
      current.filter((item) => item.id !== announcementId),
    );
    setSelectedAnnouncement((current) =>
      current?.id === announcementId ? null : current,
    );
    toast.success("Announcement deleted");
  }

  const groupedAnnouncements = useMemo(
    () => groupByDate(newsItems),
    [newsItems],
  );
  const dateGroups = Object.keys(groupedAnnouncements);

  return (
    <section className="space-y-4">
      <div className="section-heading">
        <div>
          <h2 className="section-title">
            <Newspaper className="h-5 w-5 text-primary" />
            News Feed
          </h2>
          <p className="section-copy">Internal announcements, updates, and policy communication.</p>
        </div>
      </div>
      {newsItems.length === 0 ? (
        <div className="glass-card panel-sharp-lg min-h-[240px] flex items-center justify-center">
          <EmptyState
            icon={<Newspaper className="h-10 w-10" />}
            title="No new announcements"
            description="There are no active announcements right now."
          />
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {dateGroups.map((group) => (
              <div key={group}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {group}
                  </span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupedAnnouncements[group].map((ann) => (
                    <AnnouncementCard
                      key={ann.id}
                      ann={ann}
                      canManage={userCanManageScopedItem(user, ann, "announcements")}
                      onDismiss={handleDismiss}
                      onTrash={handleTrash}
                      onOpen={(announcement) => {
                        setSelectedAnnouncement(announcement);
                        setViewOpen(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <NewsViewDialog
            ann={selectedAnnouncement}
            open={viewOpen}
            canManage={
              selectedAnnouncement
                ? userCanManageScopedItem(user, selectedAnnouncement, "announcements")
                : false
            }
            onDismiss={handleDismiss}
            onTrash={handleTrash}
            onOpenChange={(open) => {
              setViewOpen(open);
              if (!open) {
                setSelectedAnnouncement(null);
              }
            }}
            onPollUpdated={(announcementId, nextPoll) => {
              setNewsItems((current) =>
                current.map((item) =>
                  item.id === announcementId
                    ? { ...item, poll: nextPoll }
                    : item,
                ),
              );
              setSelectedAnnouncement((current) =>
                current?.id === announcementId
                  ? { ...current, poll: nextPoll }
                  : current,
              );
            }}
          />
        </>
      )}
    </section>
  );
}

function OperationsPanel({
  overview,
  canAccessITArea,
}: {
  overview: DashboardOverview;
  canAccessITArea: boolean;
}) {
  return (
    <aside className="space-y-4">
      {canAccessITArea && (
        <div className="glass-card panel-sharp-lg p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Operations Command
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Priority actions and internal control visibility for leadership
              use.
            </p>
          </div>
          <Badge>Live</Badge>
        </div>

        <Link
          to="/support/admin"
          className="block glass-card panel-sharp p-4 transition-smooth hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/40"
          data-ocid="dashboard.support_tickets.link"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-base flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Support Tickets
            </h3>
            <HeadphonesIcon className="h-5 w-5 text-secondary" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Live system status
          </p>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="surface-muted p-4 text-center">
              <div className="font-display text-3xl font-bold">
                {overview.supportPending}
              </div>
              <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Pending
              </div>
            </div>
            <div className="surface-muted p-4 text-center">
              <div className="font-display text-3xl font-bold">
                {overview.supportResolved}
              </div>
              <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Resolved
              </div>
            </div>
          </div>
        </Link>

        <div className="surface-muted mt-4 p-4">
          <h3 className="font-display font-bold text-sm flex items-center gap-2">
            <Lock className="h-4 w-4" />
            IT Security Center
          </h3>
          <p className="text-xs text-muted-foreground mt-2">
            Monitor audit trails, IP logs, and system access.
          </p>
          <Button asChild className="w-full mt-4" size="sm">
            <Link to="/audit">View Audit Logs</Link>
          </Button>
        </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <h2 className="font-display font-bold text-sm text-muted-foreground uppercase tracking-wider">
            Executive Shortcuts
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Jump into high-value actions without leaving the dashboard.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ShortcutTile
            to="/support/amendment"
            label="User Amendment"
            icon={<Monitor className="h-8 w-8" />}
          />
          <ShortcutTile
            to="/forms"
            label="Forms Centre"
            icon={<FileText className="h-8 w-8" />}
          />
          <ShortcutTile
            to="/handbook"
            label="Handbook"
            icon={<BookOpen className="h-8 w-8" />}
          />
          <ShortcutTile
            to="/support/incident"
            label="IT Support"
            icon={<HeadphonesIcon className="h-8 w-8" />}
          />
          <ShortcutTile
            to="/training"
            label="Training Portal"
            icon={<Video className="h-8 w-8" />}
          />
          <ShortcutTile
            to="/profile"
            label="Profile"
            icon={<UserRoundCog className="h-8 w-8" />}
          />
        </div>
      </div>
    </aside>
  );
}

function ExecutiveSummary({ overview }: { overview: DashboardOverview }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4">
      <div className="glass-card panel-sharp-lg p-6 min-h-[240px]">
        <Badge variant="outline" className="mb-8">
          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
          Executive Brief
        </Badge>
        <h2 className="font-display text-3xl font-bold text-foreground max-w-xl leading-tight">
          A sharper view of people, branch presence, and operational movement.
        </h2>
        <p className="mt-4 text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Track workforce distribution, branch coverage, and the balance between
          open actions and resolved internal support requests.
        </p>
      </div>

      <div className="glass-card panel-sharp-lg p-5">
        <h2 className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4">
          Leadership Snapshot
        </h2>
        <div className="space-y-3">
          {[
            {
              icon: <Building2 className="h-5 w-5" />,
              title: "Branch Presence",
              value: overview.topBranch,
              detail: `${overview.topBranchCount} staff currently represented.`,
            },
            {
              icon: <ShieldCheck className="h-5 w-5" />,
              title: "Largest Department",
              value: overview.topDepartment,
              detail: `${overview.topDepartmentCount} staff members on record.`,
            },
            {
              icon: <Megaphone className="h-5 w-5" />,
              title: "Visible Announcements",
              value: String(overview.newsTotal),
              detail: "current communication volume.",
            },
          ].map((item) => (
            <div key={item.title} className="glass-card panel-sharp flex items-center gap-4 p-4">
              <div className="panel-sharp flex h-11 w-11 items-center justify-center bg-primary/10 text-primary">
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {item.title}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">
                    {item.value}
                  </span>{" "}
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StaffDistribution({ overview }: { overview: DashboardOverview }) {
  return (
    <section className="glass-card panel-sharp-lg p-5">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Staff Distribution
        </h2>
        <Badge>Live</Badge>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={overview.branchDistribution}
          margin={{ top: 8, right: 16, left: 0, bottom: 44 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="oklch(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            angle={-42}
            textAnchor="end"
            interval={0}
            height={76}
            tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
          />
          <Tooltip
            contentStyle={{
              background: "oklch(var(--card))",
              border: "1px solid oklch(var(--border))",
              borderRadius: 8,
              fontSize: 12,
              color: "oklch(var(--foreground))",
            }}
          />
            <Bar
              dataKey="value"
              radius={[6, 6, 0, 0]}
              name="Staff"
            >
              {overview.branchDistribution.map((entry) => (
                <Cell
                  key={`branch-bar-${entry.name}`}
                  fill={BRANCH_BAR_COLORS[entry.name] ?? "oklch(var(--primary))"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<DashboardOverview | null>(() =>
    apiGetCachedDashboardOverview(),
  );
  const [announcements, setAnnouncements] = useState<AnnouncementWithPoll[]>(() =>
    apiGetCachedAnnouncements(user?.id),
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const canAccessITArea = user?.department?.toUpperCase() === "IT";

  useEffect(() => {
    let cancelled = false;

    async function refreshDashboard() {
      const [nextOverview, nextAnnouncements] = await Promise.all([
        apiGetDashboardOverview(),
        apiGetAnnouncements(user?.id),
      ]);
      if (cancelled) return;
      setOverview(nextOverview);
      setAnnouncements(nextAnnouncements);
      setLoadError(false);
    }

    async function loadDashboard() {
      try {
        await refreshDashboard();
      } catch {
        if (cancelled) return;
        if (!apiGetCachedDashboardOverview()) {
          setOverview(null);
        }
        setAnnouncements([]);
        setLoadError(true);
        toast.error("Dashboard data could not be loaded. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard();
    const handleUsersUpdated = () => {
      setOverview(apiGetCachedDashboardOverview());
      setAnnouncements(apiGetCachedAnnouncements(user?.id));
    };
    window.addEventListener(USERS_UPDATED_EVENT, handleUsersUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(USERS_UPDATED_EVENT, handleUsersUpdated);
    };
  }, [user?.id, user?.branch, user?.department, user?.role]);

  const retryDashboard = async () => {
    setLoading(true);
    try {
      const [nextOverview, nextAnnouncements] = await Promise.all([
        apiGetDashboardOverview(),
        apiGetAnnouncements(user?.id),
      ]);
      setOverview(nextOverview);
      setAnnouncements(nextAnnouncements);
      setLoadError(false);
    } catch {
      setLoadError(true);
      toast.error("Dashboard data could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div
        className="page-shell max-w-[1320px]"
        data-ocid="dashboard.page"
      >
        {loading || !overview ? (
          <>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={8} hasImage />
          </>
        ) : (
          <>
            <div className="flex justify-end">
              <LiveSyncBadge />
            </div>
            {loadError ? (
              <RetryPanel
                title="Dashboard sync needs a retry"
                description="The latest dashboard refresh failed, so you are seeing the newest cached view."
                onRetry={() => void retryDashboard()}
                icon={<BarChart3 className="h-4 w-4 text-primary" />}
              />
            ) : null}
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
              <div className="space-y-6">
                <WelcomePanel fullname={user?.fullname ?? "Staff"} />
                <NewsFeed announcements={announcements} />
              </div>
              <OperationsPanel
                overview={overview}
                canAccessITArea={canAccessITArea}
              />
            </section>

            <section className="metric-strip">
              <StatTile
                label="Active Staff"
                value={overview.totalStaff}
                detail="Current active staff footprint across the bank."
                icon={<Users className="h-5 w-5" />}
              />
              <StatTile
                label="Branch Coverage"
                value={overview.activeBranches}
                detail="Branches with active staff representation right now."
                icon={<Building2 className="h-5 w-5" />}
              />
              <StatTile
                label="Open Operations"
                value={overview.openOperations}
                detail="Pending IT incidents and profile amendment requests."
                icon={<BriefcaseBusiness className="h-5 w-5" />}
              />
              <StatTile
                label="Resolution Rate"
                value={`${overview.resolutionRate}%`}
                detail="Resolved support actions out of current workflow load."
                icon={<BarChart3 className="h-5 w-5" />}
              />
            </section>

            <ExecutiveSummary overview={overview} />
            <StaffDistribution overview={overview} />
          </>
        )}
      </div>
    </AppShell>
  );
}

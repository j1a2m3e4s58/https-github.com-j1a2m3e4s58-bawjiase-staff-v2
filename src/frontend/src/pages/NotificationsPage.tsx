import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonRow } from "@/components/SkeletonCard";
import { Button } from "@/components/ui/button";
import {
  apiGetCachedNotifications,
  apiDeleteNotification,
  apiGetNotifications,
  apiMarkAllNotificationsRead,
  apiMarkNotificationRead,
} from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import type { Notification, NotificationKind } from "@/types";
import { useNavigate } from "@tanstack/react-router";
import {
  BellOff,
  BookOpen,
  CheckCheck,
  CheckSquare,
  Megaphone,
  Settings,
  ShieldAlert,
  Square,
  Trash2,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const NOTIFICATIONS_PAGE_SIZE = 50;

function kindIcon(kind: NotificationKind) {
  if (kind === "announcement") return <Megaphone className="h-4 w-4" />;
  if (kind === "training") return <BookOpen className="h-4 w-4" />;
  if (kind === "support") return <Wrench className="h-4 w-4" />;
  if (kind === "poll") return <ShieldAlert className="h-4 w-4" />;
  return <Settings className="h-4 w-4" />;
}

function kindColor(kind: NotificationKind): string {
  if (kind === "announcement") return "bg-primary/15 text-primary";
  if (kind === "training") return "bg-secondary/15 text-secondary";
  if (kind === "support") return "bg-chart-4/15 text-chart-4";
  if (kind === "poll") return "bg-accent/15 text-accent";
  return "bg-muted text-muted-foreground";
}

function timeAgo(ts: bigint): string {
  const diff = Date.now() - Number(ts);
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "Just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(Number(ts)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function groupLabel(ts: bigint): string {
  const d = new Date(Number(ts));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (itemDay.getTime() === today.getTime()) return "Today";
  if (itemDay.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

interface NotifItemProps {
  notif: Notification;
  index: number;
  onRead: (id: number) => void;
  selectionMode: boolean;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

function NotifItem({
  notif,
  index,
  onRead,
  selectionMode,
  isSelected,
  onSelect,
}: NotifItemProps) {
  const navigate = useNavigate();

  const handleClick = async () => {
    if (selectionMode) {
      onSelect(notif.id);
      return;
    }
    if (!notif.isRead) {
      onRead(notif.id);
      await apiMarkNotificationRead(notif.id);
    }
    if (notif.linkTo) {
      navigate({ to: notif.linkTo as "/" });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-smooth ${
        notif.isRead
          ? "hover:bg-muted/50"
          : "bg-primary/5 hover:bg-primary/10 border-l-2 border-primary"
      }`}
      data-ocid={`notifications.item.${index}`}
    >
      {selectionMode ? (
        <div className="flex-shrink-0 pt-2 text-muted-foreground">
          {isSelected ? (
            <CheckSquare className="h-4 w-4 text-primary" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </div>
      ) : null}

      <div
        className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center border border-border/20 ${kindColor(notif.kind)}`}
      >
        {kindIcon(notif.kind)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span
            className={`text-sm leading-snug ${
              notif.isRead ? "text-foreground/80" : "font-semibold text-foreground"
            }`}
          >
            {notif.title}
          </span>
          <span className="text-[11px] text-muted-foreground flex-shrink-0 mt-0.5">
            {timeAgo(notif.createdAt)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notif.message}
        </p>
      </div>

      {!notif.isRead && !selectionMode ? (
        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
      ) : null}
    </button>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    apiGetCachedNotifications(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNotificationId, setSelectedNotificationId] = useState<
    number | null
  >(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(NOTIFICATIONS_PAGE_SIZE);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadNotifications() {
      try {
        const data = await apiGetNotifications();
        if (cancelled) return;
        setNotifications(data);
      } catch {
        if (cancelled) return;
        setNotifications([]);
        toast.error("Notifications could not be loaded. Please try again.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadNotifications();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    setVisibleCount(NOTIFICATIONS_PAGE_SIZE);
  }, [notifications.length]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const grouped = useMemo(() => {
    const map: Record<string, Notification[]> = {};
    for (const n of notifications.slice(0, visibleCount)) {
      const label = groupLabel(n.createdAt);
      if (!map[label]) map[label] = [];
      map[label].push(n);
    }
    return map;
  }, [notifications]);

  const handleMarkRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  };

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    await apiMarkAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    toast.success("All notifications marked as read");
    setIsMarkingAll(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedNotificationId === null) return;
    const ok = await apiDeleteNotification(selectedNotificationId);
    if (!ok) {
      toast.error("Notification could not be deleted");
      return;
    }
    setNotifications((prev) =>
      prev.filter((item) => item.id !== selectedNotificationId),
    );
    setDeleteDialogOpen(false);
    setSelectedNotificationId(null);
    setSelectionMode(false);
    toast.success("Notification deleted");
  };

  return (
    <AppShell>
      <div className="page-shell-compact" data-ocid="notifications.page">
        <section className="page-header">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
            <div className="page-kicker">Inbox and alerts</div>
            <h1 className="page-title">
              Notifications
            </h1>
            {unreadCount > 0 ? (
              <p className="page-subtitle">
                <span className="font-semibold text-primary">
                  {unreadCount}
                </span>{" "}
                unread
              </p>
            ) : (
              <p className="page-subtitle">
                All caught up
              </p>
            )}
          </div>

          <div className="page-actions">
            {notifications.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setSelectionMode((prev) => !prev);
                  setSelectedNotificationId(null);
                }}
                data-ocid="notifications.select_button"
              >
                {selectionMode ? (
                  <>
                    <Square className="h-4 w-4" />
                    Cancel
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4" />
                    Select
                  </>
                )}
              </Button>
            ) : null}

            {selectionMode && selectedNotificationId !== null ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => setDeleteDialogOpen(true)}
                data-ocid="notifications.delete_selected_button"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}

            {unreadCount > 0 && !selectionMode ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleMarkAllRead}
                disabled={isMarkingAll}
                data-ocid="notifications.mark_all_button"
              >
                <CheckCheck className="h-4 w-4" />
                {isMarkingAll ? "Marking..." : "Mark all read"}
              </Button>
            ) : null}
          </div>
        </div>
        </section>

        {isLoading ? (
          <div className="data-panel divide-y divide-border/30" data-ocid="notifications.loading_state">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonRow key={`sk-notif-${i}`} className="py-4" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<BellOff className="h-7 w-7" />}
            title="You're all caught up!"
            description="No notifications yet. We'll let you know when something needs your attention."
            data-ocid="notifications.empty_state"
          />
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([label, items]) => (
              <section key={label}>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  {label}
                </h2>
                <div className="data-panel divide-y divide-border/20">
                  {items.map((notif, i) => (
                    <NotifItem
                      key={notif.id}
                      notif={notif}
                      index={i + 1}
                      onRead={handleMarkRead}
                      selectionMode={selectionMode}
                      isSelected={selectedNotificationId === notif.id}
                      onSelect={(id) =>
                        setSelectedNotificationId((current) =>
                          current === id ? null : id,
                        )
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
            {notifications.length > visibleCount ? (
              <div className="flex justify-center pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setVisibleCount((current) => current + NOTIFICATIONS_PAGE_SIZE)
                  }
                  data-ocid="notifications.load_more_button"
                >
                  Load more notifications
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete notification?"
        description="This will remove only the selected notification from your own list."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteSelected}
      />
    </AppShell>
  );
}

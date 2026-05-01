import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LiveSyncBadge } from "@/components/LiveSyncBadge";
import { RetryPanel } from "@/components/RetryPanel";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  type UpdateStaffRequest,
  apiArchiveStaff,
  apiGetCachedActiveStaff,
  apiGetActiveStaff,
  resolveStoredAssetUrl,
  apiUpdateStaff,
} from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import { BRANCHES, DEPARTMENTS, type User } from "@/types";
import { useNavigate } from "@tanstack/react-router";
import {
  Archive,
  Building2,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  UserX,
  Users,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const DIRECTORY_REFRESH_MS = 5000;
const DIRECTORY_PAGE_SIZE = 24;
const USERS_UPDATED_EVENT = "bcb:users-updated";

const ROLE_LABELS: Record<User["role"], string> = {
  SuperAdmin: "Super Admin",
  HRAdmin: "HR Admin",
  Supervisor: "Supervisor",
  GeneralStaff: "Staff",
};

const ROLE_VARIANT: Record<User["role"], "default" | "secondary" | "outline"> =
  {
    SuperAdmin: "default",
    HRAdmin: "secondary",
    Supervisor: "secondary",
    GeneralStaff: "outline",
  };

function isOnline(staff: User): boolean {
  return !!staff.isOnlineNow;
}

function getInitials(fullname: string): string {
  return fullname
    .split(" ")
    .map((name) => name[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function normalizeBranch(branch: string) {
  const upper = branch.trim().toUpperCase();
  return upper.includes("OFFAKOR") ? "OFAAKOR" : upper;
}

function formatLastSeen(ts: bigint): string {
  return new Date(Number(ts)).toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mergeCurrentUserView(member: User, currentUser: User | null, pageVisible: boolean): User {
  if (!currentUser || member.id !== currentUser.id) return member;
  const now = BigInt(Date.now());
  return {
    ...member,
    ...currentUser,
    isOnlineNow: pageVisible ? true : (currentUser.isOnlineNow ?? member.isOnlineNow),
    lastSeen:
      currentUser.lastSeen > member.lastSeen
        ? currentUser.lastSeen
        : pageVisible && now > member.lastSeen
          ? now
          : member.lastSeen,
  };
}

function canManageDirectory(user: User | null) {
  return (
    user?.role === "SuperAdmin" ||
    user?.department === "IT" ||
    user?.department === "HR"
  );
}

function OnlineSummary({ staff }: { staff: User[] }) {
  const online = staff.filter((user) => isOnline(user));
  const byBranch = BRANCHES.reduce<Record<string, number>>((acc, branch) => {
    acc[branch] = online.filter(
      (user) => normalizeBranch(user.branch) === branch,
    ).length;
    return acc;
  }, {});

  return (
    <div
      className="flex flex-wrap items-center gap-2 glass-card rounded-xl px-4 py-3 text-sm"
      data-ocid="directory.online_summary"
    >
      <span className="flex items-center gap-1.5 font-semibold text-foreground">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        {online.length} staff online
      </span>
      {BRANCHES.map((branch) => (
        <span
          key={branch}
          className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-xs text-muted-foreground"
        >
          <span className="font-medium">{branch}</span>
          <Badge
            variant={byBranch[branch] > 0 ? "default" : "outline"}
            className="h-5 min-w-5 justify-center rounded-full px-1 text-[10px]"
          >
            {byBranch[branch]}
          </Badge>
        </span>
      ))}
    </div>
  );
}

interface StaffCardProps {
  staff: User;
  canEdit: boolean;
  canSeeLastSeen: boolean;
  isSelf: boolean;
  onEdit: (staff: User) => void;
  onArchive: (staff: User) => void;
  index: number;
}

function StaffCard({
  staff,
  canEdit,
  canSeeLastSeen,
  isSelf,
  onEdit,
  onArchive,
  index,
}: StaffCardProps) {
  const online = isOnline(staff);
  const initials = getInitials(staff.fullname);
  const canArchive = canEdit && !isSelf && staff.role !== "SuperAdmin";
  const profileImage = resolveStoredAssetUrl(staff.imageFile);

  return (
    <div
      className="glass-card rounded-xl p-4 flex flex-col gap-3 hover:glass-card-elevated transition-smooth cursor-default group"
      data-ocid={`directory.staff_card.item.${index}`}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <Avatar className="h-11 w-11 ring-2 ring-border/40">
            {profileImage && (
              <AvatarImage src={profileImage} alt={staff.fullname} />
            )}
            <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span
            className={`absolute bottom-0 right-0 block w-3 h-3 rounded-full ring-2 ring-card ${
              online ? "bg-green-500" : "bg-destructive"
            }`}
            title={online ? "Online" : "Offline"}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="font-semibold text-foreground text-sm truncate leading-tight">
              {staff.fullname}
            </div>
            {staff.isVerified && (
              <ShieldCheck
                className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0"
                aria-label="Verified staff"
              />
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {staff.position || ROLE_LABELS[staff.role]}
          </div>
          <div
            className={`text-[11px] font-medium mt-1 ${
              online ? "text-emerald-500" : "text-destructive"
            }`}
          >
            {online ? "Online Now" : "Offline"}
            {!online && canSeeLastSeen && Number(staff.lastSeen) > 0
              ? ` . Left ${formatLastSeen(staff.lastSeen)}`
              : ""}
          </div>
        </div>

        <Badge
          variant={ROLE_VARIANT[staff.role]}
          className="text-[10px] flex-shrink-0 mt-0.5"
        >
          {ROLE_LABELS[staff.role]}
        </Badge>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1 truncate">
          <Building2 className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{staff.department || "Other"}</span>
        </span>
        <span className="flex items-center gap-1 truncate">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{staff.branch}</span>
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-muted-foreground border-t border-border/30 pt-3">
        <a
          href={`mailto:${staff.email}`}
          className="flex items-center gap-2 hover:text-primary transition-colors"
        >
          <Mail className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <span className="truncate">{staff.email}</span>
        </a>
        <a
          href={`tel:${staff.phone}`}
          className="flex items-center gap-2 hover:text-primary transition-colors"
        >
          <Phone className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          <span className="truncate">{staff.phone}</span>
        </a>
      </div>

      {canEdit && (
        <div className="flex gap-2 pt-1 border-t border-border/30">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => onEdit(staff)}
            data-ocid={`directory.edit_button.${index}`}
          >
            Edit
          </Button>
          {canArchive && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onArchive(staff)}
              data-ocid={`directory.archive_button.${index}`}
            >
              <Archive className="h-3.5 w-3.5 mr-1" />
              Archive
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface EditStaffModalProps {
  staff: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: User) => void;
}

function EditStaffModal({
  staff,
  open,
  onOpenChange,
  onSaved,
}: EditStaffModalProps) {
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");
  const [position, setPosition] = useState("");
  const [itCode, setItCode] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (staff) {
      setDepartment(staff.department || "ADMIN");
      setBranch(staff.branch || "HEAD OFFICE");
      setPosition(staff.position || "");
      setItCode("");
    }
  }, [staff]);

  const needsItCode = department === "IT" && staff?.department !== "IT";

  async function handleSave() {
    if (!staff) return;
    if (needsItCode && !itCode.trim()) {
      toast.error("IT access code is required");
      return;
    }

    setSaving(true);
    const req: UpdateStaffRequest = {
      department,
      branch,
      position,
      accessCode: needsItCode ? itCode : undefined,
    };
    const result = await apiUpdateStaff(staff.id, req);
    setSaving(false);

    if ("ok" in result) {
      toast.success("Staff member updated successfully");
      onSaved(result.ok);
      onOpenChange(false);
    } else {
      toast.error(result.err ?? "Failed to update staff member");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="glass-card-elevated sm:max-w-md"
        data-ocid="directory.edit_staff.dialog"
      >
        <DialogHeader>
          <DialogTitle>Update Staff Details</DialogTitle>
          <DialogDescription>
            Update position, branch, or department for {staff?.fullname}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-position">Position / Job Title</Label>
            <Input
              id="edit-position"
              placeholder="e.g. Teller, Loan Officer"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              data-ocid="directory.edit_staff.position.input"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-branch">Branch</Label>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger
                id="edit-branch"
                data-ocid="directory.edit_staff.branch.select"
              >
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {BRANCHES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-dept">Department</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger
                id="edit-dept"
                data-ocid="directory.edit_staff.department.select"
              >
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item === "IT" ? "IT (Restricted)" : item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsItCode && (
            <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-3">
              <Label htmlFor="edit-it-code">
                Department Access Code{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-it-code"
                type="password"
                placeholder="Enter access code"
                value={itCode}
                onChange={(e) => setItCode(e.target.value)}
                data-ocid="directory.edit_staff.it_code.input"
              />
              <p className="text-xs text-muted-foreground">
                Required when promoting a user to IT/Super Admin.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-ocid="directory.edit_staff.cancel_button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            data-ocid="directory.edit_staff.save_button"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DirectoryPage() {
  const { user: currentUser, updateUser } = useAuth();
  const navigate = useNavigate();
  const canEdit = canManageDirectory(currentUser);

  const [staff, setStaff] = useState<User[]>(() => apiGetCachedActiveStaff());
  const [loading, setLoading] = useState(() => apiGetCachedActiveStaff().length === 0);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<User | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [visibleCount, setVisibleCount] = useState(DIRECTORY_PAGE_SIZE);
  const [pageVisible, setPageVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );

  useEffect(() => {
    let mounted = true;

    const loadStaff = async () => {
      try {
        const data = await apiGetActiveStaff();
        if (!mounted) return;
        setStaff(data);
        setLoadError(false);
      } catch {
        if (!mounted) return;
        setLoadError(true);
        toast.error("Staff directory could not refresh. Please try again.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadStaff();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadStaff();
      }
    }, DIRECTORY_REFRESH_MS);

    const handleFocus = () => {
      void loadStaff();
    };

    const handleVisibility = () => {
      setPageVisible(document.visibilityState === "visible");
      if (document.visibilityState === "visible") {
        void loadStaff();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "bcb_mock_users") {
        void loadStaff();
      }
    };

      const handleUsersUpdated = () => {
        setStaff(apiGetCachedActiveStaff());
      };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(USERS_UPDATED_EVENT, handleUsersUpdated);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(USERS_UPDATED_EVENT, handleUsersUpdated);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    setVisibleCount(DIRECTORY_PAGE_SIZE);
  }, [deferredSearch]);

  const presenceAdjustedStaff = useMemo(() => {
    return staff.map((member) => mergeCurrentUserView(member, currentUser, pageVisible));
  }, [staff, currentUser, pageVisible]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return presenceAdjustedStaff;
    return presenceAdjustedStaff.filter(
      (user) =>
        user.fullname.toLowerCase().includes(q) ||
        user.department.toLowerCase().includes(q) ||
        user.branch.toLowerCase().includes(q) ||
        user.position.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.phone.toLowerCase().includes(q),
    );
  }, [presenceAdjustedStaff, deferredSearch]);

  const grouped = useMemo(() => {
    const map = new Map<string, User[]>();
    for (const user of filtered.slice(0, visibleCount)) {
      const department = user.department || "Other";
      if (!map.has(department)) map.set(department, []);
      map.get(department)!.push(user);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, visibleCount]);

  function handleSaved(updated: User) {
    setStaff((prev) =>
      prev.map((member) => (member.id === updated.id ? updated : member)),
    );
    if (currentUser?.id === updated.id) {
      updateUser(updated);
    }
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    if (archiveTarget.id === currentUser?.id) {
      toast.error("You cannot archive yourself.");
      setArchiveTarget(null);
      return;
    }

    setArchiving(true);
    const result = await apiArchiveStaff(archiveTarget.id);
    setArchiving(false);

    if ("ok" in result) {
      toast.success(`${archiveTarget.fullname} moved to Past Staff records.`);
      setStaff((prev) => prev.filter((user) => user.id !== archiveTarget.id));
    } else {
      toast.error(result.err ?? "Failed to archive staff member");
    }
    setArchiveTarget(null);
  }

  let cardIndex = 0;

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto" data-ocid="directory.page">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Staff Directory
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {staff.length} active staff member{staff.length !== 1 ? "s" : ""}
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => navigate({ to: "/directory/supervisors" })}
                data-ocid="directory.supervisor_button"
              >
                <ShieldCheck className="h-4 w-4" />
                Supervisors
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => navigate({ to: "/directory/past-staff" })}
                data-ocid="directory.past_staff_button"
              >
                <UserX className="h-4 w-4" />
                Past Staff
              </Button>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <LiveSyncBadge />
        </div>
        {loadError ? (
          <RetryPanel
            title="Directory sync needs a retry"
            description="The latest staff refresh failed. Your newest cached directory is still showing."
            onRetry={() => void apiGetActiveStaff().then(setStaff).catch(() => {
              setLoadError(true);
              toast.error("Staff directory could not refresh. Please try again.");
            })}
            icon={<Users className="h-4 w-4 text-primary" />}
          />
        ) : null}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }, (_, index) => `sk-${index}`).map(
              (key) => (
                <SkeletonCard key={key} lines={2} hasAvatar />
              ),
            )}
          </div>
        ) : (
          <>
            {presenceAdjustedStaff.length > 0 && <OnlineSummary staff={presenceAdjustedStaff} />}

            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search staff directory..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-ocid="directory.search_input"
              />
            </div>

            {grouped.length === 0 ? (
              <div
                className="text-center py-16 glass-card rounded-xl"
                data-ocid="directory.empty_state"
              >
                <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-foreground font-medium">
                  No staff match your search
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try a different name, branch, department, email, or phone
                  number.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {grouped.map(([department, members]) => (
                  <section
                    key={department}
                    data-ocid={`directory.dept_section.${department.toLowerCase().replace(/\s+/g, "_")}`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold text-foreground text-sm uppercase tracking-wider">
                          {department}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-xs tabular-nums"
                        >
                          {members.length}
                        </Badge>
                      </div>
                      <div className="flex-1 h-px bg-border/50" />
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {members.map((member) => {
                        const index = ++cardIndex;
                        return (
                          <StaffCard
                            key={member.id}
                            staff={member}
                            canEdit={canEdit}
                            canSeeLastSeen={canEdit}
                            isSelf={currentUser?.id === member.id}
                            onEdit={setEditTarget}
                            onArchive={setArchiveTarget}
                            index={index}
                          />
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
            {filtered.length > visibleCount ? (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setVisibleCount((current) => current + DIRECTORY_PAGE_SIZE)
                  }
                  data-ocid="directory.load_more_button"
                >
                  Load more staff
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <EditStaffModal
        staff={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        title="Remove Staff Member"
        description={`You are about to remove ${archiveTarget?.fullname} from the active directory and move the record to Past Staff.`}
        confirmLabel={archiving ? "Removing..." : "Yes, Remove"}
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleArchiveConfirm}
      />
    </AppShell>
  );
}

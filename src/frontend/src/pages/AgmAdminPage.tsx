import { UserRole } from "@/types";
import { AgmYearSwitcher } from "@/components/AgmYearSwitcher";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/context/ToastContext";
import { useAgmYear } from "@/context/AgmYearContext";
import { useAuth } from "@/hooks/use-auth";
import {
  useAuditLog,
  useCloneYearSettings,
  useCreateUser,
  useCreatePasswordResetCode,
  useDeleteAuditEntries,
  useDeactivateUser,
  useDeleteAllShareholders,
  useForceLogout,
  useGetActiveSessions,
  useGetUsers,
  useRecordAuditEvent,
  useSettings,
  useUpdateYearRecord,
  useUpdateSettings,
  useUpdateUserRole,
  useYearRegistry,
} from "@/hooks/use-backend";
import type { AGMSettings, AppUser } from "@/types";
import {
  AlertTriangle,
  CheckSquare,
  Copy,
  Clock,
  Download,
  RefreshCw,
  Settings,
  Shield,
  ShieldAlert,
  Square,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { validateGhanaPhone } from "./registration/registration-form-utils";

// ─── Role badge ──────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  if (role === "SuperAdmin")
    return (
      <Badge className="bg-destructive/20 text-destructive border border-destructive/30 text-xs">
        Super Admin
      </Badge>
    );
  if (role === "RegistrationOfficer")
    return (
      <Badge className="bg-primary/20 text-primary border border-primary/30 text-xs">
        Officer
      </Badge>
    );
  if (role === "Admin")
    return (
      <Badge className="bg-accent/20 text-accent-foreground border border-accent/30 text-xs">
        Admin
      </Badge>
    );
  if (role === "ReportsViewer")
    return (
      <Badge className="bg-blue-500/15 text-blue-300 border border-blue-400/30 text-xs">
        Reports Viewer
      </Badge>
    );
  if (role === "BoardViewer")
    return (
      <Badge className="bg-violet-500/15 text-violet-300 border border-violet-400/30 text-xs">
        Board Viewer
      </Badge>
    );
  return (
    <Badge variant="secondary" className="text-xs">
      Viewer
    </Badge>
  );
}

// ─── Users Tab ───────────────────────────────────────────────────────────────
function UsersTab() {
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role === UserRole.SuperAdmin;
  const { data: users, isLoading } = useGetUsers();
  const createUser = useCreateUser();
  const createResetCode = useCreatePasswordResetCode();
  const updateRole = useUpdateUserRole();
  const deactivateUser = useDeactivateUser();
  const { showToast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newRole, setNewRole] = useState<UserRole>(UserRole.Viewer);
  const [roleChangeTarget, setRoleChangeTarget] = useState<AppUser | null>(
    null,
  );
  const [roleChangeValue, setRoleChangeValue] = useState<UserRole>(
    UserRole.Viewer,
  );
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [issuedResetCode, setIssuedResetCode] = useState<{
    code: string;
    expiresAt: bigint;
  } | null>(null);

  const handleAddUser = async () => {
    if (!newUsername.trim() || !newPassword.trim() || !newPhoneNumber.trim()) return;
    const normalizedPhone = newPhoneNumber.trim().replace(/\s+/g, "");
    if (!validateGhanaPhone(normalizedPhone)) {
      showToast("Enter a valid Ghana phone number for the user", "error");
      return;
    }
    try {
      await createUser.mutateAsync({
        username: newUsername.trim(),
        password: newPassword.trim(),
        role: newRole,
        phoneNumber: normalizedPhone,
      });
      showToast(`User "${newUsername}" created`, "success");
      setAddOpen(false);
      setNewUsername("");
      setNewPassword("");
      setNewPhoneNumber("");
      setNewRole(UserRole.Viewer);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create user";
      showToast(message, "error");
    }
  };

  const handleDeactivate = async (u: AppUser) => {
    try {
      await deactivateUser.mutateAsync(u.username);
      showToast(`User "${u.username}" deactivated`, "success");
    } catch {
      showToast("Failed to deactivate user", "error");
    }
  };

  const handleRoleChange = async () => {
    if (!roleChangeTarget) return;
    try {
      await updateRole.mutateAsync({
        username: roleChangeTarget.username,
        role: roleChangeValue,
      });
      showToast(`Role updated for "${roleChangeTarget.username}"`, "success");
      setRoleChangeTarget(null);
    } catch {
      showToast("Failed to update role", "error");
    }
  };

  const handleCreateResetCode = async (u: AppUser) => {
    try {
      const issued = await createResetCode.mutateAsync(u.username);
      setResetTarget(u);
      setIssuedResetCode({
        code: issued.code,
        expiresAt: issued.expiresAt,
      });
      showToast(`Reset code created for "${u.username}"`, "success");
    } catch {
      showToast("Failed to create reset code", "error");
    }
  };

  return (
    <div data-ocid="admin.users.panel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-lg text-foreground">
          System Users
        </h2>
        {isSuperAdmin && (
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="gap-2 min-h-[44px]"
            data-ocid="admin.users.add_button"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2" data-ocid="admin.users.loading_state">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                  Username
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                  Role
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                  Phone Number
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                  Last Login
                </th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u, i) => (
                <tr
                  key={u.username}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  data-ocid={`admin.users.item.${i + 1}`}
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {u.username}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3">
                    {(
                      u as AppUser & {
                        phoneNumber?: string;
                      }
                    ).phoneNumber || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-primary text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.lastLogin
                      ? new Date(
                          Number(u.lastLogin) / 1_000_000,
                        ).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {isSuperAdmin ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5"
                            onClick={() => handleCreateResetCode(u)}
                            data-ocid={`admin.users.reset_code_button.${i + 1}`}
                          >
                            Reset Code
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5"
                            disabled={u.username === me?.username}
                            onClick={() => {
                              setRoleChangeTarget(u);
                              setRoleChangeValue(u.role as UserRole);
                            }}
                            data-ocid={`admin.users.change_role_button.${i + 1}`}
                          >
                            <UserCog className="w-3.5 h-3.5" />
                            Role
                          </Button>
                          {u.isActive ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                              disabled={u.username === me?.username}
                              onClick={() => handleDeactivate(u)}
                              data-ocid={`admin.users.deactivate_button.${i + 1}`}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="text-xs h-8 px-3 rounded-md"
                            >
                              Deactivated
                            </Badge>
                          )}
                        </>
                      ) : (
                        <Badge variant="secondary" className="text-xs h-8 px-3 rounded-md">
                          Read Only
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(users ?? []).length === 0 && (
            <div
              className="text-center py-8 text-muted-foreground text-sm"
              data-ocid="admin.users.empty_state"
            >
              No users found
            </div>
          )}
        </div>
      )}

      {/* Add User Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent data-ocid="admin.users.add_modal">
          <DialogHeader>
            <DialogTitle className="font-display">Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-username">Username</Label>
              <Input
                id="new-username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter username"
                data-ocid="admin.users.username_input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter password"
                data-ocid="admin.users.password_input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-phone-number">Phone Number</Label>
              <Input
                id="new-phone-number"
                value={newPhoneNumber}
                onChange={(e) => setNewPhoneNumber(e.target.value)}
                placeholder="0241234567"
                data-ocid="admin.users.phone_input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={newRole}
                onValueChange={(v) => setNewRole(v as UserRole)}
              >
                <SelectTrigger data-ocid="admin.users.role_select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.SuperAdmin}>
                    Super Admin
                  </SelectItem>
                  <SelectItem value={UserRole.Admin}>Admin</SelectItem>
                  <SelectItem value={UserRole.RegistrationOfficer}>
                    Registration Officer
                  </SelectItem>
                  <SelectItem value={UserRole.ReportsViewer}>
                    Reports Viewer
                  </SelectItem>
                  <SelectItem value={UserRole.BoardViewer}>
                    Board Viewer
                  </SelectItem>
                  <SelectItem value={UserRole.Viewer}>Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              data-ocid="admin.users.add_cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={
                createUser.isPending ||
                !newUsername.trim() ||
                !newPassword.trim() ||
                !newPhoneNumber.trim()
              }
              data-ocid="admin.users.add_confirm_button"
            >
              {createUser.isPending ? "Creating…" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resetTarget && !!issuedResetCode}
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null);
            setIssuedResetCode(null);
          }
        }}
      >
        <DialogContent data-ocid="admin.users.reset_code_modal">
          <DialogHeader>
            <DialogTitle className="font-display">
              Password Reset Code
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Share this one-time code with{" "}
              <span className="font-semibold text-foreground">
                {resetTarget?.username}
              </span>
              . It expires at{" "}
              {issuedResetCode
                ? new Date(
                    Number(issuedResetCode.expiresAt) / 1_000_000,
                  ).toLocaleString()
                : "—"}
              .
            </p>
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 flex items-center justify-between gap-3">
              <code className="font-mono text-lg font-bold text-primary break-all">
                {issuedResetCode?.code}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  if (!issuedResetCode) return;
                  await navigator.clipboard.writeText(issuedResetCode.code);
                  showToast("Reset code copied", "success");
                }}
                data-ocid="admin.users.reset_code_copy_button"
              >
                <Copy className="w-4 h-4" />
                Copy
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setResetTarget(null);
                setIssuedResetCode(null);
              }}
              data-ocid="admin.users.reset_code_done_button"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Modal */}
      <Dialog
        open={!!roleChangeTarget}
        onOpenChange={(o) => !o && setRoleChangeTarget(null)}
      >
        <DialogContent data-ocid="admin.users.role_modal">
          <DialogHeader>
            <DialogTitle className="font-display">
              Change Role — {roleChangeTarget?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>New Role</Label>
            <Select
              value={roleChangeValue}
              onValueChange={(v) => setRoleChangeValue(v as UserRole)}
            >
              <SelectTrigger
                className="mt-2"
                data-ocid="admin.users.new_role_select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UserRole.SuperAdmin}>Super Admin</SelectItem>
                <SelectItem value={UserRole.Admin}>Admin</SelectItem>
                <SelectItem value={UserRole.RegistrationOfficer}>
                  Registration Officer
                </SelectItem>
                <SelectItem value={UserRole.ReportsViewer}>
                  Reports Viewer
                </SelectItem>
                <SelectItem value={UserRole.BoardViewer}>Board Viewer</SelectItem>
                <SelectItem value={UserRole.Viewer}>Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleChangeTarget(null)}
              data-ocid="admin.users.role_cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRoleChange}
              disabled={updateRole.isPending}
              data-ocid="admin.users.role_confirm_button"
            >
              {updateRole.isPending ? "Saving…" : "Save Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Audit Trail Tab ─────────────────────────────────────────────────────────
const ENTITY_TYPES = [
  "All",
  "Shareholder",
  "Registration",
  "CheckIn",
  "User",
] as const;
const PAGE_SIZE = 50;

function matchesAuditYear(
  details: string | undefined,
  performedAt: bigint,
  activeYear: string,
) {
  const normalizedDetails = String(details ?? "").toLowerCase();
  if (
    normalizedDetails.includes(`agm year: ${activeYear.toLowerCase()}`) ||
    normalizedDetails.includes(`agm ${activeYear.toLowerCase()}`)
  ) {
    return true;
  }

  return (
    new Date(Number(performedAt) / 1_000_000).getFullYear().toString() ===
    activeYear
  );
}

function safeAuditText(value: unknown, fallback = "—") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value || fallback;
  if (
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function AuditTab() {
  const { activeYear } = useAgmYear();
  const [entityFilter, setEntityFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const {
    data: entries,
    isLoading,
    refetch,
  } = useAuditLog(entityFilter, null, BigInt(1000));
  const deleteAuditEntries = useDeleteAuditEntries();
  const { showToast } = useToast();

  const filtered = useMemo(
    () =>
      (entries ?? []).filter((e) => {
        if (entityFilter && e.entityType !== entityFilter) return false;
        if (!matchesAuditYear(e.details, e.performedAt, activeYear)) return false;
        if (dateFilter) {
          const d = new Date(
            Number(e.performedAt) / 1_000_000,
          ).toLocaleDateString();
          if (!d.includes(dateFilter)) return false;
        }
        return true;
      }),
    [activeYear, dateFilter, entityFilter, entries],
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );
  const allVisibleSelected =
    paginated.length > 0 &&
    paginated.every((entry) => selectedIds.includes(entry.id));

  const handleExport = useCallback(() => {
    if (!filtered.length) return;
    const rows = [
      [
        "AGM Year",
        "Timestamp",
        "Action",
        "Entity Type",
        "Entity ID",
        "Performed By",
        "Details",
      ],
      ...filtered.map((e) => [
        activeYear,
        new Date(Number(e.performedAt) / 1_000_000).toISOString(),
        safeAuditText(e.action, ""),
        safeAuditText(e.entityType, ""),
        safeAuditText(e.entityId, ""),
        safeAuditText(e.performedBy, ""),
        safeAuditText(e.details, ""),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agm-${activeYear}-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeYear, filtered]);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !paginated.some((entry) => entry.id === id))
        : Array.from(new Set([...current, ...paginated.map((entry) => entry.id)])),
    );
  };

  const handleDeleteSelected = async () => {
    try {
      const deleted = await deleteAuditEntries.mutateAsync(selectedIds);
      setSelectedIds([]);
      showToast(
        `Deleted ${Number(deleted)} audit entr${Number(deleted) === 1 ? "y" : "ies"}`,
        "success",
      );
    } catch {
      showToast("Failed to delete audit entries", "error");
    }
  };

  // Auto-refetch every 10s
  useEffect(() => {
    const id = setInterval(() => refetch(), 10_000);
    return () => clearInterval(id);
  }, [refetch]);

  useEffect(() => {
    setSelectedIds((current) => {
      const next = current.filter((id) =>
        filtered.some((entry) => entry.id === id),
      );
      if (
        next.length === current.length &&
        next.every((value, index) => value === current[index])
      ) {
        return current;
      }
      return next;
    });
  }, [filtered]);

  return (
    <div data-ocid="admin.audit.panel">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-display font-semibold text-lg text-foreground">
          Audit Trail
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="min-w-[150px]">
            <AgmYearSwitcher compact />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
            {ENTITY_TYPES.map((et) => (
              <button
                key={et}
                type="button"
                onClick={() => {
                  setEntityFilter(et === "All" ? null : et);
                  setPage(0);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-smooth min-h-[36px] ${
                  (et === "All" && !entityFilter) || et === entityFilter
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                data-ocid={`admin.audit.filter.${et.toLowerCase()}`}
              >
                {et}
              </button>
            ))}
          </div>
          <Input
            placeholder="Filter by date (e.g. 5/4)"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(0);
            }}
            className="h-9 w-44 text-xs"
            data-ocid="admin.audit.date_input"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            className="gap-2 min-h-[44px]"
            data-ocid="admin.audit.export_button"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          {selectedIds.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleDeleteSelected()}
              disabled={deleteAuditEntries.isPending}
              className="gap-2 min-h-[44px] border-destructive/30 text-destructive hover:bg-destructive/10"
              data-ocid="admin.audit.delete_button"
            >
              <Trash2 className="w-4 h-4" />
              {deleteAuditEntries.isPending
                ? "Deleting..."
                : `Delete Selected (${selectedIds.length})`}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2" data-ocid="admin.audit.loading_state">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[800px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 text-xs"
                        aria-label={
                          allVisibleSelected
                            ? "Clear selected audit rows"
                            : "Select all visible audit rows"
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
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                      AGM Year
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                      Timestamp
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                      Action
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                      Entity Type
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                      Entity ID
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                      Performed By
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((e, i) => (
                    <tr
                      key={`${e.performedAt}-${i}`}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      data-ocid={`admin.audit.item.${i + 1}`}
                    >
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          className="flex items-center justify-center"
                          onClick={() => toggleSelected(e.id)}
                          aria-label={
                            selectedIds.includes(e.id)
                              ? `Deselect audit entry ${i + 1}`
                              : `Select audit entry ${i + 1}`
                          }
                        >
                          {selectedIds.includes(e.id) ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        {activeYear}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        {new Date(
                          Number(e.performedAt) / 1_000_000,
                        ).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {safeAuditText(e.action)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-xs">
                          {safeAuditText(e.entityType)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground max-w-[120px] truncate">
                        {safeAuditText(e.entityId)}
                      </td>
                      <td className="px-4 py-2.5 text-foreground">
                        {safeAuditText(e.performedBy)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">
                        {safeAuditText(e.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {paginated.length === 0 && (
              <div
                className="text-center py-8 text-muted-foreground text-sm"
                data-ocid="admin.audit.empty_state"
              >
                No audit entries match the current filters
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">
                {filtered.length} entries · page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  data-ocid="admin.audit.pagination_prev"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  data-ocid="admin.audit.pagination_next"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sessions Tab ─────────────────────────────────────────────────────────────
function SessionsTab() {
  const { data: sessions, isLoading } = useGetActiveSessions();
  const forceLogout = useForceLogout();
  const { showToast } = useToast();

  const handleForceLogout = async (username: string) => {
    try {
      await forceLogout.mutateAsync(username);
      showToast(`Forced logout for "${username}"`, "success");
    } catch {
      showToast("Failed to force logout", "error");
    }
  };

  const tooManySessions = (sessions?.length ?? 0) >= 5;

  return (
    <div data-ocid="admin.sessions.panel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-lg text-foreground">
          Active Sessions
        </h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5" />
          Auto-refreshes every 30s
        </div>
      </div>

      {tooManySessions && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 mb-4"
          data-ocid="admin.sessions.warning"
        >
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive font-medium">
            Warning: {sessions?.length} concurrent sessions detected. Consider
            forcing logout of inactive users.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2" data-ocid="admin.sessions.loading_state">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                  Username
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                  Role
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                  Login Time
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                  Expires
                </th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {(sessions ?? []).map((s, i) => (
                <tr
                  key={s.token}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  data-ocid={`admin.sessions.item.${i + 1}`}
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {s.username}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={s.role} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Active session
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(
                        Number(s.expiresAt) / 1_000_000,
                      ).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => handleForceLogout(s.username)}
                      disabled={forceLogout.isPending}
                      data-ocid={`admin.sessions.force_logout_button.${i + 1}`}
                    >
                      Force Logout
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(sessions ?? []).length === 0 && (
            <div
              className="text-center py-8 text-muted-foreground text-sm"
              data-ocid="admin.sessions.empty_state"
            >
              No active sessions
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────
function SettingsTab() {
  const { activeYear, yearOptions } = useAgmYear();
  const { data: settings, isLoading } = useSettings();
  const { data: yearRegistry = [] } = useYearRegistry();
  const updateSettings = useUpdateSettings();
  const updateYearRecord = useUpdateYearRecord();
  const cloneYearSettings = useCloneYearSettings();
  const recordAuditEvent = useRecordAuditEvent();
  const { showToast } = useToast();
  const [cloneTargetYear, setCloneTargetYear] = useState(
    String(Number(activeYear) + 1),
  );

  const [form, setForm] = useState<Partial<AGMSettings>>({
    agmName: "",
    agmDate: "",
    venue: "",
    quorumThreshold: BigInt(51),
    sessionTimeoutMinutes: BigInt(60),
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.agmName?.trim()) e.agmName = "AGM Name is required";
    if (!form.agmDate?.trim()) e.agmDate = "AGM Date is required";
    if (!form.venue?.trim()) e.venue = "Venue is required";
    const qt = Number(form.quorumThreshold);
    if (Number.isNaN(qt) || qt < 1 || qt > 100)
      e.quorumThreshold = "Must be between 1 and 100";
    const st = Number(form.sessionTimeoutMinutes);
    if (Number.isNaN(st) || st < 1)
      e.sessionTimeoutMinutes = "Must be at least 1 minute";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      await updateSettings.mutateAsync(form as AGMSettings);
      showToast("Settings saved successfully", "success");
      void recordAuditEvent.mutateAsync({
        action: "UPDATE_SETTINGS",
        entityType: "settings",
        entityId: "agm",
        details: `Updated AGM settings for AGM ${activeYear}`,
      });
    } catch {
      showToast("Failed to save settings", "error");
    }
  };

  const activeYearRecord =
    yearRegistry.find((record) => record.year === activeYear) ?? null;

  const handleYearStatusChange = async (updates: {
    isLocked?: boolean;
    isArchived?: boolean;
  }) => {
    try {
      await updateYearRecord.mutateAsync({ year: activeYear, updates });
      showToast(`AGM ${activeYear} controls updated`, "success");
    } catch {
      showToast("Failed to update AGM year controls", "error");
    }
  };

  const handleCloneYear = async () => {
    try {
      await cloneYearSettings.mutateAsync({
        fromYear: activeYear,
        toYear: cloneTargetYear,
      });
      showToast(
        `Cloned AGM ${activeYear} settings into AGM ${cloneTargetYear}`,
        "success",
      );
    } catch {
      showToast("Failed to clone AGM settings", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-ocid="admin.settings.loading_state">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div data-ocid="admin.settings.panel">
      <h2 className="font-display font-semibold text-lg text-foreground mb-4">
        AGM Settings
      </h2>
      <div className="max-w-3xl space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="agm-name">
            AGM Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="agm-name"
            value={form.agmName ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, agmName: e.target.value }))
            }
            placeholder="e.g. Annual General Meeting 2026"
            data-ocid="admin.settings.agm_name_input"
          />
          {errors.agmName && (
            <p
              className="text-xs text-destructive"
              data-ocid="admin.settings.agm_name_field_error"
            >
              {errors.agmName}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="agm-date">
            AGM Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="agm-date"
            value={form.agmDate ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, agmDate: e.target.value }))
            }
            placeholder="e.g. 2026-06-15"
            data-ocid="admin.settings.agm_date_input"
          />
          {errors.agmDate && (
            <p
              className="text-xs text-destructive"
              data-ocid="admin.settings.agm_date_field_error"
            >
              {errors.agmDate}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="venue">
            Venue <span className="text-destructive">*</span>
          </Label>
          <Input
            id="venue"
            value={form.venue ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
            placeholder="e.g. Grand Ballroom, Capital Hotel"
            data-ocid="admin.settings.venue_input"
          />
          {errors.venue && (
            <p
              className="text-xs text-destructive"
              data-ocid="admin.settings.venue_field_error"
            >
              {errors.venue}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quorum">
            Quorum Threshold (%) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="quorum"
            type="number"
            min={1}
            max={100}
            value={Number(form.quorumThreshold ?? 51)}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                quorumThreshold: BigInt(e.target.value || 0),
              }))
            }
            data-ocid="admin.settings.quorum_input"
          />
          {errors.quorumThreshold && (
            <p
              className="text-xs text-destructive"
              data-ocid="admin.settings.quorum_field_error"
            >
              {errors.quorumThreshold}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="session-timeout">
            Session Timeout (minutes){" "}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="session-timeout"
            type="number"
            min={1}
            value={Number(form.sessionTimeoutMinutes ?? 60)}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                sessionTimeoutMinutes: BigInt(e.target.value || 0),
              }))
            }
            data-ocid="admin.settings.session_timeout_input"
          />
          {errors.sessionTimeoutMinutes && (
            <p
              className="text-xs text-destructive"
              data-ocid="admin.settings.session_timeout_field_error"
            >
              {errors.sessionTimeoutMinutes}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Configure AGM parameters. Changes take effect immediately.
          </p>
          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="min-h-[44px] gap-2"
            data-ocid="admin.settings.save_button"
          >
            {updateSettings.isPending ? "Saving…" : "Save Settings"}
          </Button>
        </div>

        <div className="pt-6 border-t border-border space-y-4">
          <div>
            <h3 className="font-display font-semibold text-base text-foreground">
              AGM Year Controls
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Lock, archive, or clone the currently selected AGM year.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">AGM {activeYear}</Badge>
              <Badge
                className={
                  activeYearRecord?.isLocked
                    ? "bg-amber-500/15 text-amber-300 border border-amber-400/30"
                    : "bg-primary/15 text-primary border border-primary/30"
                }
              >
                {activeYearRecord?.isLocked ? "Locked" : "Open"}
              </Badge>
              {activeYearRecord?.isArchived && (
                <Badge className="bg-slate-500/15 text-slate-300 border border-slate-400/30">
                  Archived
                </Badge>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void handleYearStatusChange({
                    isLocked: !activeYearRecord?.isLocked,
                  })
                }
                disabled={updateYearRecord.isPending}
              >
                {activeYearRecord?.isLocked ? "Unlock Year" : "Lock Year"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void handleYearStatusChange({
                    isArchived: !activeYearRecord?.isArchived,
                  })
                }
                disabled={updateYearRecord.isPending}
              >
                {activeYearRecord?.isArchived ? "Unarchive Year" : "Archive Year"}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label>Clone Settings Into Year</Label>
                <Select value={cloneTargetYear} onValueChange={setCloneTargetYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {yearOptions
                      .filter((year) => Number(year) > Number(activeYear))
                      .map((year) => (
                        <SelectItem key={year} value={year}>
                          AGM {year}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                onClick={() => void handleCloneYear()}
                disabled={cloneYearSettings.isPending || cloneTargetYear === activeYear}
              >
                {cloneYearSettings.isPending ? "Cloning…" : "Clone Year Settings"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Danger Zone Tab ──────────────────────────────────────────────────────────
function DangerZoneTab() {
  const deleteAll = useDeleteAllShareholders();
  const { showToast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletedCount, setDeletedCount] = useState<number | null>(null);

  const CONFIRM_PHRASE = "DELETE ALL SHAREHOLDERS";

  const handleDelete = async () => {
    try {
      const result = await deleteAll.mutateAsync();
      const count =
        typeof result === "bigint" ? Number(result) : ((result as number) ?? 0);
      setDeletedCount(count);
      setDeleteOpen(false);
      setConfirmText("");
      showToast(`Deleted ${count} shareholders permanently`, "success");
    } catch {
      showToast("Failed to delete shareholders", "error");
    }
  };

  return (
    <div data-ocid="admin.danger.panel">
      <h2 className="font-display font-semibold text-lg text-foreground mb-4">
        Danger Zone
      </h2>
      <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-destructive/20 border border-destructive/40 flex items-center justify-center flex-shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-base text-destructive mb-1">
              Delete All Shareholders
            </h3>
            <p className="text-sm text-muted-foreground mb-1">
              This action will permanently and irreversibly delete{" "}
              <strong className="text-foreground">
                all shareholder records
              </strong>
              , including registrations and check-in data.
            </p>
            <p className="text-sm font-semibold text-destructive mb-4">
              ⚠ This cannot be undone. Use only during system reset or before a
              new AGM cycle.
            </p>
            {deletedCount !== null && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border mb-4 text-sm"
                data-ocid="admin.danger.delete_success_state"
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">
                  {deletedCount} shareholder records were permanently deleted.
                </span>
              </div>
            )}
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 min-h-[44px] gap-2"
              onClick={() => setDeleteOpen(true)}
              data-ocid="admin.danger.delete_shareholders_button"
            >
              <Trash2 className="w-4 h-4" />
              Delete All Shareholders
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setConfirmText("");
        }}
      >
        <DialogContent data-ocid="admin.danger.delete_dialog">
          <DialogHeader>
            <DialogTitle className="font-display text-destructive flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              Confirm Permanent Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
              <p className="text-sm text-destructive font-medium">
                You are about to delete ALL shareholder records. This action is
                permanent and cannot be reversed.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-delete">
                Type{" "}
                <span className="font-mono font-bold text-destructive">
                  {CONFIRM_PHRASE}
                </span>{" "}
                to confirm:
              </Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                className="font-mono border-destructive/40 focus-visible:ring-destructive"
                data-ocid="admin.danger.confirm_input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(false);
                setConfirmText("");
              }}
              data-ocid="admin.danger.delete_cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== CONFIRM_PHRASE || deleteAll.isPending}
              onClick={handleDelete}
              className="gap-2"
              data-ocid="admin.danger.delete_confirm_button"
            >
              <Trash2 className="w-4 h-4" />
              {deleteAll.isPending ? "Deleting…" : "Delete Everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main AdminPage ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === UserRole.SuperAdmin;

  if (
    user &&
    user.role !== UserRole.SuperAdmin &&
    user.role !== UserRole.Admin
  ) {
    return (
      <Layout>
        <div
          className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center"
          data-ocid="admin.access_denied"
        >
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Access Denied
          </h1>
          <p className="text-muted-foreground max-w-sm">
            This section is restricted to AGM administrators only. Contact
            your system administrator for elevated access.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div data-ocid="admin.page" className="space-y-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground leading-tight">
              Admin Control Panel
            </h1>
            <p className="text-xs text-muted-foreground">
              Super Administrator access — all system controls
            </p>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/40 p-1 rounded-xl border border-border sm:flex sm:flex-wrap">
            <TabsTrigger
              value="users"
              className="gap-2 min-h-[44px] flex-1 sm:flex-none"
              data-ocid="admin.users.tab"
            >
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger
              value="audit"
              className="gap-2 min-h-[44px] flex-1 sm:flex-none"
              data-ocid="admin.audit.tab"
            >
              <Clock className="w-4 h-4" />
              Audit Trail
            </TabsTrigger>
            <TabsTrigger
              value="sessions"
              className="gap-2 min-h-[44px] flex-1 sm:flex-none"
              data-ocid="admin.sessions.tab"
            >
              <Shield className="w-4 h-4" />
              Sessions
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="gap-2 min-h-[44px] flex-1 sm:flex-none"
              data-ocid="admin.settings.tab"
            >
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger
                value="danger"
                className="gap-2 min-h-[44px] flex-1 sm:flex-none text-destructive data-[state=active]:text-destructive"
                data-ocid="admin.danger.tab"
              >
                <ShieldAlert className="w-4 h-4" />
                Danger Zone
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent
            value="users"
            className="bg-card rounded-xl border border-border p-4 lg:p-6"
          >
            <UsersTab />
          </TabsContent>

          <TabsContent
            value="audit"
            className="bg-card rounded-xl border border-border p-4 lg:p-6"
          >
            <AuditTab />
          </TabsContent>

          <TabsContent
            value="sessions"
            className="bg-card rounded-xl border border-border p-4 lg:p-6"
          >
            <SessionsTab />
          </TabsContent>

          <TabsContent
            value="settings"
            className="bg-card rounded-xl border border-border p-4 lg:p-6"
          >
            <SettingsTab />
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent
              value="danger"
              className="bg-card rounded-xl border border-border p-4 lg:p-6"
            >
              <DangerZoneTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}

import { AppShell } from "@/components/AppShell";
import { RoleGuard } from "@/components/RoleGuard";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  apiGetCachedActiveStaff,
  apiGetActiveStaff,
  apiUpdateStaff,
  formatAudienceSummary,
} from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import { BRANCHES, DEPARTMENTS, type User, type UserPermissions } from "@/types";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRightLeft, KeyRound, Search, ShieldCheck, UserX, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const DEFAULT_PERMISSIONS: UserPermissions = {
  announcements: false,
  forms: false,
  trainingVideos: false,
  trainingDocuments: false,
  support: false,
  userManagement: false,
};

function normalizedUserPermissions(user: User | null): UserPermissions {
  return {
    ...DEFAULT_PERMISSIONS,
    ...(user?.permissions ?? {}),
  };
}

export default function SupervisorManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [staff, setStaff] = useState<User[]>(() => apiGetCachedActiveStaff());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [role, setRole] = useState<User["role"]>("GeneralStaff");
  const [managedBranches, setManagedBranches] = useState<string[]>([]);
  const [managedDepartmentsByBranch, setManagedDepartmentsByBranch] = useState<Record<string, string[]>>({});
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [transferToId, setTransferToId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const users = await apiGetActiveStaff();
        if (!mounted) return;
        setStaff(users);
        if (!selectedId && users.length > 0) {
          setSelectedId(users[0].id);
        }
      } catch {
        toast.error("Staff could not be loaded");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedId]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((member) =>
      [member.fullname, member.email, member.department, member.branch]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [search, staff]);

  const selectedUser = useMemo(
    () => staff.find((member) => member.id === selectedId) ?? null,
    [staff, selectedId],
  );

  useEffect(() => {
    if (!selectedUser) return;
    setRole(selectedUser.role);
    setManagedBranches(selectedUser.managedBranches ?? []);
    setManagedDepartmentsByBranch(selectedUser.managedDepartmentsByBranch ?? {});
    setPermissions(normalizedUserPermissions(selectedUser));
  }, [selectedUser]);

  useEffect(() => {
    if (!selectedUser || role !== "Supervisor") return;
    if (managedBranches.length > 0) return;
    const fallbackBranch = selectedUser.branch.trim().toUpperCase();
    const fallbackDepartment = selectedUser.department.trim().toUpperCase();
    setManagedBranches([fallbackBranch]);
    setManagedDepartmentsByBranch({
      [fallbackBranch]: [fallbackDepartment || "ALL"],
    });
  }, [managedBranches.length, role, selectedUser]);

  function toggleBranch(branch: string, checked: boolean) {
    const branchKey = branch.toUpperCase();
    setManagedBranches((current) =>
      checked
        ? Array.from(new Set([...current, branchKey]))
        : current.filter((item) => item !== branchKey),
    );
    if (!checked) {
      setManagedDepartmentsByBranch((current) => {
        const next = { ...current };
        delete next[branchKey];
        return next;
      });
    } else {
      setManagedDepartmentsByBranch((current) => ({
        ...current,
        [branchKey]: current[branchKey] ?? ["ALL"],
      }));
    }
  }

  function toggleDepartment(branch: string, department: string, checked: boolean) {
    const branchKey = branch.toUpperCase();
    const departmentKey = department.toUpperCase();
    setManagedDepartmentsByBranch((current) => {
      const branchDepartments = current[branchKey] ?? [];
      const nextDepartments = checked
        ? Array.from(new Set([...branchDepartments, departmentKey]))
        : branchDepartments.filter((item) => item !== departmentKey);
      return {
        ...current,
        [branchKey]: nextDepartments,
      };
    });
  }

  function toggleAllDepartments(branch: string, checked: boolean) {
    const branchKey = branch.toUpperCase();
    setManagedDepartmentsByBranch((current) => ({
      ...current,
      [branchKey]: checked ? ["ALL"] : [],
    }));
  }

  async function handleSave() {
    if (!selectedUser) return;
    if (role === "Supervisor") {
      const enabledModules = [
        permissions.announcements,
        permissions.forms,
        permissions.trainingVideos,
        permissions.trainingDocuments,
        permissions.support,
      ].filter(Boolean).length;
      if (enabledModules === 0) {
        toast.error("Choose at least one module permission for this supervisor.");
        return;
      }
      if (managedBranches.length === 0) {
        toast.error("Assign at least one branch before saving a supervisor.");
        return;
      }
      const invalidBranch = managedBranches.find((branch) => {
        const departments = managedDepartmentsByBranch[branch] ?? [];
        return departments.length === 0;
      });
      if (invalidBranch) {
        toast.error(`${invalidBranch} needs at least one department assignment.`);
        return;
      }
    }
    setSaving(true);
    try {
      const nextRole =
        role === "Supervisor" || role === "GeneralStaff" ? role : selectedUser.role;
      const nextPermissions =
        nextRole === "Supervisor" ? permissions : DEFAULT_PERMISSIONS;
      const nextBranches = nextRole === "Supervisor" ? managedBranches : [];
      const nextDepartments =
        nextRole === "Supervisor" ? managedDepartmentsByBranch : {};
      const result = await apiUpdateStaff(selectedUser.id, {
        role: nextRole,
        managedBranches: nextBranches,
        managedDepartmentsByBranch: nextDepartments,
        permissions: nextPermissions,
      });
      if ("err" in result) {
        toast.error(result.err);
        return;
      }
      setStaff((current) =>
        current.map((member) => (member.id === result.ok.id ? result.ok : member)),
      );
      toast.success("Supervisor permissions saved");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveSupervisor() {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const result = await apiUpdateStaff(selectedUser.id, {
        role: "GeneralStaff",
        managedBranches: [],
        managedDepartmentsByBranch: {},
        permissions: DEFAULT_PERMISSIONS,
      });
      if ("err" in result) {
        toast.error(result.err);
        return;
      }
      setStaff((current) =>
        current.map((member) => (member.id === result.ok.id ? result.ok : member)),
      );
      setRole("GeneralStaff");
      setManagedBranches([]);
      setManagedDepartmentsByBranch({});
      setPermissions(DEFAULT_PERMISSIONS);
      toast.success("Supervisor access removed");
    } finally {
      setSaving(false);
    }
  }

  async function handleTransferSupervisor() {
    if (!selectedUser || !transferToId) return;
    const transferTarget = staff.find((member) => member.id === transferToId);
    if (!transferTarget) return;
    if (role !== "Supervisor") {
      toast.error("Select an active supervisor before transferring access.");
      return;
    }
    setSaving(true);
    try {
      const targetResult = await apiUpdateStaff(transferTarget.id, {
        role: "Supervisor",
        managedBranches,
        managedDepartmentsByBranch,
        permissions,
      });
      if ("err" in targetResult) {
        toast.error(targetResult.err);
        return;
      }
      const sourceResult = await apiUpdateStaff(selectedUser.id, {
        role: "GeneralStaff",
        managedBranches: [],
        managedDepartmentsByBranch: {},
        permissions: DEFAULT_PERMISSIONS,
      });
      if ("err" in sourceResult) {
        toast.error(sourceResult.err);
        return;
      }
      setStaff((current) =>
        current.map((member) => {
          if (member.id === targetResult.ok.id) return targetResult.ok;
          if (member.id === sourceResult.ok.id) return sourceResult.ok;
          return member;
        }),
      );
      setSelectedId(targetResult.ok.id);
      setTransferToId("");
      toast.success(`Supervisor access transferred to ${targetResult.ok.fullname}`);
    } finally {
      setSaving(false);
    }
  }

  const supervisorWarnings = useMemo(() => {
    if (role !== "Supervisor") return [];
    if (managedBranches.length === 0) {
      return ["This supervisor has no assigned branch yet, so they cannot publish scoped content."];
    }
    return managedBranches.flatMap((branch) => {
      const departments = managedDepartmentsByBranch[branch] ?? [];
      if (departments.length === 0) {
        return [`${branch} has no department access selected yet.`];
      }
      if (!departments.includes("ALL") && departments.length < DEPARTMENTS.length) {
        return [
          `${branch} is partially assigned: ${departments.join(", ")} only.`,
        ];
      }
      return [];
    });
  }, [managedBranches, managedDepartmentsByBranch, role]);

  const supervisorScopeSummary = useMemo(() => {
    if (role !== "Supervisor" || managedBranches.length === 0) return [];
    return managedBranches.map((branch) =>
      formatAudienceSummary(
        [branch],
        managedDepartmentsByBranch[branch]?.length
          ? managedDepartmentsByBranch[branch]
          : ["ALL"],
      ),
    );
  }, [managedBranches, managedDepartmentsByBranch, role]);

  const supervisorModuleSummary = useMemo(
    () =>
      (
        [
          ["announcements", "Announcements"],
          ["forms", "Forms Centre"],
          ["trainingVideos", "Training Videos"],
          ["trainingDocuments", "Training Documents"],
          ["support", "Support Admin"],
        ] as const
      )
        .filter(([key]) => permissions[key])
        .map(([, label]) => label),
    [permissions],
  );

  return (
    <AppShell>
      <RoleGuard
        roles={["SuperAdmin", "HRAdmin"]}
        permission="userManagement"
        fallback={
          <div className="py-16 text-center text-muted-foreground">
            You do not have permission to manage supervisors.
          </div>
        }
      >
        <div className="page-shell">
          <section className="page-header">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="page-kicker">Access and delegation</div>
              <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground">
                <ShieldCheck className="h-6 w-6 text-primary" />
                Supervisor Management
              </h1>
              <p className="page-subtitle mt-2">
                Assign branch, department, and module access for supervisors.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => navigate({ to: "/directory" })}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Directory
            </Button>
          </div>
          </section>

          {loading ? (
            <div className="surface-muted p-8 text-sm text-muted-foreground">
              Loading staff...
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
              <div className="glass-card panel-sharp space-y-4 p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-9"
                    placeholder="Search staff..."
                  />
                </div>
                <ScrollArea className="h-[560px]">
                  <div className="space-y-2 pr-3">
                    {filteredStaff.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setSelectedId(member.id)}
                        className={`panel-sharp w-full border px-3 py-3 text-left transition-smooth ${
                          member.id === selectedId
                            ? "border-primary bg-primary/8"
                            : "border-border/50 bg-background/40 hover:border-primary/30"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {member.fullname}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {member.branch} · {member.department}
                            </p>
                          </div>
                          <Badge variant={member.role === "Supervisor" ? "default" : "outline"}>
                            {member.role === "Supervisor" ? "Supervisor" : "Staff"}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {!selectedUser ? (
                <EmptyState
                  title="Select a staff member"
                  description="Choose someone from the list to assign supervisor permissions."
                  icon={<Users className="h-7 w-7" />}
                />
              ) : (
                <div className="space-y-6 rounded-2xl border border-border/50 bg-card/60 p-6">
                  <div className="space-y-1">
                    <h2 className="font-display text-xl font-bold text-foreground">
                      {selectedUser.fullname}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedUser.email} · {selectedUser.branch} · {selectedUser.department}
                    </p>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                      <div className="flex items-start gap-3">
                        <UserX className="mt-0.5 h-5 w-5 text-destructive" />
                        <div className="flex-1 space-y-3">
                          <div>
                            <h3 className="font-medium text-foreground">
                              Remove supervisor access
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              Use this when the staff member is transferred, no longer supervises, or stops working with the bank.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={saving || selectedUser.role !== "Supervisor"}
                            onClick={handleRemoveSupervisor}
                          >
                            Remove Supervisor Access
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                      <div className="flex items-start gap-3">
                        <ArrowRightLeft className="mt-0.5 h-5 w-5 text-primary" />
                        <div className="flex-1 space-y-3">
                          <div>
                            <h3 className="font-medium text-foreground">
                              Transfer supervisor access
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              Copies this supervisor's branch, department, and module access to another staff member, then removes it from this one.
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Select value={transferToId} onValueChange={setTransferToId}>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Transfer to..." />
                              </SelectTrigger>
                              <SelectContent>
                                {staff
                                  .filter((member) => member.id !== selectedUser.id)
                                  .map((member) => (
                                    <SelectItem key={member.id} value={member.id}>
                                      {member.fullname}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              size="sm"
                              disabled={
                                saving ||
                                selectedUser.role !== "Supervisor" ||
                                !transferToId
                              }
                              onClick={handleTransferSupervisor}
                            >
                              Transfer
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className="space-y-4 rounded-xl border border-border/50 bg-background/40 p-4">
                      <div className="space-y-1">
                        <Label>Role</Label>
                        <Select
                          value={role}
                          onValueChange={(value) => setRole(value as User["role"])}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GeneralStaff">General Staff</SelectItem>
                            <SelectItem value="Supervisor">Supervisor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <KeyRound className="h-4 w-4 text-primary" />
                          Module Permissions
                        </div>
                        {(
                          [
                            ["announcements", "Announcements"],
                            ["forms", "Forms Centre"],
                            ["trainingVideos", "Training Videos"],
                            ["trainingDocuments", "Training Documents"],
                            ["support", "Support Admin"],
                          ] as const
                        ).map(([key, label]) => (
                          <div
                            key={key}
                            className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2"
                          >
                            <span className="text-sm text-foreground">{label}</span>
                            <Switch
                              checked={permissions[key]}
                              disabled={role !== "Supervisor"}
                              onCheckedChange={(checked) =>
                                setPermissions((current) => ({
                                  ...current,
                                  [key]: checked,
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        User management remains reserved for global IT and HR admins.
                      </p>
                    </div>

                    <div className="space-y-4 rounded-xl border border-border/50 bg-background/40 p-4">
                      <div className="space-y-1">
                        <Label>Managed Branches</Label>
                        <p className="text-xs text-muted-foreground">
                          Choose which branches this supervisor can manage.
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {BRANCHES.map((branch) => {
                          const checked = managedBranches.includes(branch.toUpperCase());
                          return (
                            <label
                              key={branch}
                              className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2"
                            >
                              <Checkbox
                                checked={checked}
                                disabled={role !== "Supervisor"}
                                onCheckedChange={(value) =>
                                  toggleBranch(branch, Boolean(value))
                                }
                              />
                              <span className="text-sm text-foreground">{branch}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {role === "Supervisor" && managedBranches.length > 0 ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium text-foreground">Department Access by Branch</h3>
                        <p className="text-xs text-muted-foreground">
                          Pick all departments this supervisor can manage inside each selected branch.
                        </p>
                      </div>
                      <div className="grid gap-4 xl:grid-cols-2">
                        {managedBranches.map((branch) => {
                          const current = managedDepartmentsByBranch[branch] ?? [];
                          const allChecked = current.includes("ALL");
                          return (
                            <div
                              key={branch}
                              className="space-y-3 rounded-xl border border-border/50 bg-background/40 p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <h4 className="font-medium text-foreground">{branch}</h4>
                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Checkbox
                                    checked={allChecked}
                                    onCheckedChange={(value) =>
                                      toggleAllDepartments(branch, Boolean(value))
                                    }
                                  />
                                  All departments
                                </label>
                              </div>
                              {!allChecked ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {DEPARTMENTS.map((department) => (
                                    <label
                                      key={`${branch}-${department}`}
                                      className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2"
                                    >
                                      <Checkbox
                                        checked={current.includes(department.toUpperCase())}
                                        onCheckedChange={(value) =>
                                          toggleDepartment(branch, department, Boolean(value))
                                        }
                                      />
                                      <span className="text-sm text-foreground">{department}</span>
                                    </label>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background/40 p-4 space-y-3">
                        <div>
                          <h4 className="font-medium text-foreground">Supervisor scope summary</h4>
                          <p className="text-xs text-muted-foreground">
                            This is how the portal will treat this supervisor's branch and department reach.
                          </p>
                        </div>
                        <div className="space-y-2">
                          {supervisorScopeSummary.map((summary) => (
                            <div
                              key={summary}
                              className="rounded-lg border border-border/40 px-3 py-2 text-sm text-foreground"
                            >
                              {summary}
                            </div>
                          ))}
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Enabled modules
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {supervisorModuleSummary.length > 0 ? (
                              supervisorModuleSummary.map((label) => (
                                <Badge key={label} variant="outline">
                                  {label}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                No module permissions selected yet.
                              </span>
                            )}
                          </div>
                        </div>
                        {supervisorWarnings.length > 0 ? (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                              Warnings
                            </div>
                            <div className="mt-2 space-y-1">
                              {supervisorWarnings.map((warning) => (
                                <p key={warning} className="text-sm text-amber-500">
                                  {warning}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <Button type="button" onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Save Supervisor Access"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </RoleGuard>
    </AppShell>
  );
}

import { AgmLayout } from "@/components/AgmLayout";
import { AgmYearSwitcher } from "@/components/AgmYearSwitcher";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgmYear } from "@/context/AgmYearContext";
import {
  AGM_UPDATED_EVENT,
  apiGetAgmOperatorActivity,
  apiGetAgmSettings,
  apiResetAgmVerificationCode,
  apiUpdateAgmSettings,
} from "@/lib/backend-client";
import type { AgmRole } from "@/lib/agm-auth-client";
import {
  type AgmOperatorActivityRecord,
  type AgmSettingsRecord,
} from "@/lib/agm-module";
import { cn } from "@/lib/utils";
import { useAgmAuth } from "@/store/agm-auth";
import { useAuth } from "@/store/auth";
import {
  AlertTriangle,
  CheckSquare,
  Clock,
  Copy,
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
import { useEffect, useState } from "react";
import { toast } from "sonner";

function formatTimestamp(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function mapRoleLabel(role?: AgmRole | string | null) {
  if (!role) return "Viewer";
  if (role === "SuperAdmin") return "Super Admin";
  if (role === "RegistrationOfficer") return "Officer";
  if (role === "ReportsViewer") return "Reports Viewer";
  if (role === "BoardViewer") return "Board Viewer";
  return role;
}

function RoleBadge({ role }: { role: string }) {
  if (role === "Super Admin") {
    return (
      <Badge className="bg-destructive/20 text-destructive border border-destructive/30 text-xs">
        Super Admin
      </Badge>
    );
  }
  if (role === "Officer") {
    return (
      <Badge className="bg-primary/20 text-primary border border-primary/30 text-xs">
        Officer
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      {role}
    </Badge>
  );
}

function AdminUsersTab({
  username,
  role,
  phoneNumber,
  lastLogin,
  onResetCode,
  isSuperAdmin,
}: {
  username: string;
  role: string;
  phoneNumber: string;
  lastLogin: string;
  onResetCode: () => void;
  isSuperAdmin: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

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

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="normal-case tracking-normal text-muted-foreground">Username</TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground">Role</TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground">Phone Number</TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground">Status</TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground">Last Login</TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow data-ocid="admin.users.item.1">
              <TableCell className="font-medium text-foreground">{username}</TableCell>
              <TableCell><RoleBadge role={role} /></TableCell>
              <TableCell>{phoneNumber}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-primary text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Active
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{lastLogin}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-2">
                  {isSuperAdmin ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5"
                        onClick={onResetCode}
                        data-ocid="admin.users.reset_code_button.1"
                      >
                        Reset Code
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5"
                        disabled
                      >
                        <UserCog className="w-3.5 h-3.5" />
                        Role
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled
                      >
                        Deactivate
                      </Button>
                    </>
                  ) : (
                    <Badge variant="secondary" className="text-xs h-8 px-3 rounded-md">
                      Read Only
                    </Badge>
                  )}
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent data-ocid="admin.users.add_modal">
          <DialogHeader>
            <DialogTitle className="font-display">Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input placeholder="Enter username" />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" placeholder="Enter password" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <Input placeholder="0241234567" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select defaultValue="Viewer">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SuperAdmin">Super Admin</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="RegistrationOfficer">Registration Officer</SelectItem>
                  <SelectItem value="ReportsViewer">Reports Viewer</SelectItem>
                  <SelectItem value="BoardViewer">Board Viewer</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                toast.info("AGM user creation is not wired in this portal yet.");
                setAddOpen(false);
              }}
            >
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminAuditTab({
  activeYear,
  entries,
}: {
  activeYear: string;
  entries: AgmOperatorActivityRecord[];
}) {
  const [filter, setFilter] = useState<"all" | "shareholder" | "registration" | "checkin" | "user">("all");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const action = entry.action.toLowerCase();
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "shareholder"
            ? entry.target.toLowerCase().includes("shareholder")
            : filter === "registration"
              ? action.includes("registration")
              : filter === "checkin"
                ? action.includes("check")
                : action.includes("login") || action.includes("user");
      const matchesQuery =
        !normalized ||
        [entry.operatorName, entry.action, entry.target, entry.branch]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [entries, filter, query]);

  const allVisibleSelected =
    filteredEntries.length > 0 &&
    filteredEntries.every((entry) => selectedIds.includes(entry.id));

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !filteredEntries.some((entry) => entry.id === id))
        : Array.from(new Set([...current, ...filteredEntries.map((entry) => entry.id)])),
    );
  }

  function handleDeleteSelected() {
    toast.info(
      `${selectedIds.length} audit entr${selectedIds.length === 1 ? "y" : "ies"} selected. Delete action is not wired in this portal yet.`,
    );
  }

  return (
    <div data-ocid="admin.audit.panel" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-display font-semibold text-lg text-foreground">
          Audit Trail
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="min-w-[150px]">
            <AgmYearSwitcher compact />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
            {[
              ["all", "All"],
              ["shareholder", "Shareholder"],
              ["registration", "Registration"],
              ["checkin", "CheckIn"],
              ["user", "User"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value as typeof filter)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-smooth min-h-[36px]",
                  filter === value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by date (e.g. 5/4)"
            className="h-9 w-44 text-xs"
          />
          <Button variant="outline" className="gap-2 min-h-[44px]">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          {selectedIds.length > 0 && (
            <Button
              variant="outline"
              onClick={handleDeleteSelected}
              className="gap-2 min-h-[44px] border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table className="min-w-[1100px]">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="normal-case tracking-normal text-muted-foreground w-[120px]">
                <button
                  type="button"
                  className="inline-flex items-center gap-2"
                  onClick={toggleSelectAll}
                >
                  {allVisibleSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                  Select all
                </button>
              </TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground">AGM Year</TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground">Timestamp</TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground">Action</TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground">Entity Type</TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground">Entity ID</TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground">Performed By</TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground">Details</TableHead>
            </TableRow>
          </TableHeader>
            <TableBody>
              {filteredEntries.map((entry, index) => (
              <TableRow key={entry.id || index}>
                <TableCell>
                  <button
                    type="button"
                    className="flex items-center justify-center"
                    onClick={() => toggleSelected(entry.id)}
                    aria-label={
                      selectedIds.includes(entry.id)
                        ? `Deselect audit entry ${index + 1}`
                        : `Select audit entry ${index + 1}`
                    }
                  >
                    {selectedIds.includes(entry.id) ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </TableCell>
                <TableCell>{activeYear}</TableCell>
                <TableCell>{formatTimestamp(entry.timestamp)}</TableCell>
                <TableCell className="font-semibold text-foreground">{entry.action.toUpperCase()}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {entry.action.toLowerCase().includes("login")
                      ? "user"
                      : entry.target.toLowerCase().includes("seed")
                        ? "system"
                        : "agm"}
                  </Badge>
                </TableCell>
                <TableCell>{entry.target}</TableCell>
                <TableCell className="font-semibold text-foreground">{entry.operatorName}</TableCell>
                <TableCell className="max-w-[260px] truncate text-muted-foreground">
                  {entry.action === "LOGIN" ? "User logged in" : `${entry.action} on ${entry.target}`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AdminSessionsTab({
  username,
  role,
  expiresAt,
}: {
  username: string;
  role: string;
  expiresAt: string;
}) {
  return (
    <div data-ocid="admin.sessions.panel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-lg text-foreground">Active Sessions</h2>
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="w-4 h-4" />
          Auto-refreshes every 30s
        </div>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="normal-case tracking-normal text-muted-foreground">Username</TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground">Role</TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground">Login Time</TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground">Expires</TableHead>
              <TableHead className="normal-case tracking-normal text-muted-foreground text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium text-foreground">{username}</TableCell>
              <TableCell><RoleBadge role={role} /></TableCell>
              <TableCell>Active session</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {expiresAt}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <Button variant="outline" className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10">
                    Force Logout
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AdminSettingsTab({
  activeYear,
  settings,
  setSettings,
  sessionTimeout,
  setSessionTimeout,
  onSave,
}: {
  activeYear: string;
  settings: AgmSettingsRecord;
  setSettings: React.Dispatch<React.SetStateAction<AgmSettingsRecord>>;
  sessionTimeout: string;
  setSessionTimeout: React.Dispatch<React.SetStateAction<string>>;
  onSave: () => void;
}) {
  const cloneTargetYear = String(Number(activeYear) + 1);

  return (
    <div data-ocid="admin.settings.panel">
      <h2 className="font-display font-semibold text-lg text-foreground mb-4">
        AGM Settings
      </h2>
      <div className="max-w-3xl space-y-5">
        <div className="space-y-1.5">
          <Label>
            AGM Name <span className="text-destructive">*</span>
          </Label>
          <Input
            value={settings.agmName}
            onChange={(e) => setSettings((f) => ({ ...f, agmName: e.target.value }))}
            placeholder="e.g. Annual General Meeting 2026"
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            AGM Date <span className="text-destructive">*</span>
          </Label>
          <Input
            value={settings.agmDate}
            onChange={(e) => setSettings((f) => ({ ...f, agmDate: e.target.value }))}
            placeholder="e.g. 2026-06-15"
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            Venue <span className="text-destructive">*</span>
          </Label>
          <Input
            value={settings.venue}
            onChange={(e) => setSettings((f) => ({ ...f, venue: e.target.value }))}
            placeholder="e.g. Grand Ballroom, Capital Hotel"
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            Quorum Threshold (%) <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={Number(settings.quorumRequiredPct || 50)}
            onChange={(e) =>
              setSettings((f) => ({
                ...f,
                quorumRequiredPct: Number(e.target.value || 0),
              }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            Session Timeout (minutes) <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            min={1}
            value={sessionTimeout}
            onChange={(e) => setSessionTimeout(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Configure AGM parameters. Changes take effect immediately.
          </p>
          <Button onClick={onSave} className="min-h-[44px] gap-2">
            Save Settings
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
              <Badge className="bg-primary/15 text-primary border border-primary/30">
                Open
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline">Lock Year</Button>
              <Button type="button" variant="outline">Archive Year</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label>Clone Settings Into Year</Label>
                <Select value={cloneTargetYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={cloneTargetYear}>AGM {cloneTargetYear}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="button">Clone Year Settings</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminDangerZoneTab() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const confirmPhrase = "DELETE ALL SHAREHOLDERS";

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
              <strong className="text-foreground">all shareholder records</strong>,
              including registrations and check-in data.
            </p>
            <p className="text-sm font-semibold text-destructive mb-4">
              This cannot be undone. Use only during system reset or before a new AGM cycle.
            </p>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 min-h-[44px] gap-2"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              Delete All Shareholders
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-destructive flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              Confirm Permanent Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
              <p className="text-sm text-destructive font-medium">
                You are about to delete ALL shareholder records. This action is permanent and cannot be reversed.
              </p>
            </div>
            <div className="space-y-2">
              <Label>
                Type <span className="font-mono font-bold text-destructive">{confirmPhrase}</span> to confirm:
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={confirmPhrase}
                className="font-mono border-destructive/40"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== confirmPhrase}
              onClick={() => {
                toast.info("Full shareholder deletion is not wired in this portal yet.");
                setDeleteOpen(false);
                setConfirmText("");
              }}
            >
              Delete Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AgmAdminPage() {
  const { activeYear } = useAgmYear();
  const { user } = useAuth();
  const { session } = useAgmAuth();
  const [settings, setSettings] = useState<AgmSettingsRecord>({
    agmName: "",
    venue: "",
    agmDate: "",
    quorumRequiredPct: 50,
  });
  const [sessionTimeout, setSessionTimeout] = useState("120");
  const [activity, setActivity] = useState<AgmOperatorActivityRecord[]>([]);
  const [resetCodeOpen, setResetCodeOpen] = useState(false);
  const [issuedResetCode, setIssuedResetCode] = useState("");

  useEffect(() => {
    const load = () => {
      void Promise.all([
        apiGetAgmSettings(),
        apiGetAgmOperatorActivity(),
      ]).then(([nextSettings, nextActivity]) => {
        setSettings(nextSettings);
        setActivity(nextActivity);
      });
    };
    load();
    window.addEventListener(AGM_UPDATED_EVENT, load);
    return () => window.removeEventListener(AGM_UPDATED_EVENT, load);
  }, [activeYear]);

  const username = session?.username ?? "T4N4AMEG8F5";
  const role = mapRoleLabel(session?.role ?? "SuperAdmin");
  const phoneNumber = user?.phone ?? "0241234567";
  const lastLogin = formatTimestamp(activity[0]?.timestamp ?? new Date().toISOString());
  const expiresAt = formatTimestamp(
    session?.expiresAt ?? new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
  );

  async function handleSaveSettings() {
    const updated = await apiUpdateAgmSettings(
      {
        agmName: settings.agmName,
        venue: settings.venue,
        agmDate: settings.agmDate,
        quorumRequiredPct: Number(settings.quorumRequiredPct),
      },
      user?.fullname ?? "AGM Operator",
    );
    setSettings(updated);
    toast.success("AGM settings saved.");
  }

  async function handleResetCode() {
    setIssuedResetCode(`RST-${username}`);
    setResetCodeOpen(true);
    toast.success(`Reset code created for "${username}"`);
  }

  const isAdminAllowed =
    session?.role === "SuperAdmin" || session?.role === "Admin";
  const isSuperAdmin = session?.role === "SuperAdmin";

  if (session && !isAdminAllowed) {
    return (
      <AgmLayout>
        <div className="page-shell space-y-6">
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
        </div>
      </AgmLayout>
    );
  }

  return (
    <AgmLayout>
      <div data-ocid="admin.page" className="page-shell space-y-6">
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
            <TabsTrigger value="users" className="gap-2 min-h-[44px] flex-1 sm:flex-none">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2 min-h-[44px] flex-1 sm:flex-none">
              <Clock className="w-4 h-4" />
              Audit Trail
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-2 min-h-[44px] flex-1 sm:flex-none">
              <Shield className="w-4 h-4" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 min-h-[44px] flex-1 sm:flex-none">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger
                value="danger"
                className="gap-2 min-h-[44px] flex-1 sm:flex-none text-destructive data-[state=active]:text-destructive"
              >
                <ShieldAlert className="w-4 h-4" />
                Danger Zone
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="users" className="bg-card rounded-xl border border-border p-4 lg:p-6">
            <AdminUsersTab
              username={username}
              role={role}
              phoneNumber={phoneNumber}
              lastLogin={lastLogin}
              onResetCode={handleResetCode}
              isSuperAdmin={isSuperAdmin}
            />
          </TabsContent>

          <TabsContent value="audit" className="bg-card rounded-xl border border-border p-4 lg:p-6">
            <AdminAuditTab activeYear={activeYear} entries={activity} />
          </TabsContent>

          <TabsContent value="sessions" className="bg-card rounded-xl border border-border p-4 lg:p-6">
            <AdminSessionsTab username={username} role={role} expiresAt={expiresAt} />
          </TabsContent>

          <TabsContent value="settings" className="bg-card rounded-xl border border-border p-4 lg:p-6">
            <AdminSettingsTab
              activeYear={activeYear}
              settings={settings}
              setSettings={setSettings}
              sessionTimeout={sessionTimeout}
              setSessionTimeout={setSessionTimeout}
              onSave={handleSaveSettings}
            />
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="danger" className="bg-card rounded-xl border border-border p-4 lg:p-6">
              <AdminDangerZoneTab />
            </TabsContent>
          )}
        </Tabs>

        <Dialog open={resetCodeOpen} onOpenChange={setResetCodeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Password Reset Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Share this one-time code with{" "}
                <span className="font-semibold text-foreground">{username}</span>.
              </p>
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 flex items-center justify-between gap-3">
                <code className="font-mono text-lg font-bold text-primary break-all">
                  {issuedResetCode}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={async () => {
                    await navigator.clipboard.writeText(issuedResetCode);
                    toast.success("Reset code copied");
                  }}
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setResetCodeOpen(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AgmLayout>
  );
}

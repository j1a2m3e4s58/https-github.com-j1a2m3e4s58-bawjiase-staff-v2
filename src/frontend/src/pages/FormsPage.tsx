import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { LiveSyncBadge } from "@/components/LiveSyncBadge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  type CreateFormRequest,
  apiCreateForm,
  apiDeleteForm,
  apiDownloadFormUrl,
  apiExtractDriveFileId,
  apiGetCachedForms,
  apiGetForms,
  apiOpenFormUrl,
  apiUpdateForm,
  canManageAllDepartmentsForBranch,
  formatAudienceSummary,
  formatManageableScopeSummary,
  getManageableBranches,
  getManageableDepartmentsForBranch,
  getScopeCoverageWarning,
  userCanManageScopedItem,
  userHasPermission,
} from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import { BRANCHES, DEPARTMENTS, type PortalForm, type Role, type User } from "@/types";
import { isOk } from "@/types";
import {
  Download,
  Edit2,
  Eye,
  FileText,
  FolderOpen,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const FORMS_PAGE_SIZE = 12;

const CATEGORIES = [
  "General",
  "HR",
  "IT",
  "SUSU",
  "RECOVERY",
  "AUDIT",
  "CREDIT",
  "COMPLIANCE",
  "FINANCE",
  "OPERATIONS",
  "MICROFINANCE",
  "E-BANKING",
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  General: "bg-muted text-muted-foreground",
  HR: "bg-secondary/20 text-secondary",
  IT: "bg-accent/20 text-accent",
  SUSU: "bg-primary/15 text-primary",
  RECOVERY: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  AUDIT: "bg-red-500/15 text-red-600 dark:text-red-400",
  CREDIT: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  COMPLIANCE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  FINANCE: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  OPERATIONS: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  MICROFINANCE: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  "E-BANKING": "bg-violet-500/15 text-violet-600 dark:text-violet-400",
};

function canManageForms(user: ReturnType<typeof useAuth>["user"]) {
  return userHasPermission(user, "forms");
}

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: PortalForm;
  onSave: (req: CreateFormRequest) => Promise<void>;
  isSaving: boolean;
  currentUser: User | null;
}

function FormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  isSaving,
  currentUser,
}: FormDialogProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<string>(
    initial?.category ?? "General",
  );
  const [fileUrl, setFileUrl] = useState(initial?.fileUrl ?? "");
  const [sendExternalEmails, setSendExternalEmails] = useState(false);
  const manageableBranches = useMemo(
    () => getManageableBranches(currentUser),
    [currentUser],
  );
  const canTargetAllBranches =
    currentUser?.role === "SuperAdmin" || currentUser?.role === "HRAdmin";
  const [branchTarget, setBranchTarget] = useState("ALL");
  const [departmentTarget, setDepartmentTarget] = useState("ALL");
  const manageableDepartments = useMemo(
    () =>
      branchTarget === "ALL"
        ? [...DEPARTMENTS]
        : getManageableDepartmentsForBranch(currentUser, branchTarget),
    [branchTarget, currentUser],
  );
  const canTargetAllDepartments =
    currentUser?.role === "SuperAdmin" ||
    currentUser?.role === "HRAdmin" ||
    manageableDepartments.length === DEPARTMENTS.length;

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setCategory(initial?.category ?? "General");
    setFileUrl(initial?.fileUrl ?? "");
    setSendExternalEmails(false);
    setBranchTarget(
      initial?.branchScope?.[0] ??
        (canTargetAllBranches ? "ALL" : manageableBranches[0] ?? "ALL"),
    );
    setDepartmentTarget(
      initial?.departmentScope?.[0] ??
        (initial?.visibility === "Department" && initial.department
          ? initial.department
          : "ALL"),
    );
  }, [open, initial?.id]);

  useEffect(() => {
    if (!canTargetAllBranches && branchTarget === "ALL" && manageableBranches.length > 0) {
      setBranchTarget(manageableBranches[0]);
      return;
    }
    if (
      departmentTarget === "ALL" &&
      branchTarget !== "ALL" &&
      !canManageAllDepartmentsForBranch(currentUser, branchTarget) &&
      manageableDepartments.length > 0
    ) {
      setDepartmentTarget(manageableDepartments[0]);
    }
  }, [
    branchTarget,
    canTargetAllBranches,
    currentUser,
    departmentTarget,
    manageableBranches,
    manageableDepartments,
  ]);

  const audienceSummary = formatAudienceSummary(
    branchTarget === "ALL" ? ["ALL"] : [branchTarget],
    departmentTarget === "ALL" ? ["ALL"] : [departmentTarget],
  );
  const scopeWarning = getScopeCoverageWarning(
    currentUser,
    branchTarget,
    departmentTarget,
  );

  async function handleSubmit() {
    if (!title.trim() || !category.trim() || !fileUrl.trim()) {
      toast.error("Form title, category, and Google Drive link are required.");
      return;
    }

    await onSave({
      title: title.trim(),
      description: "",
      fileUrl: apiExtractDriveFileId(fileUrl),
      category,
      visibleTo: [] as Role[],
      visibility: departmentTarget === "ALL" ? "General" : "Department",
      department: departmentTarget === "ALL" ? null : departmentTarget,
      branchScope: branchTarget === "ALL" ? ["ALL"] : [branchTarget],
      departmentScope: departmentTarget === "ALL" ? ["ALL"] : [departmentTarget],
      sendExternalEmails: initial ? false : sendExternalEmails,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="glass-card-elevated w-[min(92vw,44rem)] max-w-[44rem] max-h-[85vh] overflow-y-auto p-6 sm:max-w-[44rem]"
        data-ocid="forms.dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display">
            {initial ? "Rename Form" : "Upload New Form"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
              <Label htmlFor="form-title">Form Title</Label>
              <Input
                id="form-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. 2025 Leave Request"
                className="text-foreground caret-primary"
                autoComplete="off"
                style={{ color: "rgb(241 245 249)", WebkitTextFillColor: "rgb(241 245 249)" }}
                data-ocid="forms.title.input"
              />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="form-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger
                id="form-category"
                data-ocid="forms.category.select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                side="top"
                align="start"
                sideOffset={6}
                collisionPadding={16}
                className="max-h-72"
              >
                {CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
              <Label htmlFor="form-url">Google Drive Link</Label>
              <Input
                id="form-url"
                value={fileUrl}
                onChange={(event) => setFileUrl(event.target.value)}
                placeholder="Paste full Google Drive link or just the ID"
                className="text-foreground caret-primary"
                autoComplete="off"
                style={{ color: "rgb(241 245 249)", WebkitTextFillColor: "rgb(241 245 249)" }}
                data-ocid="forms.url.input"
              />
            <p className="text-xs text-muted-foreground">
              Drive file links are stored as file IDs. Google Docs, Sheets, and
              Slides links stay as full links so they open correctly.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Branch Audience</Label>
              <Select value={branchTarget} onValueChange={setBranchTarget}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canTargetAllBranches ? <SelectItem value="ALL">All branches</SelectItem> : null}
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
              <Select value={departmentTarget} onValueChange={setDepartmentTarget}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canTargetAllDepartments ? (
                    <SelectItem value="ALL">All departments</SelectItem>
                  ) : null}
                  {manageableDepartments.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
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
                Only staff inside this branch and department scope will see this form.
              </p>
            )}
          </div>
          {!initial ? (
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label
                    htmlFor="forms-external-email"
                    className="text-sm font-medium"
                  >
                    Send external email too
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Staff will still get the normal in-app notification. Turn
                    this on only when you also want email alerts sent out.
                  </p>
                </div>
                <Switch
                  id="forms-external-email"
                  checked={sendExternalEmails}
                  onCheckedChange={setSendExternalEmails}
                  data-ocid="forms.external_email.switch"
                />
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-ocid="forms.cancel_button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            data-ocid="forms.submit_button"
          >
            {isSaving ? "Saving..." : initial ? "Save Changes" : "Upload Form"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FormCardProps {
  form: PortalForm;
  canManage: boolean;
  onEdit: (form: PortalForm) => void;
  onDelete: (form: PortalForm) => void;
  index: number;
}

function FormCard({ form, canManage, onEdit, onDelete, index }: FormCardProps) {
  const categoryColor =
    CATEGORY_COLORS[form.category] ?? CATEGORY_COLORS.General;
  const audienceSummary = formatAudienceSummary(
    form.branchScope,
    form.departmentScope,
  );

  return (
    <div
      className="glass-card group rounded-xl p-4 transition-smooth hover:shadow-glass"
      data-ocid={`forms.item.${index}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3 sm:min-w-0 sm:flex-1">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:truncate sm:line-clamp-1">
              {form.title}
            </h3>
            <Badge className={`mt-2 text-[11px] ${categoryColor}`}>
              {form.category}
            </Badge>
            <p className="mt-2 text-xs text-muted-foreground">
              {audienceSummary}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-shrink-0 sm:items-center sm:gap-1.5">
          {canManage && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 justify-start gap-2 sm:h-8 sm:w-8 sm:justify-center sm:px-0"
                onClick={() => onEdit(form)}
                title="Edit Form"
                data-ocid={`forms.edit_button.${index}`}
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span className="sm:hidden">Edit</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 justify-start gap-2 text-destructive hover:text-destructive sm:h-8 sm:w-8 sm:justify-center sm:px-0"
                onClick={() => onDelete(form)}
                title="Remove Form"
                data-ocid={`forms.delete_button.${index}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sm:hidden">Delete</span>
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 justify-start gap-2 sm:h-8 sm:w-8 sm:justify-center sm:px-0"
            onClick={() => window.open(apiOpenFormUrl(form.fileUrl), "_blank")}
            title="View File"
            data-ocid={`forms.view_button.${index}`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="sm:hidden">View</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 justify-start gap-2 sm:h-8 sm:w-8 sm:justify-center sm:px-0"
            onClick={() =>
              window.open(apiDownloadFormUrl(form.fileUrl), "_blank")
            }
            title="Save / Print PDF"
            data-ocid={`forms.download_button.${index}`}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="sm:hidden">Download</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function FormsPage() {
  const { user } = useAuth();
  const canAdmin = canManageForms(user);
  const manageableBranches = getManageableBranches(user);
  const actingScope = formatManageableScopeSummary(user);

  const [forms, setForms] = useState<PortalForm[]>(() => apiGetCachedForms(user));
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(FORMS_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<PortalForm | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PortalForm | undefined>();
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadForms() {
      try {
        const data = await apiGetForms(user);
        if (cancelled) return;
        setForms(data);
        setLoadError(false);
      } catch {
        if (cancelled) return;
        if (apiGetCachedForms(user).length === 0) {
          setForms([]);
        }
        setLoadError(true);
        toast.error("Forms could not be loaded. Please try again.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadForms();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    setVisibleCount(FORMS_PAGE_SIZE);
  }, [forms.length, search, branchFilter, departmentFilter]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return forms.filter((form) => {
      const branchScope = form.branchScope ?? ["ALL"];
      const departmentScope = form.departmentScope ?? ["ALL"];
      const branchMatches =
        branchFilter === "ALL" ||
        branchScope.includes("ALL") ||
        branchScope.includes(branchFilter);
      const departmentMatches =
        departmentFilter === "ALL" ||
        departmentScope.includes("ALL") ||
        departmentScope.includes(departmentFilter);
      if (!branchMatches || !departmentMatches) return false;
      if (!query) return true;
      return (
        form.title.toLowerCase().includes(query) ||
        form.category.toLowerCase().includes(query)
      );
    });
  }, [branchFilter, departmentFilter, forms, search]);

  const availableBranches = useMemo(() => {
    const visible = new Set<string>();
    forms.forEach((form) => {
      (form.branchScope ?? ["ALL"]).forEach((branch) => {
        if (branch !== "ALL") visible.add(branch);
      });
    });
    const ordered = manageableBranches.length > 0 ? manageableBranches : Array.from(visible);
    return ordered.filter((branch) => visible.has(branch));
  }, [forms, manageableBranches]);

  const availableDepartments = useMemo(() => {
    const visible = new Set<string>();
    forms
      .filter((form) => {
        if (branchFilter === "ALL") return true;
        const branches = form.branchScope ?? ["ALL"];
        return branches.includes("ALL") || branches.includes(branchFilter);
      })
      .forEach((form) => {
        (form.departmentScope ?? ["ALL"]).forEach((department) => {
          if (department !== "ALL") visible.add(department);
        });
      });
    if (branchFilter !== "ALL") {
      const manageable = getManageableDepartmentsForBranch(user, branchFilter);
      return manageable.filter((department) => visible.has(department));
    }
    return Array.from(visible).sort();
  }, [branchFilter, forms, user]);

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

  async function handleSave(req: CreateFormRequest) {
    setIsSaving(true);
    try {
      if (editingForm) {
        const result = await apiUpdateForm(editingForm.id, req);
        if (isOk(result)) {
          setForms((prev) =>
            prev
              .map((form) => (form.id === editingForm.id ? result.ok : form))
              .sort(
                (a, b) =>
                  a.category.localeCompare(b.category) ||
                  a.title.localeCompare(b.title),
              ),
          );
          toast.success("Form updated");
        } else {
          toast.error(result.err);
          return;
        }
      } else {
        const result = await apiCreateForm(req);
        if (isOk(result)) {
          setForms((prev) =>
            [result.ok, ...prev].sort(
              (a, b) =>
                a.category.localeCompare(b.category) ||
                a.title.localeCompare(b.title),
            ),
          );
          toast.success("New form added successfully");
        } else {
          toast.error(result.err);
          return;
        }
      }
      setDialogOpen(false);
      setEditingForm(undefined);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const result = await apiDeleteForm(deleteTarget.id);
    if (isOk(result)) {
      setForms((prev) => prev.filter((form) => form.id !== deleteTarget.id));
      toast.success(`Form "${deleteTarget.title}" has been removed.`);
    } else {
      toast.error(result.err);
    }
    setIsDeleting(false);
    setDeleteTarget(undefined);
  }

  async function retryForms() {
    setIsLoading(true);
    try {
      const data = await apiGetForms(user);
      setForms(data);
      setLoadError(false);
    } catch {
      setLoadError(true);
      toast.error("Forms could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const visibleForms = filtered.slice(0, visibleCount);
  const hasMoreForms = filtered.length > visibleCount;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6" data-ocid="forms.page">
        {actingScope ? (
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
            {actingScope}
          </div>
        ) : null}
        <div className="flex justify-end">
          <LiveSyncBadge eventNames={[]} />
        </div>
        <div className="glass-card rounded-xl p-5 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
                <FolderOpen className="h-6 w-6 text-primary" />
                Forms Library
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                View or download official forms.
              </p>
            </div>

              <div className="flex flex-col sm:flex-row gap-3 lg:min-w-[520px]">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search forms..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  data-ocid="forms.search_input"
                  />
                </div>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="sm:w-[180px]">
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
                  <SelectTrigger className="sm:w-[180px]">
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
                {canAdmin && (
                  <Button
                  type="button"
                  className="gap-2"
                  onClick={() => {
                    setEditingForm(undefined);
                    setDialogOpen(true);
                  }}
                  data-ocid="forms.add_button"
                >
                  <Plus className="h-4 w-4" />
                  New Form
                </Button>
              )}
            </div>
          </div>

          {loadError && forms.length === 0 ? (
            <RetryPanel
              title="Forms failed to load"
              description="Retry this section without leaving the Forms Centre."
              onRetry={() => void retryForms()}
              icon={<FileText className="h-4 w-4 text-primary" />}
            />
          ) : isLoading ? (
            <div
              className="grid md:grid-cols-2 gap-3"
              data-ocid="forms.loading_state"
            >
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <SkeletonCard key={item} lines={2} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-7 w-7" />}
              title="No forms match your search"
              description="Try a different title or clear the current search text."
              actionLabel={canAdmin ? "New Form" : undefined}
              onAction={
                canAdmin
                  ? () => {
                      setEditingForm(undefined);
                      setDialogOpen(true);
                    }
                  : undefined
              }
              data-ocid="forms.empty_state"
            />
          ) : (
            <div className="space-y-4">
              {loadError ? (
                <RetryPanel
                  title="Using saved forms"
                  description="The latest refresh failed, but your cached forms are still available."
                  onRetry={() => void retryForms()}
                  icon={<FileText className="h-4 w-4 text-primary" />}
                />
              ) : null}
              <div className="grid md:grid-cols-2 gap-3">
                {visibleForms.map((form, index) => (
                  <FormCard
                    key={form.id}
                    form={form}
                    canManage={userCanManageScopedItem(user, form, "forms")}
                    onEdit={(item) => {
                      setEditingForm(item);
                      setDialogOpen(true);
                  }}
                  onDelete={setDeleteTarget}
                  index={index + 1}
                />
              ))}
              </div>
              {hasMoreForms ? (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setVisibleCount((current) => current + FORMS_PAGE_SIZE)
                    }
                  >
                    Load more forms
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <FormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingForm(undefined);
        }}
        initial={editingForm}
        onSave={handleSave}
        isSaving={isSaving}
        currentUser={user ?? null}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title="Remove Form?"
        description={`You are about to permanently remove "${deleteTarget?.title}". This action cannot be undone.`}
        confirmLabel={isDeleting ? "Deleting..." : "Yes, Delete it"}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </AppShell>
  );
}

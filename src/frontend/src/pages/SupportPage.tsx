import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LiveSyncBadge } from "@/components/LiveSyncBadge";
import { RetryPanel } from "@/components/RetryPanel";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  apiGetMyAmendments,
  apiGetMyIncidents,
  apiSubmitIncidentReport,
  apiSubmitProfileAmendment,
} from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import { BRANCHES } from "@/types";
import type { IncidentReport, ProfileAmendment } from "@/types";
import { useLocation } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Headphones,
  SendHorizonal,
  TriangleAlert,
  UserCog,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const SUPPORT_PAGE_SIZE = 5;

const ISSUE_CATEGORIES = [
  "Temenos 24",
  "NETWORK",
  "NCOMPUTING",
  "REMITTANCE",
  "E-ZWICH",
  "NIA",
  "PRINTER",
  "UPS",
  "CCTV",
  "SYSTEM ADMINISTRATION",
  "COMPUTERS AND PERIPHERALS",
  "EMAIL/WEBSITE",
] as const;

const REQUEST_TYPES = [
  "T24 PASSWORD RESET",
  "T24 TOO MANY ATTEMPTS RESET",
  "ROLE CHANGE",
  "DEPARTMENTAL CHANGE",
  "TRANSFER OF PROFILE",
  "STAFF REDESIGNATION",
] as const;

const DEPARTMENTAL_CHANGES = [
  "LOAN INPUTTER TO AUTHORIZER",
  "LOAN AUTHORIZER TO INPUTTER",
  "FD INPUTTER TO AUTHORIZER",
  "FD AUTHORIZER TO INPUTTER",
] as const;

const TRANSFER_LOCATIONS = [
  "ADEISO AGENCY",
  "BAWJIASE AGENCY",
  "HEAD OFFICE",
  "OFAAKOR",
  "KASOA MARKET",
  "KASOA NEW MARKET",
] as const;

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "control-sharp border-input dark:bg-input/30 h-10 w-full border bg-card px-4 text-sm outline-none transition-smooth focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
        invalid && "border-destructive",
      )}
    />
  );
}

function SelectInput({
  id,
  value,
  onChange,
  placeholder,
  options,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: readonly string[];
  invalid?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "control-sharp border-input dark:bg-input/30 h-10 w-full border bg-card px-4 text-sm outline-none transition-smooth focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
        invalid && "border-destructive",
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className =
    normalized === "resolved" || normalized === "approved"
      ? "border-green-500/30 bg-green-500/15 text-green-600 dark:text-green-400"
      : normalized === "rejected"
        ? "border-destructive/30 bg-destructive/15 text-destructive"
        : "border-yellow-500/30 bg-yellow-500/15 text-yellow-600 dark:text-yellow-400";

  return (
    <Badge variant="outline" className={className}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function MissingDetailsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card-elevated max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/15 text-yellow-600 dark:text-yellow-400">
          <TriangleAlert className="h-10 w-10" />
        </div>
        <DialogTitle className="font-display text-xl font-bold">
          Details Missing
        </DialogTitle>
        <DialogDescription>
          Kindly complete all required fields before submitting so we can assist
          you properly.
        </DialogDescription>
        <Button
          type="button"
          variant="secondary"
          className="mx-auto mt-2 px-8 font-bold"
          onClick={() => onOpenChange(false)}
        >
          Review Form
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function SuccessDialog({
  open,
  onOpenChange,
  message,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card-elevated max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20 text-secondary">
          <CheckCircle className="h-10 w-10" />
        </div>
        <DialogTitle className="font-display text-xl font-bold">
          Request Submitted!
        </DialogTitle>
        <DialogDescription>{message}</DialogDescription>
        <Button
          type="button"
          className="mx-auto mt-2 px-8 font-bold"
          onClick={() => onOpenChange(false)}
        >
          Okay, Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}

interface IncidentFormState {
  agency: string;
  issueCategory: string;
  description: string;
  reporterName: string;
  contact: string;
}

function IncidentForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState<IncidentFormState>({
    agency: user?.branch ?? "",
    issueCategory: "",
    description: "",
    reporterName: user?.fullname ?? "",
    contact: user?.phone ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const set = (key: keyof IncidentFormState) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const isValid =
      form.agency &&
      form.issueCategory &&
      form.description.trim() &&
      form.reporterName.trim() &&
      form.contact.trim();

    if (!isValid) {
      setShowMissing(true);
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiSubmitIncidentReport(
        {
          agency: form.agency,
          issueCategory: form.issueCategory,
          description: form.description,
          reporterName: form.reporterName,
          contact: form.contact,
        },
        user?.id ?? "",
      );

      if ("err" in result) {
        toast.error(result.err);
        return;
      }

      setShowSuccess(true);
      setForm({
        agency: user?.branch ?? "",
        issueCategory: "",
        description: "",
        reporterName: user?.fullname ?? "",
        contact: user?.phone ?? "",
      });
      setTouched(false);
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
        data-ocid="incident.form"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Agency">
            <SelectInput
              id="incident-agency"
              value={form.agency}
              onChange={set("agency")}
              placeholder="Select Agency..."
              options={BRANCHES}
              invalid={touched && !form.agency}
            />
          </Field>
          <Field label="Issue Category">
            <SelectInput
              id="incident-issue"
              value={form.issueCategory}
              onChange={set("issueCategory")}
              placeholder="Select Issue..."
              options={ISSUE_CATEGORIES}
              invalid={touched && !form.issueCategory}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description of Issue">
              <Textarea
                value={form.description}
                onChange={(e) => set("description")(e.target.value)}
                placeholder="Describe the problem in detail..."
                rows={4}
                className={`resize-none bg-card ${
                  touched && !form.description.trim()
                    ? "border-destructive"
                    : ""
                }`}
              />
            </Field>
          </div>
          <Field label="Reporting Officer">
            <TextInput
              id="incident-reporter"
              value={form.reporterName}
              onChange={set("reporterName")}
              invalid={touched && !form.reporterName.trim()}
            />
          </Field>
          <Field label="Contact / Ext">
            <TextInput
              id="incident-contact"
              value={form.contact}
              onChange={set("contact")}
              placeholder="Phone or Extension"
              invalid={touched && !form.contact.trim()}
            />
          </Field>
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="h-11 w-full gap-2 rounded-full font-bold"
        >
          <SendHorizonal className="h-4 w-4" />
          {submitting ? "Submitting..." : "Submit Incident Report"}
        </Button>
      </form>
      <MissingDetailsDialog open={showMissing} onOpenChange={setShowMissing} />
      <SuccessDialog
        open={showSuccess}
        onOpenChange={setShowSuccess}
        message="The IT Department has received your incident report."
      />
    </>
  );
}

interface AmendmentFormState {
  fullname: string;
  phone: string;
  t24Username: string;
  agency: string;
  requestType: string;
  newRole: string;
  deptChange: string;
  transferLocation: string;
  additionalDetails: string;
}

function AmendmentForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState<AmendmentFormState>({
    fullname: user?.fullname ?? "",
    phone: user?.phone ?? "",
    t24Username: "",
    agency: user?.branch ?? "",
    requestType: "",
    newRole: "",
    deptChange: "",
    transferLocation: "",
    additionalDetails: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const set = (key: keyof AmendmentFormState) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const needsRole = form.requestType === "ROLE CHANGE";
    const needsDepartment = form.requestType === "DEPARTMENTAL CHANGE";
    const needsTransfer = form.requestType === "TRANSFER OF PROFILE";
    const isValid =
      form.fullname.trim() &&
      form.phone.trim() &&
      form.t24Username.trim() &&
      form.agency &&
      form.requestType &&
      (!needsRole || form.newRole.trim()) &&
      (!needsDepartment || form.deptChange) &&
      (!needsTransfer || form.transferLocation);

    if (!isValid) {
      setShowMissing(true);
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiSubmitProfileAmendment(
        {
          fullname: form.fullname,
          phone: form.phone,
          t24Username: form.t24Username,
          agency: form.agency,
          requestType: form.requestType,
          newRole: form.newRole || undefined,
          deptChange: form.deptChange || undefined,
          transferLocation: form.transferLocation || undefined,
          additionalDetails: form.additionalDetails || undefined,
        },
        user?.id ?? "",
        user?.fullname ?? "",
      );

      if ("err" in result) {
        toast.error(result.err);
        return;
      }

      setShowSuccess(true);
      setForm({
        fullname: user?.fullname ?? "",
        phone: user?.phone ?? "",
        t24Username: "",
        agency: user?.branch ?? "",
        requestType: "",
        newRole: "",
        deptChange: "",
        transferLocation: "",
        additionalDetails: "",
      });
      setTouched(false);
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
        data-ocid="amendment.form"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Name">
            <TextInput
              id="amendment-name"
              value={form.fullname}
              onChange={set("fullname")}
              invalid={touched && !form.fullname.trim()}
            />
          </Field>
          <Field label="Phone Number">
            <TextInput
              id="amendment-phone"
              value={form.phone}
              onChange={set("phone")}
              placeholder="Enter your mobile number"
              invalid={touched && !form.phone.trim()}
            />
          </Field>
          <Field label="T24 Username">
            <TextInput
              id="amendment-t24"
              value={form.t24Username}
              onChange={set("t24Username")}
              placeholder="e.g. B01.JOHN"
              invalid={touched && !form.t24Username.trim()}
            />
          </Field>
          <Field label="Agency">
            <SelectInput
              id="amendment-agency"
              value={form.agency}
              onChange={set("agency")}
              placeholder="Select Agency..."
              options={BRANCHES}
              invalid={touched && !form.agency}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Type of Request">
              <SelectInput
                id="amendment-request-type"
                value={form.requestType}
                onChange={set("requestType")}
                placeholder="Select Request..."
                options={REQUEST_TYPES}
                invalid={touched && !form.requestType}
              />
            </Field>
          </div>

          {form.requestType === "ROLE CHANGE" && (
            <div className="rounded-xl border bg-muted/20 p-4 md:col-span-2">
              <Field label="If Role Change, what is the new role?">
                <TextInput
                  id="amendment-new-role"
                  value={form.newRole}
                  onChange={set("newRole")}
                  placeholder="Enter new role here..."
                  invalid={touched && !form.newRole.trim()}
                />
              </Field>
            </div>
          )}

          {form.requestType === "DEPARTMENTAL CHANGE" && (
            <div className="rounded-xl border bg-muted/20 p-4 md:col-span-2">
              <Field label="If Departmental Change, Indicate:">
                <SelectInput
                  id="amendment-department-change"
                  value={form.deptChange}
                  onChange={set("deptChange")}
                  placeholder="Select Change..."
                  options={DEPARTMENTAL_CHANGES}
                  invalid={touched && !form.deptChange}
                />
              </Field>
            </div>
          )}

          {form.requestType === "TRANSFER OF PROFILE" && (
            <div className="rounded-xl border bg-muted/20 p-4 md:col-span-2">
              <Field label="If Transfer of Profile, where are you transferring to?">
                <SelectInput
                  id="amendment-transfer-location"
                  value={form.transferLocation}
                  onChange={set("transferLocation")}
                  placeholder="Select Destination..."
                  options={TRANSFER_LOCATIONS}
                  invalid={touched && !form.transferLocation}
                />
              </Field>
            </div>
          )}

          <div className="md:col-span-2">
            <Field label="Additional Details">
              <Textarea
                value={form.additionalDetails}
                onChange={(e) => set("additionalDetails")(e.target.value)}
                placeholder="Any additional context or justification..."
                rows={3}
                className="resize-none rounded-xl bg-card"
              />
            </Field>
          </div>
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="h-11 w-full gap-2 rounded-full font-bold"
        >
          <CheckCircle className="h-4 w-4" />
          {submitting ? "Submitting..." : "Submit Amendment Request"}
        </Button>
      </form>
      <MissingDetailsDialog open={showMissing} onOpenChange={setShowMissing} />
      <SuccessDialog
        open={showSuccess}
        onOpenChange={setShowSuccess}
        message="The IT Department has received your amendment request."
      />
    </>
  );
}

function RecentIncidents({ refreshKey }: { refreshKey: number }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(SUPPORT_PAGE_SIZE);

  useEffect(() => {
    if (!user) return;
    void refreshKey;
    let cancelled = false;
    setLoading(true);
    apiGetMyIncidents(user.id)
      .then((data) => {
        if (!cancelled) {
          setIncidents(data);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIncidents([]);
          setLoadError(true);
          toast.error("Recent incident reports could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  useEffect(() => {
    setVisibleCount(SUPPORT_PAGE_SIZE);
  }, [incidents.length]);

  if (loading) return <SkeletonCard lines={3} />;
  if (loadError && incidents.length === 0) {
    return (
      <RetryPanel
        title="Incident reports failed to load"
        description="Retry your recent reports without leaving this page."
        onRetry={() => window.location.reload()}
        icon={<AlertCircle className="h-4 w-4 text-primary" />}
      />
    );
  }
  if (!incidents.length) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-8 w-8" />}
        title="No incident reports yet"
        description="Your submitted incident reports will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {loadError ? (
        <RetryPanel
          title="Using saved incident reports"
          description="The latest refresh failed, but your recent reports are still visible."
          onRetry={() => window.location.reload()}
          icon={<AlertCircle className="h-4 w-4 text-primary" />}
        />
      ) : null}
      {incidents.slice(0, visibleCount).map((incident) => (
        <div key={incident.id} className="glass-card panel-sharp p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {incident.subject}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {incident.description}
              </p>
            </div>
            <StatusBadge status={incident.status} />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {new Date(Number(incident.createdAt)).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      ))}
      {incidents.length > visibleCount ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setVisibleCount((current) => current + SUPPORT_PAGE_SIZE)
            }
          >
            Load more reports
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RecentAmendments({ refreshKey }: { refreshKey: number }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [amendments, setAmendments] = useState<ProfileAmendment[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(SUPPORT_PAGE_SIZE);

  useEffect(() => {
    if (!user) return;
    void refreshKey;
    let cancelled = false;
    setLoading(true);
    apiGetMyAmendments(user.id)
      .then((data) => {
        if (!cancelled) {
          setAmendments(data);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAmendments([]);
          setLoadError(true);
          toast.error("Recent amendment requests could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  useEffect(() => {
    setVisibleCount(SUPPORT_PAGE_SIZE);
  }, [amendments.length]);

  if (loading) return <SkeletonCard lines={3} />;
  if (loadError && amendments.length === 0) {
    return (
      <RetryPanel
        title="Amendment requests failed to load"
        description="Retry your recent T24 requests without leaving this page."
        onRetry={() => window.location.reload()}
        icon={<AlertCircle className="h-4 w-4 text-primary" />}
      />
    );
  }
  if (!amendments.length) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-8 w-8" />}
        title="No amendment requests yet"
        description="Your submitted T24 amendment requests will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {loadError ? (
        <RetryPanel
          title="Using saved amendment requests"
          description="The latest refresh failed, but your recent requests are still visible."
          onRetry={() => window.location.reload()}
          icon={<AlertCircle className="h-4 w-4 text-primary" />}
        />
      ) : null}
      {amendments.slice(0, visibleCount).map((amendment) => (
        <div key={amendment.id} className="glass-card panel-sharp p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {amendment.field}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {amendment.reason}
              </p>
            </div>
            <StatusBadge status={amendment.status} />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {new Date(Number(amendment.createdAt)).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      ))}
      {amendments.length > visibleCount ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setVisibleCount((current) => current + SUPPORT_PAGE_SIZE)
            }
          >
            Load more requests
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function SupportPage() {
  const location = useLocation();
  const [incRefresh, setIncRefresh] = useState(0);
  const [amRefresh, setAmRefresh] = useState(0);
  const defaultTab = location.pathname.includes("/amendment")
    ? "amendment"
    : "incident";

  return (
    <AppShell>
      <div className="page-shell-compact" data-ocid="support.page">
        <section className="page-header">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="page-kicker">Service desk</div>
              <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-primary/20 bg-primary/15">
              <Headphones className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                IT Support
              </h1>
              <p className="text-sm text-muted-foreground">
                Report incidents or request T24 profile amendments
              </p>
            </div>
              </div>
              <p className="page-subtitle mt-4 max-w-2xl">
                Submit operational issues quickly, track your requests, and keep amendment history visible without leaving the page.
              </p>
          </div>
            <div className="page-actions">
              <LiveSyncBadge eventNames={[]} />
            </div>
          </div>
        </section>

        <Tabs
          key={defaultTab}
          defaultValue={defaultTab}
          data-ocid="support.tabs"
        >
          <TabsList className="glass-card panel-sharp h-auto w-full justify-start p-1">
            <TabsTrigger value="incident" data-ocid="support.incident.tab">
              <TriangleAlert className="mr-2 h-4 w-4" />
              Report Incident
            </TabsTrigger>
            <TabsTrigger value="amendment" data-ocid="support.amendment.tab">
              <UserCog className="mr-2 h-4 w-4" />
              T24 Amendment
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incident" className="space-y-6 mt-4">
            <div className="glass-card-elevated panel-sharp p-6">
              <h2 className="text-base font-semibold text-foreground mb-4">
                Submit an Incident Report
              </h2>
              <IncidentForm onSubmitted={() => setIncRefresh((n) => n + 1)} />
            </div>

            <Separator className="opacity-30" />

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                My Recent Reports
              </h3>
              <RecentIncidents refreshKey={incRefresh} />
            </div>
          </TabsContent>

          <TabsContent value="amendment" className="space-y-6 mt-4">
            <div className="glass-card-elevated panel-sharp p-6">
              <h2 className="text-base font-semibold text-foreground mb-4">
                Request a T24 Amendment
              </h2>
              <AmendmentForm onSubmitted={() => setAmRefresh((n) => n + 1)} />
            </div>

            <Separator className="opacity-30" />

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                My Recent T24 Requests
              </h3>
              <RecentAmendments refreshKey={amRefresh} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

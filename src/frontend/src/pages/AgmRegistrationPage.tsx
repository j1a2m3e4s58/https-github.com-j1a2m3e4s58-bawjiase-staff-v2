import { Layout } from "@/components/Layout";
import { AgmYearSwitcher } from "@/components/AgmYearSwitcher";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Input } from "@/components/ui/input";
import { useAgmYear } from "@/context/AgmYearContext";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/hooks/use-auth";
import {
  useAllCheckIns,
  useAllRegistrations,
  useAllShareholders,
  useYearRegistry,
} from "@/hooks/use-backend";
import {
  buildYearScopedShareholders,
  filterCheckInsByRegistrations,
  filterRegistrationsByYear,
} from "@/lib/agm-year";
import { cn } from "@/lib/utils";
import { RegistrationType, ShareholderStatus, UserRole } from "@/types";
import type { Registration, Shareholder } from "@/types";
import { Search, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CancelRegistrationModal } from "./registration/CancelRegistrationModal";
import { ExistingRegistration } from "./registration/ExistingRegistration";
import { InPersonForm } from "./registration/InPersonForm";
import { ProxyForm } from "./registration/ProxyForm";
import { SuccessCard } from "./registration/SuccessCard";

const REGISTRATION_PAGE_LIMIT = 500;

function useDebounce<T>(value: T, delay = 0): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function ShareholderRow({
  shareholder,
  selected,
  onSelect,
  index,
  canRegister,
  keepVisible,
}: {
  shareholder: Shareholder;
  selected: boolean;
  onSelect: () => void;
  index: number;
  canRegister: boolean;
  keepVisible?: boolean;
}) {
  return (
    <div
      data-ocid={`registration.shareholder_row.${index}`}
      className={cn(
        "w-full px-4 py-3 border-b border-border last:border-b-0 flex items-start gap-3",
        selected
          ? "bg-primary/20 border-l-2 border-l-primary"
          : "hover:bg-muted/30",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground truncate">
          {shareholder.fullName}
        </div>
        <div className="text-sm text-muted-foreground">
          # {shareholder.shareholderNumber}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {Number(shareholder.shareholding).toLocaleString()} shares
        </div>
        {keepVisible && (
          <div className="mt-1 text-[11px] font-medium text-primary">
            Completing current registration...
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <StatusBadge status={shareholder.status} size="sm" />
        <button
          type="button"
          onClick={onSelect}
          disabled={!canRegister}
          className={cn(
            "min-h-[40px] px-3 text-xs sm:text-sm font-medium border",
            canRegister
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              : "bg-muted text-muted-foreground border-border cursor-not-allowed",
          )}
          data-ocid={`registration.shareholder_row.${index}.register_button`}
        >
          {canRegister ? "Register" : "View"}
        </button>
      </div>
    </div>
  );
}

export default function RegistrationPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Shareholder | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDialogOpen, setMobileDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<RegistrationType>(
    RegistrationType.InPerson,
  );
  const [successReg, setSuccessReg] = useState<Registration | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [lockedShareholderId, setLockedShareholderId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { activeYear } = useAgmYear();
  const { data: yearRegistry = [] } = useYearRegistry();

  const debouncedQuery = useDebounce(query);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const canEdit =
    user?.role === UserRole.SuperAdmin ||
    user?.role === UserRole.Admin ||
    user?.role === UserRole.RegistrationOfficer;
  const activeYearRecord = yearRegistry.find((record) => record.year === activeYear);
  const registrationBlocked =
    activeYearRecord?.isArchived || activeYearRecord?.isLocked;

  const { data: allShareholders = [], isLoading: searchLoading } =
    useAllShareholders();
  const { data: allRegistrations = [] } = useAllRegistrations();
  const { data: allCheckIns = [] } = useAllCheckIns();

  const registrationsForYear = filterRegistrationsByYear(
    allRegistrations,
    activeYear,
  );
  const checkInsForYear = filterCheckInsByRegistrations(
    allCheckIns,
    registrationsForYear,
  );
  const scopedShareholders = buildYearScopedShareholders(
    allShareholders,
    registrationsForYear,
    checkInsForYear,
  );
  const existingReg = selected
    ? registrationsForYear.find((item) => item.shareholderId === selected.id) ?? null
    : null;

  const normalizedQuery = debouncedQuery.trim().toLowerCase();

  const filteredShareholders = scopedShareholders
    .filter((s) => s.status === ShareholderStatus.NotRegistered || s.id === lockedShareholderId)
    .filter((s) => {
      if (!normalizedQuery) return true;
      return (
        s.fullName.toLowerCase().includes(normalizedQuery) ||
        s.shareholderNumber.toLowerCase().includes(normalizedQuery) ||
        s.idNumber.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((left, right) => left.fullName.localeCompare(right.fullName));

  const totalMatches = filteredShareholders.length;
  const shareholders = filteredShareholders.slice(0, REGISTRATION_PAGE_LIMIT);

  const handleSelectShareholder = useCallback(
    (s: Shareholder) => {
      setSelected(s);
      setLockedShareholderId(s.id);
      setSuccessReg(null);
      setActiveTab(RegistrationType.InPerson);
      if (isMobile) {
        setMobileDialogOpen(true);
      }
    },
    [isMobile],
  );

  const handleRegistrationSuccess = useCallback(
    (reg: Registration) => {
      setSuccessReg(reg);
    },
    [],
  );

  const handleRegisterAnother = useCallback(() => {
    setSelected(null);
    setLockedShareholderId(null);
    setMobileDialogOpen(false);
    setSuccessReg(null);
    setQuery("");
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const handleMobileDialogChange = useCallback((open: boolean) => {
    setMobileDialogOpen(open);
    if (!open) {
      setSelected(null);
      setSuccessReg(null);
      setShowCancelModal(false);
    }
  }, []);

  const registrationPanel = !selected ? (
    <div
      className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6"
      data-ocid="registration.right_panel.empty_state"
    >
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
        <Users className="w-8 h-8 text-primary/60" />
      </div>
      <h3 className="font-display text-xl font-semibold text-foreground mb-2">
        Select a Shareholder
      </h3>
      <p className="text-muted-foreground max-w-xs">
        Search and select a shareholder on the left to begin registration for AGM {activeYear}.
      </p>
    </div>
  ) : successReg ? (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <SuccessCard
        registration={successReg}
        shareholder={selected}
        onRegisterAnother={handleRegisterAnother}
      />
    </div>
  ) : existingReg ? (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <ExistingRegistration
        registration={existingReg}
        shareholder={selected}
        canEdit={canEdit}
        onCancelClick={() => setShowCancelModal(true)}
        onEditSuccess={(reg) => {
          showToast("Registration updated", "success");
          setSuccessReg(reg);
        }}
      />
    </div>
  ) : (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              {selected.fullName}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              # {selected.shareholderNumber} •{" "}
              {Number(selected.shareholding).toLocaleString()} shares
            </p>
          </div>
          <StatusBadge status={selected.status} />
        </div>
      </div>

      <div
        className="flex border border-border bg-muted/40 p-1 mb-6 gap-1"
        data-ocid="registration.type_tab"
      >
        {[
          { value: RegistrationType.InPerson, label: "In Person" },
          { value: RegistrationType.Proxy, label: "Proxy" },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            data-ocid={`registration.tab.${tab.value.toLowerCase()}`}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "flex-1 py-2 px-4 text-sm font-medium min-h-[44px]",
              activeTab === tab.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === RegistrationType.InPerson ? (
        <InPersonForm
          shareholder={selected}
          onSuccess={handleRegistrationSuccess}
        />
      ) : (
        <ProxyForm shareholder={selected} onSuccess={handleRegistrationSuccess} />
      )}
    </div>
  );

  return (
    <Layout>
      <div
        data-ocid="registration.page"
        className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] overflow-hidden"
      >
        <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-border bg-card">
          <div className="p-4 border-b border-border">
            <div className="mb-3 flex flex-col gap-3">
              <div>
                <h2 className="font-display font-semibold text-lg text-foreground">
                  Find Shareholder
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Registration list for AGM year {activeYear}
                </p>
              </div>
              <AgmYearSwitcher compact />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                data-ocid="registration.search_input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, shareholder #, or ID..."
                className="pl-9 pr-9 h-11 text-base bg-muted/40 border-input focus:bg-background"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {!searchLoading && (
              <p className="text-xs text-muted-foreground mt-2">
                Showing {shareholders.length.toLocaleString()} of{" "}
                {totalMatches.toLocaleString()} result
                {totalMatches !== 1 ? "s" : ""}. Search still covers all names.
              </p>
            )}
          </div>

          <div
            className="flex-1 overflow-y-auto"
            data-ocid="registration.shareholder_list"
          >
            {searchLoading ? (
              <LoadingSpinner label="Loading shareholders" className="px-4" />
            ) : shareholders.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-48 text-center px-6"
                data-ocid="registration.empty_state"
              >
                <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {query
                    ? "No shareholders match your search"
                    : "Type to search shareholders"}
                </p>
              </div>
            ) : (
              shareholders.map((s, idx) => (
                <ShareholderRow
                  key={s.id}
                  shareholder={s}
                  selected={selected?.id === s.id}
                  onSelect={() => handleSelectShareholder(s)}
                  index={idx + 1}
                  canRegister={canEdit && !registrationBlocked}
                  keepVisible={lockedShareholderId === s.id && successReg === null}
                />
              ))
            )}
          </div>
          {registrationBlocked && (
            <div className="border-t border-border px-4 py-3 text-xs text-amber-300 bg-amber-500/10">
              AGM {activeYear} is {activeYearRecord?.isArchived ? "archived" : "locked"}.
              Registration is disabled until an administrator reopens the year.
            </div>
          )}
        </div>

        <div className="hidden lg:block flex-1 overflow-y-auto bg-background">
          {!selected ? (
            <div
              className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6"
              data-ocid="registration.right_panel.empty_state"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-primary/60" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                Select a Shareholder
              </h3>
              <p className="text-muted-foreground max-w-xs">
                Search and select a shareholder on the left to begin
                registration.
              </p>
            </div>
          ) : successReg ? (
            <div className="p-6 max-w-xl mx-auto">
              <SuccessCard
                registration={successReg}
                shareholder={selected}
                onRegisterAnother={handleRegisterAnother}
              />
            </div>
          ) : existingReg ? (
            <div className="p-6 max-w-xl mx-auto">
              <ExistingRegistration
                registration={existingReg}
                shareholder={selected}
                canEdit={canEdit}
                onCancelClick={() => setShowCancelModal(true)}
                onEditSuccess={(reg) => {
                  showToast("Registration updated", "success");
                  setSuccessReg(reg);
                }}
              />
            </div>
          ) : (
            <div className="p-6 max-w-xl mx-auto">
              <div className="mb-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-bold text-foreground">
                      {selected.fullName}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      # {selected.shareholderNumber} •{" "}
                      {Number(selected.shareholding).toLocaleString()} shares
                    </p>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>
              </div>

              <div
                className="flex border border-border bg-muted/40 p-1 mb-6 gap-1"
                data-ocid="registration.type_tab"
              >
                {[
                  { value: RegistrationType.InPerson, label: "In Person" },
                  { value: RegistrationType.Proxy, label: "Proxy" },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    data-ocid={`registration.tab.${tab.value.toLowerCase()}`}
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      "flex-1 py-2 px-4 text-sm font-medium min-h-[44px]",
                      activeTab === tab.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === RegistrationType.InPerson ? (
                <InPersonForm
                  shareholder={selected}
                  onSuccess={handleRegistrationSuccess}
                />
              ) : (
                <ProxyForm
                  shareholder={selected}
                  onSuccess={handleRegistrationSuccess}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {isMobile && mobileDialogOpen && selected && (
        <div
          className="fixed inset-0 z-50 lg:hidden overflow-hidden"
          data-ocid="registration.mobile.dialog"
        >
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => handleMobileDialogChange(false)}
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-2 top-2 bottom-2 flex flex-col border border-border bg-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
              <h2 className="font-display text-base font-semibold text-foreground">
                Register Shareholder
              </h2>
              <button
                type="button"
                onClick={() => handleMobileDialogChange(false)}
                className="min-h-[40px] min-w-[40px] border border-border bg-background text-muted-foreground"
                aria-label="Close registration dialog"
                data-ocid="registration.mobile.dialog.close_button"
              >
                <X className="w-4 h-4 mx-auto" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background [touch-action:pan-y] [webkit-overflow-scrolling:touch]">
              {registrationPanel}
            </div>
          </div>
        </div>
      )}

      {showCancelModal && selected && existingReg && (
        <CancelRegistrationModal
          registration={existingReg}
          shareholder={selected}
          onClose={() => setShowCancelModal(false)}
          onSuccess={() => {
            setShowCancelModal(false);
            setSelected(null);
            setLockedShareholderId(null);
            setSuccessReg(null);
            showToast("Registration cancelled", "success");
          }}
        />
      )}
    </Layout>
  );
}

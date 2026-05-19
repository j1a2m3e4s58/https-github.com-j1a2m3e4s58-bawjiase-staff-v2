import { AgmLayout } from "@/components/AgmLayout";
import { PortalCard } from "@/components/PortalCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgmYear } from "@/context/AgmYearContext";
import {
  AGM_UPDATED_EVENT,
  apiCheckInAgmShareholder,
  apiGetAgmShareholders,
} from "@/lib/backend-client";
import { type AgmShareholderRecord } from "@/lib/agm-module";
import { CheckCircle2, ScanLine, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function QueueItem({
  shareholder,
  selected,
  onSelect,
}: {
  shareholder: AgmShareholderRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full border-b border-border/30 px-4 py-3 text-left transition-smooth last:border-b-0 ${
        selected ? "bg-primary/15 border-l-2 border-l-primary" : "hover:bg-muted/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{shareholder.fullName}</div>
          <div className="text-sm text-muted-foreground">
            #{shareholder.shareholderNumber}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {shareholder.branch} • {shareholder.registrationType}
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          Awaiting Entry
        </Badge>
      </div>
    </button>
  );
}

export default function AgmCheckInPage() {
  const { activeYear } = useAgmYear();
  const [query, setQuery] = useState("");
  const [shareholders, setShareholders] = useState<AgmShareholderRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  useEffect(() => {
    const load = () => {
      void apiGetAgmShareholders().then((records) =>
        setShareholders(
          records.filter(
            (record) =>
              record.registrationType !== "Not Registered" && !record.checkedInAt,
          ),
        ),
      );
    };
    load();
    window.addEventListener(AGM_UPDATED_EVENT, load);
    return () => window.removeEventListener(AGM_UPDATED_EVENT, load);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return shareholders;
    return shareholders.filter((item) =>
      [item.fullName, item.shareholderNumber, item.branch, item.verificationCode]
        .some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [query, shareholders]);

  useEffect(() => {
    if (!filtered.find((item) => item.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  async function handleCheckIn() {
    if (!selected) return;
    setIsCheckingIn(true);
    try {
      const updated = await apiCheckInAgmShareholder({
        shareholderId: selected.id,
        operatorName: "AGM Check-In Desk",
        method: "quick",
      });
      setShareholders((current) => current.filter((item) => item.id !== updated.id));
      toast.success(`${updated.fullName} checked in successfully.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The AGM check-in could not be completed.",
      );
    } finally {
      setIsCheckingIn(false);
    }
  }

  return (
    <AgmLayout>
      <div className="page-shell space-y-6" data-ocid="agm.checkin.page">
        <section className="hero-panel">
          <div className="hero-panel__content">
            <div className="page-kicker">Check-In Desk</div>
            <div className="space-y-4">
              <h1 className="text-4xl font-display font-bold text-foreground sm:text-5xl">
                AGM {activeYear} Check-In
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Confirm arrivals after registration and keep live attendance numbers
                moving inside the same AGM workspace.
              </p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="metric-card min-h-[132px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Awaiting Check-In
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {filtered.length}
            </div>
          </div>
          <div className="metric-card min-h-[132px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              AGM Year
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {activeYear}
            </div>
          </div>
          <div className="metric-card min-h-[132px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Desk Mode
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              Live
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.08fr]">
          <PortalCard
            elevated
            title="Registered Queue"
            subtitle="Shareholders who are registered and waiting to be checked into the AGM floor."
            data-ocid="agm.checkin.queue.card"
          >
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, member number, branch, or code"
                  className="h-12 pl-10"
                />
              </div>
              <div className="panel-sharp overflow-hidden border border-border/40 bg-muted/20">
                {filtered.length === 0 ? (
                  <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="font-display text-lg font-semibold text-foreground">
                      No one is waiting
                    </div>
                    <div className="max-w-sm text-sm text-muted-foreground">
                      Everyone currently registered has either been checked in already or there
                      are no matching results for this search.
                    </div>
                  </div>
                ) : (
                  filtered.map((shareholder) => (
                    <QueueItem
                      key={shareholder.id}
                      shareholder={shareholder}
                      selected={selected?.id === shareholder.id}
                      onSelect={() => setSelectedId(shareholder.id)}
                    />
                  ))
                )}
              </div>
            </div>
          </PortalCard>

          <PortalCard
            elevated
            title="Entry Confirmation"
            subtitle="Review the selected registration record and confirm entry."
            data-ocid="agm.checkin.confirm.card"
          >
            {selected ? (
              <div className="space-y-5">
                <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-foreground">{selected.fullName}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        #{selected.shareholderNumber} • {selected.branch}
                      </div>
                    </div>
                    <Badge>{selected.registrationType}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="panel-sharp border border-border/40 bg-background/60 p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Verification Code
                    </div>
                    <div className="mt-3 font-display text-2xl font-bold text-foreground">
                      {selected.verificationCode || "Pending"}
                    </div>
                  </div>
                  <div className="panel-sharp border border-border/40 bg-background/60 p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Contact
                    </div>
                    <div className="mt-3 text-sm text-foreground">
                      {selected.phone || "No phone captured"}
                    </div>
                  </div>
                </div>

                <div className="panel-sharp border border-primary/25 bg-primary/10 p-4 text-sm text-muted-foreground">
                  This check-in updates the live AGM attendance count, board view,
                  and reports immediately.
                </div>

                <Button
                  className="glass-button h-12 w-full text-sm font-bold uppercase tracking-[0.14em]"
                  onClick={handleCheckIn}
                  disabled={isCheckingIn}
                >
                  {isCheckingIn ? (
                    <>
                      <ScanLine className="mr-2 h-4 w-4 animate-pulse" />
                      Checking In...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirm Check-In
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
                  <ScanLine className="h-5 w-5" />
                </div>
                <div className="font-display text-lg font-semibold text-foreground">
                  Select a registered shareholder
                </div>
                <div className="max-w-sm text-sm text-muted-foreground">
                  Choose someone from the queue to complete AGM entry confirmation.
                </div>
              </div>
            )}
          </PortalCard>
        </div>
      </div>
    </AgmLayout>
  );
}

import { AgmSubnav } from "@/components/AgmSubnav";
import { AppShell } from "@/components/AppShell";
import { PortalCard } from "@/components/PortalCard";
import { useAgmYear } from "@/context/AgmYearContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AGM_UPDATED_EVENT,
  apiGetAgmShareholders,
} from "@/lib/backend-client";
import { type AgmShareholderRecord } from "@/lib/agm-module";
import { Download, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function exportShareholdersCsv(records: AgmShareholderRecord[], activeYear: string) {
  const rows = [
    [
      "Shareholder Number",
      "Full Name",
      "Branch",
      "Shareholding",
      "Registration Type",
      "Verification Code",
      "Registered At",
      "Checked In At",
    ],
    ...records.map((item) => [
      item.shareholderNumber,
      item.fullName,
      item.branch,
      item.shareholding.toString(),
      item.registrationType,
      item.verificationCode,
      item.registeredAt ?? "",
      item.checkedInAt ?? "",
    ]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${value}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agm-shareholders-${activeYear}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AgmShareholdersPage() {
  const { activeYear } = useAgmYear();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "registered" | "pending">("all");
  const [shareholders, setShareholders] = useState<AgmShareholderRecord[]>([]);

  useEffect(() => {
    const load = () => {
      void apiGetAgmShareholders().then(setShareholders);
    };
    load();
    window.addEventListener(AGM_UPDATED_EVENT, load);
    return () => {
      window.removeEventListener(AGM_UPDATED_EVENT, load);
    };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return shareholders.filter((item) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "registered"
            ? item.registrationType !== "Not Registered"
            : item.registrationType === "Not Registered";
      const matchesSearch =
        !normalized ||
        [
          item.fullName,
          item.shareholderNumber,
          item.branch,
          item.phone,
          item.ghanaCardId,
        ].some((value) => value.toLowerCase().includes(normalized));
      return matchesFilter && matchesSearch;
    });
  }, [filter, query, shareholders]);

  const registeredCount = shareholders.filter(
    (record) => record.registrationType !== "Not Registered",
  ).length;

  return (
    <AppShell>
      <div className="page-shell space-y-6" data-ocid="agm.shareholders.page">
        <AgmSubnav />

        <section className="hero-panel">
          <div className="hero-panel__content">
            <div className="page-kicker">Shareholder Register</div>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl space-y-4">
                <h1 className="text-4xl font-display font-bold text-foreground sm:text-5xl">
                  AGM {activeYear} Shareholders
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Search the AGM shareholder register, review registration
                  posture, and inspect member attendance readiness from inside
                  the portal.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-12 px-6 text-sm font-semibold"
                onClick={() => exportShareholdersCsv(shareholders, activeYear)}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Register
              </Button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="metric-card min-h-[140px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total in register
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {shareholders.length.toLocaleString()}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Shareholders currently loaded into the embedded AGM register.
            </div>
          </div>
          <div className="metric-card min-h-[140px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Registered
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {registeredCount.toLocaleString()}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Members with active AGM registrations already captured.
            </div>
          </div>
          <div className="metric-card min-h-[140px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pending
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {(shareholders.length - registeredCount).toLocaleString()}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Members still available for the next registration desk actions.
            </div>
          </div>
        </div>

        <PortalCard
          elevated
          title="AGM Shareholder Register"
          subtitle="Search, filter, and review the current embedded AGM member list."
          data-ocid="agm.shareholders.table.card"
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, member number, branch, phone, or Ghana Card"
                  className="h-12 pl-10"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={filter === "all" ? "default" : "outline"}
                  className="h-12"
                  onClick={() => setFilter("all")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant={filter === "registered" ? "default" : "outline"}
                  className="h-12"
                  onClick={() => setFilter("registered")}
                >
                  Registered
                </Button>
                <Button
                  type="button"
                  variant={filter === "pending" ? "default" : "outline"}
                  className="h-12"
                  onClick={() => setFilter("pending")}
                >
                  Pending
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-3">Shareholder</th>
                    <th className="px-3 py-3">Branch</th>
                    <th className="px-3 py-3">Shares</th>
                    <th className="px-3 py-3">Contact</th>
                    <th className="px-3 py-3">Registration</th>
                    <th className="px-3 py-3">Verification</th>
                    <th className="px-3 py-3">Check-In</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
                            <Users className="h-5 w-5" />
                          </div>
                          <div className="font-display text-lg font-semibold text-foreground">
                            No shareholder records match
                          </div>
                          <div className="max-w-sm text-sm text-muted-foreground">
                            Adjust the search or filter to view shareholder
                            records in the AGM register.
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-border/30 last:border-b-0 hover:bg-muted/20"
                      >
                        <td className="px-3 py-3">
                          <div className="font-semibold text-foreground">{item.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            #{item.shareholderNumber}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{item.branch}</td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {item.shareholding.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {item.phone}
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            variant="outline"
                            className="text-xs"
                          >
                            {item.registrationType}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {item.verificationCode || "Pending"}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {item.checkedInAt ?? "Not checked in"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </PortalCard>
      </div>
    </AppShell>
  );
}

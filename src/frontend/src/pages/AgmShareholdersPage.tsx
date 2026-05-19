import { AgmLayout } from "@/components/AgmLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAgmYear } from "@/context/AgmYearContext";
import { AGM_UPDATED_EVENT, apiGetAgmShareholders } from "@/lib/backend-client";
import { type AgmShareholderRecord } from "@/lib/agm-module";
import { cn } from "@/lib/utils";
import { Download, FileText, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type FilterMode = "all" | "in-person" | "proxy";

function exportShareholdersCsv(records: AgmShareholderRecord[], activeYear: string) {
  const rows = [
    [
      "No.",
      "Member No / Chit",
      "Name",
      "Type",
      "Contact",
      "Verification Code",
      "Proof",
      "Status",
    ],
    ...records.map((item, index) => [
      String(index + 1),
      item.shareholderNumber,
      item.fullName,
      item.registrationType,
      item.phone,
      item.verificationCode || "",
      item.registrationType === "Proxy" ? "Proxy Nomination" : "-",
      item.checkedInAt ? "Checked In" : "Registered",
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

function exportShareholdersPdf(activeYear: string) {
  const title = `AGM ${activeYear} Shareholders`;
  document.title = title;
  window.print();
}

function statusClasses(item: AgmShareholderRecord) {
  return item.checkedInAt
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : "border-sky-500/30 bg-sky-500/10 text-sky-300";
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="panel-sharp border border-border/60 bg-card/80 px-5 py-4">
      <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-4xl font-display font-bold text-primary">{value}</div>
    </div>
  );
}

export default function AgmShareholdersPage() {
  const { activeYear, setActiveYear, yearOptions } = useAgmYear();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [shareholders, setShareholders] = useState<AgmShareholderRecord[]>([]);
  const [selectedAll, setSelectedAll] = useState(false);

  useEffect(() => {
    const load = () => {
      void apiGetAgmShareholders().then(setShareholders);
    };
    load();
    window.addEventListener(AGM_UPDATED_EVENT, load);
    return () => window.removeEventListener(AGM_UPDATED_EVENT, load);
  }, [activeYear]);

  const registeredRecords = useMemo(
    () => shareholders.filter((item) => item.registrationType !== "Not Registered"),
    [shareholders],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return registeredRecords.filter((item) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "in-person"
            ? item.registrationType === "In Person"
            : item.registrationType === "Proxy";
      const matchesSearch =
        !normalized ||
        [
          item.fullName,
          item.shareholderNumber,
          item.phone,
          item.ghanaCardId,
          item.proxyName ?? "",
          item.verificationCode,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesFilter && matchesSearch;
    });
  }, [filter, query, registeredRecords]);

  const checkedInCount = registeredRecords.filter((item) => Boolean(item.checkedInAt)).length;
  const inPersonCount = registeredRecords.filter((item) => item.registrationType === "In Person").length;
  const proxyCount = registeredRecords.filter((item) => item.registrationType === "Proxy").length;

  return (
    <AgmLayout>
      <div className="page-shell space-y-6" data-ocid="agm.shareholders.page">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Registered" value={registeredRecords.length} />
          <SummaryCard label="In Person" value={inPersonCount} />
          <SummaryCard label="Proxy" value={proxyCount} />
          <SummaryCard label="Checked In" value={checkedInCount} />
        </section>

        <section className="space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-4 xl:flex-row xl:items-center">
              <div className="relative flex-1 xl:max-w-2xl">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search registered name, member no, phone, Ghana Card, proxy, or code"
                  className="h-12 border-border/60 bg-card/80 pl-11"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={filter === "all" ? "default" : "outline"}
                  className="h-12 px-6"
                  onClick={() => setFilter("all")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant={filter === "in-person" ? "default" : "outline"}
                  className="h-12 px-6"
                  onClick={() => setFilter("in-person")}
                >
                  In Person
                </Button>
                <Button
                  type="button"
                  variant={filter === "proxy" ? "default" : "outline"}
                  className="h-12 px-6"
                  onClick={() => setFilter("proxy")}
                >
                  Proxy
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  AGM Year
                </div>
                <select
                  value={activeYear}
                  onChange={(event) => setActiveYear(event.target.value)}
                  className="h-12 border border-border/60 bg-card/80 px-4 text-lg font-semibold text-foreground outline-none transition-smooth focus:border-primary"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-12 px-5 text-sm font-semibold"
                onClick={() => exportShareholdersCsv(filtered, activeYear)}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 px-5 text-sm font-semibold"
                onClick={() => exportShareholdersPdf(activeYear)}
              >
                <FileText className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            AGM {activeYear}: {filtered.length.toLocaleString()} registered records shown
          </div>

          <div className="panel-sharp border border-border/60 bg-card/85">
            <Table className="min-w-[1120px]">
              <TableHeader className="bg-transparent">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px]">
                    <label className="flex items-center gap-3 text-[13px] font-medium normal-case tracking-normal text-foreground">
                      <input
                        type="checkbox"
                        checked={selectedAll}
                        onChange={(event) => setSelectedAll(event.target.checked)}
                        className="h-4 w-4"
                      />
                      Select all
                    </label>
                  </TableHead>
                  <TableHead>No.</TableHead>
                  <TableHead>Member No / Chit</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Verification Code</TableHead>
                  <TableHead>Proof</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="px-6 py-24">
                      <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex h-14 w-14 items-center justify-center border border-border/60 bg-background text-muted-foreground">
                          <Users className="h-7 w-7" />
                        </div>
                        <div className="text-2xl font-display font-bold text-foreground">
                          No registered shareholders yet
                        </div>
                        <div className="max-w-xl text-base leading-7 text-muted-foreground">
                          This page stays empty until someone is registered. As soon as a
                          registration is completed, the full record will appear here
                          automatically.
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedAll}
                          onChange={() => undefined}
                          className="h-4 w-4"
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        {item.shareholderNumber}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {item.fullName}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "border px-3 py-1 text-xs",
                            item.registrationType === "Proxy"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                              : "border-sky-500/30 bg-sky-500/10 text-sky-300",
                          )}
                        >
                          {item.registrationType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.phone || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.verificationCode || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.registrationType === "Proxy" ? "Proxy Nomination" : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("border px-3 py-1 text-xs", statusClasses(item))}
                        >
                          {item.checkedInAt ? "Checked In" : "Registered"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </AgmLayout>
  );
}

import { AgmLayout } from "@/components/AgmLayout";
import { PortalCard } from "@/components/PortalCard";
import { useAgmYear } from "@/context/AgmYearContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  apiGetAgmShareholders,
  apiGetAgmImportBatches,
  apiImportAgmShareholderBatch,
} from "@/lib/backend-client";
import { AGM_BRANCH_OPTIONS, AGM_SUMMARY, type AgmImportBatchRecord } from "@/lib/agm-module";
import {
  AGM_IMPORT_FIELDS,
  EMPTY_COLUMN_MAPPING,
  autoDetectMapping,
  type ColumnMapping,
  mapRow,
  parseSpreadsheetFile,
  serializeErrorsToCsv,
  type ValidationResult,
  validateMappedRows,
} from "@/lib/agm-import-utils";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Database,
  FileSpreadsheet,
  RefreshCcw,
  Search,
  Upload,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type WizardStep = 1 | 2 | 3 | 4;

interface SavedImportFile {
  id: string;
  name: string;
  addedAt: string;
  lastImportedAt?: string;
}

const FILE_LIBRARY_KEY = "bcb:agm-import:file-library";
const DEFAULT_FILE_LIBRARY: SavedImportFile[] = [
  {
    id: "agm-head-office-2026",
    name: "AGM_2026_HEAD_OFFICE_BATCH.csv",
    addedAt: "2026-05-10T08:00:00.000Z",
    lastImportedAt: "2026-05-13T17:42:00.000Z",
  },
  {
    id: "agm-kasoa-main-2026",
    name: "AGM_2026_KASOA_MAIN_BATCH.csv",
    addedAt: "2026-05-11T08:00:00.000Z",
  },
];
function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function StepPill({
  step,
  currentStep,
  label,
}: {
  step: WizardStep;
  currentStep: WizardStep;
  label: string;
}) {
  const complete = step < currentStep;
  const active = step === currentStep;

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "panel-sharp flex h-11 w-11 items-center justify-center border text-sm font-bold",
          complete
            ? "border-primary/30 bg-primary text-primary-foreground"
            : active
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border/40 bg-muted/25 text-muted-foreground",
        )}
      >
        {complete ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Step {step}
        </div>
        <div className="text-sm font-semibold text-foreground">{label}</div>
      </div>
    </div>
  );
}

export default function AgmImportPage() {
  const { activeYear } = useAgmYear();
  const { user } = useAuth();
  const [step, setStep] = useState<WizardStep>(1);
  const [fileLibrary, setFileLibrary] = useState<SavedImportFile[]>([]);
  const [importHistory, setImportHistory] = useState<AgmImportBatchRecord[]>([]);
  const [libraryName, setLibraryName] = useState("");
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>(
    user?.branch
      ? AGM_BRANCH_OPTIONS.find(
          (branch) => branch.toLowerCase() === user.branch.toLowerCase(),
        ) ?? AGM_BRANCH_OPTIONS[0]
      : AGM_BRANCH_OPTIONS[0],
  );
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [existingShareholderNumbers, setExistingShareholderNumbers] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_COLUMN_MAPPING);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Select a shareholder source file to begin the AGM import workflow.",
  );
  const [progress, setProgress] = useState(0);
  const [importDone, setImportDone] = useState(false);
  const [selectedSavedFileId, setSelectedSavedFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importStartedRef = useRef(false);

  useEffect(() => {
    setFileLibrary(readStorage(FILE_LIBRARY_KEY, DEFAULT_FILE_LIBRARY));
    void Promise.all([apiGetAgmImportBatches(), apiGetAgmShareholders()]).then(
      ([batches, shareholders]) => {
        setImportHistory(batches);
        setExistingShareholderNumbers(
          shareholders.map((record) => record.shareholderNumber),
        );
      },
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || fileLibrary.length === 0) return;
    window.localStorage.setItem(FILE_LIBRARY_KEY, JSON.stringify(fileLibrary));
  }, [fileLibrary]);

  useEffect(() => {
    if (step !== 4 || importDone || !validation || importStartedRef.current) return;
    importStartedRef.current = true;
    setStatusMessage("Creating AGM import batch...");
    setProgress(12);
    let cancelled = false;

    const timers = [
      window.setTimeout(() => {
        if (cancelled) return;
        setStatusMessage("Staging validated shareholder rows...");
        setProgress(38);
      }, 650),
      window.setTimeout(() => {
        if (cancelled) return;
        setStatusMessage("Running final AGM import checks...");
        setProgress(72);
      }, 1250),
      window.setTimeout(() => {
        void (async () => {
          try {
            const historyItem = await apiImportAgmShareholderBatch({
              filename: selectedFile?.name ?? "Unnamed spreadsheet",
              branch: selectedBranch,
              rows: validation.validRows,
              duplicateRows: validation.duplicates.length,
              errorRows: validation.errors.length,
              operatorName: user?.fullname ?? "AGM Operator",
            });
            if (cancelled) return;
            setImportHistory((current) => [historyItem, ...current].slice(0, 12));
            void apiGetAgmShareholders().then((shareholders) => {
              if (cancelled) return;
              setExistingShareholderNumbers(
                shareholders.map((record) => record.shareholderNumber),
              );
            });
            setFileLibrary((current) =>
              current.map((item) =>
                item.id === selectedSavedFileId
                  ? { ...item, lastImportedAt: historyItem.importedAt }
                  : item,
              ),
            );
            setSelectedHistoryId(historyItem.id);
            setStatusMessage("AGM import completed and stored in the portal data layer.");
            setProgress(100);
            setImportDone(true);
            toast.success(
              `Imported ${historyItem.importedRows.toLocaleString()} shareholder rows into the AGM workspace.`,
            );
          } catch (error) {
            if (cancelled) return;
            setStatusMessage(
              error instanceof Error
                ? error.message
                : "The AGM import could not be completed.",
            );
            setProgress(0);
            importStartedRef.current = false;
            setStep(3);
            toast.error("The AGM import could not be completed.");
          }
        })();
      }, 1950),
    ];

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [
    importDone,
    selectedFile,
    selectedBranch,
    selectedSavedFileId,
    step,
    user?.fullname,
    validation,
  ]);

  const totalImportedRows = useMemo(
    () => importHistory.reduce((sum, item) => sum + item.importedRows, 0),
    [importHistory],
  );
  const needsReviewCount = useMemo(
    () =>
      importHistory.filter((item) => item.status === "Completed With Issues")
        .length,
    [importHistory],
  );
  const filteredLibrary = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return fileLibrary;
    return fileLibrary.filter((item) =>
      item.name.toLowerCase().includes(normalized),
    );
  }, [fileLibrary, query]);
  const previewRows = parsedRows.slice(0, 5);
  const mappedPreview = useMemo(
    () => parsedRows.slice(0, 5).map((row) => mapRow(row, mapping)),
    [mapping, parsedRows],
  );

  function resetWizard() {
    setStep(1);
    setSelectedFile(null);
    setHeaders([]);
    setParsedRows([]);
    setMapping(EMPTY_COLUMN_MAPPING);
    setValidation(null);
    setStatusMessage("Select a shareholder source file to begin the AGM import workflow.");
    setProgress(0);
    setImportDone(false);
    importStartedRef.current = false;
  }

  function parseSelectedFile(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["csv", "xlsx", "xls"].includes(extension)) {
      toast.error("Upload a CSV, XLSX, or XLS AGM source file.");
      setStatusMessage(
        "Use a valid AGM spreadsheet file in CSV, XLSX, or XLS format.",
      );
      return;
    }

    parseSpreadsheetFile(file)
      .then((parsed) => {
        setSelectedFile(file);
        setHeaders(parsed.headers);
        setParsedRows(parsed.rows);
        setMapping(autoDetectMapping(parsed.headers));
        setValidation(null);
        setStatusMessage(
          `Loaded ${parsed.rows.length.toLocaleString()} source rows from ${file.name}.`,
        );
        toast.success("Spreadsheet parsed. Continue to column mapping.");
      })
      .catch((error) => {
        setStatusMessage(
          error instanceof Error
            ? error.message
            : "The selected spreadsheet file could not be parsed.",
        );
        toast.error("The spreadsheet file could not be parsed.");
      });
  }

  function handleLibraryAdd() {
    const normalized = libraryName.trim();
    if (!normalized) return;
    const entry: SavedImportFile = {
      id: `agm-library-${Date.now()}`,
      name: normalized,
      addedAt: new Date().toISOString(),
    };
    setFileLibrary((current) => [entry, ...current].slice(0, 12));
    setLibraryName("");
    setSelectedSavedFileId(entry.id);
    toast.success("Saved file name added to the AGM import list.");
  }

  function handleValidate() {
    const requiredMapped = AGM_IMPORT_FIELDS.filter((field) => field.required).every(
      (field) => Boolean(mapping[field.key]),
    );

    if (!requiredMapped) {
      toast.error("Map all required AGM columns first.");
      return;
    }

    const mappedRows = parsedRows.map((row) => mapRow(row, mapping));
    const result = validateMappedRows(
      mappedRows,
      existingShareholderNumbers,
    );
    setValidation(result);
    setStep(3);
    setStatusMessage(
      `Validation found ${result.validRows.length.toLocaleString()} ready rows, ${result.duplicates.length.toLocaleString()} duplicates, and ${result.errors.length.toLocaleString()} errors.`,
    );
  }

  function handleBeginImport() {
    if (!validation || validation.validRows.length === 0) {
      toast.error("There are no valid shareholder rows ready for import.");
      return;
    }
    if (!selectedBranch.trim()) {
      toast.error("Choose the branch this AGM import batch belongs to.");
      return;
    }
    setImportDone(false);
    setProgress(0);
    importStartedRef.current = false;
    setStep(4);
  }

  function downloadErrors() {
    if (!validation || validation.errors.length === 0) return;
    const csv = serializeErrorsToCsv(validation.errors);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agm-${activeYear}-import-errors.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  const currentHistoryItem =
    importHistory.find((item) => item.id === selectedHistoryId) ?? importHistory[0];

  return (
    <AgmLayout>
      <div className="page-shell space-y-6" data-ocid="agm.import.page">
        <section className="hero-panel">
          <div className="hero-panel__content">
            <div className="page-kicker">Import Workspace</div>
            <div className="space-y-4">
              <h1 className="text-4xl font-display font-bold text-foreground sm:text-5xl">
                AGM {activeYear} Import Wizard
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                Upload a shareholder spreadsheet, map the incoming columns,
                validate the records, and log a completed AGM import batch
                without leaving the staff portal.
              </p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="metric-card min-h-[140px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              AGM Shareholders
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {existingShareholderNumbers.length.toLocaleString()}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Current AGM shareholder master records available for duplicate checks.
            </div>
          </div>
          <div className="metric-card min-h-[140px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Import Batches
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {importHistory.length}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Recent AGM import runs retained inside the embedded portal.
            </div>
          </div>
          <div className="metric-card min-h-[140px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Imported Rows
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {totalImportedRows.toLocaleString()}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Total successfully staged shareholder rows from import history.
            </div>
          </div>
          <div className="metric-card min-h-[140px]">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Needs Review
            </div>
            <div className="mt-5 font-display text-3xl font-bold text-foreground">
              {needsReviewCount}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Completed batches with duplicates or data quality issues to resolve.
            </div>
          </div>
        </div>

        <PortalCard
          elevated
          title="Embedded Import Flow"
          subtitle="Follow the original AGM import sequence from upload through final import."
          data-ocid="agm.import.wizard.card"
        >
          <div className="grid gap-4 md:grid-cols-4">
            <StepPill step={1} currentStep={step} label="Upload File" />
            <StepPill step={2} currentStep={step} label="Map Columns" />
            <StepPill step={3} currentStep={step} label="Validate Rows" />
            <StepPill step={4} currentStep={step} label="Import Batch" />
          </div>
        </PortalCard>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.85fr]">
          <PortalCard
            elevated
            title="Wizard Workspace"
            subtitle={statusMessage}
            action={
              <Button
                variant="outline"
                className="h-11 px-4 text-sm font-semibold"
                onClick={resetWizard}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reset Flow
              </Button>
            }
            data-ocid="agm.import.workspace.card"
          >
            {step === 1 ? (
              <div className="space-y-6">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        const file = event.dataTransfer.files?.[0];
                        if (file) parseSelectedFile(file);
                      }}
                      className={cn(
                        "panel-sharp flex min-h-[280px] w-full cursor-pointer flex-col items-center justify-center border-2 border-dashed p-8 text-center transition-smooth",
                        dragging
                          ? "border-primary bg-primary/10"
                          : "border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-muted/30",
                      )}
                    >
                      <div className="panel-sharp flex h-16 w-16 items-center justify-center border border-primary/25 bg-primary/10">
                        <Upload className="h-8 w-8 text-primary" />
                      </div>
                      <div className="mt-5 space-y-2">
                        <div className="font-display text-2xl font-bold text-foreground">
                          Drop AGM spreadsheet here
                        </div>
                        <p className="max-w-md text-sm leading-6 text-muted-foreground">
                          Upload branch shareholder source files in CSV, XLSX, or
                          XLS format and let the portal prepare them for the AGM
                          import process automatically.
                        </p>
                      </div>
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <Badge variant="outline">CSV / XLSX / XLS</Badge>
                        <Badge variant="outline">Column auto-detect</Badge>
                        <Badge variant="outline">Duplicate screening</Badge>
                      </div>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) parseSelectedFile(file);
                      }}
                    />

                    {selectedFile ? (
                      <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="font-semibold text-foreground">
                              {selectedFile.name}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {parsedRows.length.toLocaleString()} data rows,{" "}
                              {headers.length} detected columns.
                            </div>
                          </div>
                          <Badge variant="outline">Ready for mapping</Badge>
                        </div>
                      </div>
                    ) : null}

                    <div className="panel-sharp border border-border/40 bg-background/50 p-4">
                      <Label htmlFor="agm-import-branch">Batch Branch</Label>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Assign the uploaded shareholder file to the branch it belongs
                        to before validation and import.
                      </p>
                      <select
                        id="agm-import-branch"
                        value={selectedBranch}
                        onChange={(event) => setSelectedBranch(event.target.value)}
                        className="control-sharp glass-input border-input mt-3 h-11 w-full border bg-transparent px-3 text-sm outline-none focus:border-primary"
                      >
                        {AGM_BRANCH_OPTIONS.map((branch) => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))}
                      </select>
                    </div>

                    {previewRows.length > 0 ? (
                      <div className="space-y-3">
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                          Preview Rows
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {headers.map((header) => (
                                <TableHead key={header}>{header}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewRows.map((row, rowIndex) => (
                              <TableRow key={`preview-${rowIndex + 1}`}>
                                {headers.map((header) => (
                                  <TableCell
                                    key={`${rowIndex + 1}-${header}`}
                                    className="max-w-[180px] truncate"
                                  >
                                    {row[header]}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-foreground">
                          Saved File List
                        </div>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Store the branch file names operators use most often so
                          each AGM upload cycle stays predictable.
                        </p>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Input
                          value={libraryName}
                          onChange={(event) => setLibraryName(event.target.value)}
                          placeholder="AGM_2026_OFAAKOR_BATCH.xlsx"
                          className="h-11"
                        />
                        <Button className="h-11 px-4" onClick={handleLibraryAdd}>
                          Add
                        </Button>
                      </div>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search saved file names"
                        className="h-11 pl-10"
                      />
                    </div>

                    <div className="space-y-3">
                      {filteredLibrary.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedSavedFileId(item.id)}
                          className={cn(
                            "panel-sharp w-full border p-4 text-left transition-smooth",
                            selectedSavedFileId === item.id
                              ? "border-primary/40 bg-primary/10"
                              : "border-border/40 bg-muted/20 hover:border-primary/30",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <FileSpreadsheet className="mt-0.5 h-4 w-4 text-primary" />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-foreground">
                                {item.name}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                Added {formatDate(item.addedAt)}
                              </div>
                              {item.lastImportedAt ? (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Last used {formatDate(item.lastImportedAt)}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    className="glass-button h-12 px-6 text-sm font-bold uppercase tracking-[0.14em]"
                    disabled={!selectedFile || parsedRows.length === 0}
                    onClick={() => setStep(2)}
                  >
                    Continue to Mapping
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {AGM_IMPORT_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={`mapping-${field.key}`}>
                        {field.label}
                        {field.required ? (
                          <span className="text-destructive">*</span>
                        ) : null}
                      </Label>
                      <select
                        id={`mapping-${field.key}`}
                        value={mapping[field.key]}
                        onChange={(event) =>
                          setMapping((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        className="control-sharp glass-input border-input h-11 w-full border bg-transparent px-3 text-sm outline-none focus:border-primary"
                      >
                        <option value="">-- Not mapped --</option>
                        {headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <Database className="mt-0.5 h-4 w-4 text-primary" />
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="font-semibold text-foreground">
                        Auto-detect is already applied
                      </div>
                      <p>
                        Review the mapped columns before validation. The wizard
                        will compare incoming shareholder numbers against the
                        current AGM records and flag duplicates before import.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Mapped Preview
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {AGM_IMPORT_FIELDS.filter((field) => Boolean(mapping[field.key])).map(
                          (field) => (
                            <TableHead key={field.key}>{field.label}</TableHead>
                          ),
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappedPreview.map((row, rowIndex) => (
                        <TableRow key={`mapped-${rowIndex + 1}`}>
                          {AGM_IMPORT_FIELDS.filter((field) => Boolean(mapping[field.key])).map(
                            (field) => (
                              <TableCell key={`${rowIndex + 1}-${field.key}`}>
                                {String(row[field.key] ?? "")}
                              </TableCell>
                            ),
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="outline"
                    className="h-12 px-5 text-sm font-semibold"
                    onClick={() => setStep(1)}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Upload
                  </Button>
                  <Button
                    className="glass-button h-12 px-6 text-sm font-bold uppercase tracking-[0.14em]"
                    onClick={handleValidate}
                  >
                    Validate Data
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 3 && validation ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="metric-card min-h-[132px]">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Valid Rows
                    </div>
                    <div className="mt-5 font-display text-3xl font-bold text-foreground">
                      {validation.validRows.length.toLocaleString()}
                    </div>
                  </div>
                  <div className="metric-card min-h-[132px]">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Duplicate Rows
                    </div>
                    <div className="mt-5 font-display text-3xl font-bold text-foreground">
                      {validation.duplicates.length.toLocaleString()}
                    </div>
                  </div>
                  <div className="metric-card min-h-[132px]">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Error Rows
                    </div>
                    <div className="mt-5 font-display text-3xl font-bold text-foreground">
                      {validation.errors.length.toLocaleString()}
                    </div>
                  </div>
                </div>

                {validation.duplicates.length > 0 ? (
                  <div className="panel-sharp border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <CircleAlert className="mt-0.5 h-4 w-4 text-amber-500" />
                      <div className="space-y-2">
                        <div className="font-semibold text-foreground">
                          Duplicate shareholder rows were held back
                        </div>
                        <p className="text-sm text-muted-foreground">
                          The wizard will import only the clean rows and leave the
                          duplicates for operator review.
                        </p>
                        <div className="space-y-2">
                          {validation.duplicates.slice(0, 6).map((duplicate) => (
                            <div
                              key={`${duplicate.row}-${duplicate.shareholderNumber}`}
                              className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
                            >
                              <span>
                                Row {duplicate.row}: {duplicate.fullName}
                              </span>
                              <Badge variant="outline">
                                {duplicate.shareholderNumber}{" "}
                                {duplicate.source === "existing"
                                  ? "already exists"
                                  : "repeated in file"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {validation.errors.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">
                          Error rows
                        </div>
                        <p className="text-sm text-muted-foreground">
                          These rows will not be imported until the source file is
                          corrected.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="h-11 px-4 text-sm font-semibold"
                        onClick={downloadErrors}
                      >
                        Download Errors
                      </Button>
                    </div>
                    <Textarea
                      readOnly
                      className="min-h-[180px]"
                      value={validation.errors
                        .slice(0, 8)
                        .map(
                          (issue) =>
                            `Row ${issue.row}: ${issue.message} [${issue.rowData.fullName || "No name"} / ${issue.rowData.shareholderNumber || "No shareholder number"}]`,
                        )
                        .join("\n")}
                    />
                  </div>
                ) : null}

                <div className="flex items-start gap-3 panel-sharp border border-border/40 bg-muted/20 p-4">
                  <Checkbox checked />
                  <div className="space-y-1">
                    <div className="font-semibold text-foreground">
                      Valid rows only will be imported
                    </div>
                    <p className="text-sm text-muted-foreground">
                      This protects the main AGM shareholder list while still
                      allowing clean records to move forward immediately.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="outline"
                    className="h-12 px-5 text-sm font-semibold"
                    onClick={() => setStep(2)}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Mapping
                  </Button>
                  <Button
                    className="glass-button h-12 px-6 text-sm font-bold uppercase tracking-[0.14em]"
                    onClick={handleBeginImport}
                    disabled={validation.validRows.length === 0}
                  >
                    Begin Import
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 4 && validation ? (
              <div className="space-y-6">
                <div className="panel-sharp border border-border/40 bg-muted/20 p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="page-kicker">Import Batch Status</div>
                      <h2 className="font-display text-2xl font-bold text-foreground">
                        {importDone ? "Import completed" : "Processing AGM import"}
                      </h2>
                      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                        {statusMessage}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {selectedFile?.name ?? "No file selected"}
                    </Badge>
                  </div>

                  <div className="mt-6 space-y-2">
                    <Progress value={progress} />
                    <div className="text-xs text-muted-foreground">
                      {progress}% complete
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="metric-card min-h-[132px]">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Imported
                      </div>
                      <div className="mt-5 font-display text-3xl font-bold text-foreground">
                        {validation.validRows.length.toLocaleString()}
                      </div>
                    </div>
                    <div className="metric-card min-h-[132px]">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Duplicates
                      </div>
                      <div className="mt-5 font-display text-3xl font-bold text-foreground">
                        {validation.duplicates.length.toLocaleString()}
                      </div>
                    </div>
                    <div className="metric-card min-h-[132px]">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Errors
                      </div>
                      <div className="mt-5 font-display text-3xl font-bold text-foreground">
                        {validation.errors.length.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {importDone ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      variant="outline"
                      className="h-12 px-5 text-sm font-semibold"
                      onClick={resetWizard}
                    >
                      Import Another File
                    </Button>
                    <Button asChild className="glass-button h-12 px-6 text-sm font-bold uppercase tracking-[0.14em]">
                      <Link to="/agm/shareholders">
                        <Users className="mr-2 h-4 w-4" />
                        View Shareholders
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="h-12 px-5 text-sm font-semibold"
                    onClick={() => setStep(3)}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Validation
                  </Button>
                )}
              </div>
            ) : null}
          </PortalCard>

          <div className="space-y-6">
            <PortalCard
              elevated
              title="Operator Notes"
              subtitle="Keep the upload source clean before you run the AGM import."
              data-ocid="agm.import.notes.card"
            >
              <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>
                  Export the shareholder sheet with one clear header row in CSV
                  or Excel format.
                </p>
                <p>
                  Keep shareholder numbers unique and make sure Ghana Card or ID
                  columns are present before upload.
                </p>
                <p>
                  The embedded portal checks against the current AGM shareholder
                  list and holds back duplicates automatically.
                </p>
              </div>
            </PortalCard>

            <PortalCard
              elevated
              title="Recent Import History"
              subtitle="Latest AGM import runs recorded by the embedded wizard."
              data-ocid="agm.import.history.card"
            >
              <div className="space-y-3">
                {importHistory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedHistoryId(item.id)}
                    className={cn(
                      "panel-sharp w-full border p-4 text-left transition-smooth",
                      currentHistoryItem?.id === item.id
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/40 bg-muted/20 hover:border-primary/30",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground">
                          {item.filename}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDate(item.importedAt)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.branch} • {item.operatorName}
                        </div>
                      </div>
                      <Badge variant="outline">{item.status}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div>{item.importedRows} imported</div>
                      <div>{item.duplicateRows} duplicates</div>
                      <div>{item.errorRows} errors</div>
                    </div>
                  </button>
                ))}
              </div>
            </PortalCard>

            {currentHistoryItem ? (
              <PortalCard
                elevated
                title="Selected Batch"
                subtitle="Quick reference for the currently highlighted import run."
                data-ocid="agm.import.selected-batch.card"
              >
                <div className="space-y-4">
                  <div className="panel-sharp border border-border/40 bg-muted/20 p-4">
                    <div className="font-semibold text-foreground">
                      {currentHistoryItem.filename}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Imported {formatDate(currentHistoryItem.importedAt)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {currentHistoryItem.branch} • {currentHistoryItem.operatorName}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="panel-sharp border border-border/40 bg-muted/20 p-4 text-center">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Imported
                      </div>
                      <div className="mt-3 font-display text-2xl font-bold text-foreground">
                        {currentHistoryItem.importedRows}
                      </div>
                    </div>
                    <div className="panel-sharp border border-border/40 bg-muted/20 p-4 text-center">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Duplicates
                      </div>
                      <div className="mt-3 font-display text-2xl font-bold text-foreground">
                        {currentHistoryItem.duplicateRows}
                      </div>
                    </div>
                    <div className="panel-sharp border border-border/40 bg-muted/20 p-4 text-center">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Errors
                      </div>
                      <div className="mt-3 font-display text-2xl font-bold text-foreground">
                        {currentHistoryItem.errorRows}
                      </div>
                    </div>
                  </div>
                </div>
              </PortalCard>
            ) : null}
          </div>
        </div>
      </div>
    </AgmLayout>
  );
}

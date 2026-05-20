import { Button } from "@/components/ui/button";
import type { ImportFileLibraryItem } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, Plus, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { ParsedRow } from "./types";

interface Step1Props {
  onNext: (file: File, headers: string[], rows: ParsedRow[]) => void;
  importFiles: ImportFileLibraryItem[];
  onImportFilesChange: (items: ImportFileLibraryItem[]) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_LIBRARY_ITEMS = 500;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function Step1Upload({
  onNext,
  importFiles,
  onImportFilesChange,
}: Step1Props) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(
    importFiles[0]?.id ?? null,
  );
  const [manualFileName, setManualFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fullRowsRef = useRef<ParsedRow[]>([]);

  function parseFile(f: File) {
    setError(null);
    setParsing(true);
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "csv" && ext !== "xls") {
      setError("Unsupported file type. Please upload .xlsx or .csv");
      setParsing(false);
      return;
    }
    setFile(f);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let wb: XLSX.WorkBook;
        if (ext === "csv") {
          wb = XLSX.read(data as string, {
            type: "string",
            dense: true,
            sheetRows: 11,
          });
        } else {
          wb = XLSX.read(data as ArrayBuffer, {
            type: "array",
            dense: true,
            cellText: false,
            sheetRows: 11,
          });
        }
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: ParsedRow[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (rows.length === 0) {
          setError("File appears to be empty or has no data rows.");
          setParsing(false);
          return;
        }
        const hs = Object.keys(rows[0]);
        fullRowsRef.current = [];
        setHeaders(hs);
        setPreview(rows.slice(0, 10));
        setParsing(false);
      } catch {
        setError("Failed to parse file. Ensure it is a valid Excel or CSV.");
        setParsing(false);
      }
    };
    if (ext === "csv") {
      reader.readAsText(f);
    } else {
      reader.readAsArrayBuffer(f);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    parseFile(files[0]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function clearFile() {
    setFile(null);
    setHeaders([]);
    setPreview([]);
    fullRowsRef.current = [];
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function addManualFileName() {
    const normalized = manualFileName.trim();
    if (!normalized) return;
    const now = new Date().toISOString();
    const nextItem: ImportFileLibraryItem = {
      id: `${normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name: normalized,
      addedAt: now,
      updatedAt: now,
    };
    const nextItems = [nextItem, ...importFiles].slice(0, MAX_LIBRARY_ITEMS);
    onImportFilesChange(nextItems);
    setSelectedLibraryId(nextItem.id);
    setManualFileName("");
  }

  function removeLibraryItem(id: string) {
    const nextItems = importFiles.filter((item) => item.id !== id);
    onImportFilesChange(nextItems);
    if (selectedLibraryId === id) {
      setSelectedLibraryId(nextItems[0]?.id ?? null);
    }
  }

  function handleAllRowsForNext() {
    if (!file) return;
    if (fullRowsRef.current.length > 0 && headers.length > 0) {
      onNext(file, headers, fullRowsRef.current);
      return;
    }
    setParsing(true);
    const ext = file.name.split(".").pop()?.toLowerCase();
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let wb: XLSX.WorkBook;
        if (ext === "csv") {
          wb = XLSX.read(data as string, { type: "string", dense: true });
        } else {
          wb = XLSX.read(data as ArrayBuffer, {
            type: "array",
            dense: true,
            cellText: false,
          });
        }
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: ParsedRow[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (rows.length === 0) {
          setError("File appears to be empty or has no data rows.");
          setParsing(false);
          return;
        }
        const hs = Object.keys(rows[0]);
        fullRowsRef.current = rows;
        setParsing(false);
        onNext(file, hs, rows);
      } catch {
        setError(
          "The file could not be loaded completely. Please try a smaller file or re-save the Excel sheet and upload again.",
        );
        setParsing(false);
      }
    };
    if (ext === "csv") {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  return (
    <div className="space-y-6" data-ocid="import.step1">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "w-full border-2 border-dashed p-8 sm:p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-smooth min-h-[240px] sm:min-h-[280px]",
            dragging
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-muted/30",
          )}
          data-ocid="import.dropzone"
          aria-label="Upload Excel or CSV file"
        >
          <div className="w-16 h-16 bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-display font-semibold text-foreground text-lg">
              Drop your file here
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              or click to browse &mdash;{" "}
              <span className="text-primary font-medium">.xlsx</span> or{" "}
              <span className="text-primary font-medium">.csv</span> files
              supported
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            data-ocid="import.upload_button"
          />
        </button>
      ) : (
        <div className="bg-card border border-border p-4 sm:p-6 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="w-12 h-12 bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">
                {file.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatBytes(file.size)} &bull; {headers.length} columns &bull;{" "}
                {preview.length === 10 ? "10+" : preview.length} rows preview
              </p>
            </div>
            <div className="sm:ml-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={clearFile}
                className="min-h-[44px] min-w-[44px] flex-shrink-0"
                data-ocid="import.clear_button"
                aria-label="Remove file"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Column chips */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Detected Columns ({headers.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {headers.map((h) => (
                <span
                  key={h}
                  className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-medium"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>

          {/* Preview table */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Data Preview (first {preview.length} rows)
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {headers.map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.map((row, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: preview rows
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      {headers.map((h) => (
                        <td
                          key={h}
                          className="px-3 py-2 text-foreground whitespace-nowrap max-w-[160px] truncate"
                        >
                          {row[h] as string}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
        </div>

        <div className="bg-muted/20 border border-border p-4 sm:p-5 space-y-4 h-fit">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Saved File List
            </p>
            <p className="text-xs text-muted-foreground">
              Add, remove, and reuse your regular shareholder file names anytime.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={manualFileName}
              onChange={(e) => setManualFileName(e.target.value)}
              placeholder="Add file name"
              className="flex-1 min-h-[44px] border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              data-ocid="import.file_library.name_input"
            />
            <Button
              type="button"
              onClick={addManualFileName}
              className="min-h-[44px] gap-2"
              data-ocid="import.file_library.add_button"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {importFiles.length === 0 ? (
              <div className="border border-dashed border-border p-4 text-sm text-muted-foreground">
                No saved file names yet.
              </div>
            ) : (
              importFiles.slice(0, MAX_LIBRARY_ITEMS).map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedLibraryId(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedLibraryId(item.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "w-full border p-3 text-left transition-smooth",
                    selectedLibraryId === item.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary/40",
                  )}
                  data-ocid={`import.file_library.item.${item.id}`}
                >
                  <div className="flex items-start gap-3">
                    <FileSpreadsheet className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground break-words">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Added {formatDate(item.addedAt)}
                        {item.lastImportedAt
                          ? ` • Last used ${formatDate(item.lastImportedAt)}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLibraryItem(item.id);
                      }}
                      className="min-h-[36px] min-w-[36px] border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 flex items-center justify-center"
                      aria-label={`Remove ${item.name}`}
                      data-ocid={`import.file_library.remove_button.${item.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border border-border bg-background/70 p-3 text-xs text-muted-foreground">
            Select any saved entry, then upload the latest version of that file
            when you want to import it.
          </div>
        </div>
      </div>

      {error && (
        <div
          className="rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive"
          data-ocid="import.error_state"
        >
          {error}
        </div>
      )}

      {parsing && (
        <div
          className="flex items-center gap-3 text-muted-foreground"
          data-ocid="import.loading_state"
        >
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Parsing file...
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleAllRowsForNext}
          disabled={!file || parsing || preview.length === 0}
          className="min-h-[44px] px-6 font-semibold"
          data-ocid="import.step1.next_button"
        >
          Continue to Column Mapping
        </Button>
      </div>
    </div>
  );
}

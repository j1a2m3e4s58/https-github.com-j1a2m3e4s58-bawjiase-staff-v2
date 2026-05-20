import type { ImportBatch } from "@/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/ToastContext";
import {
  ImportStatus,
  useBulkCreateShareholders,
  useCreateImportBatch,
  useImportBatches,
  useUpdateImportBatchStatus,
} from "@/hooks/use-backend";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChevronLeft,
  Clock,
  FileCheck2,
  Loader2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImportResult, MappedRow } from "./types";
import { toShareholderInput } from "./types";

interface Step4Props {
  agmYear: string;
  validRows: MappedRow[];
  filename: string;
  onBack: () => void;
  onReset: () => void;
}

function extractBatchYear(filename: string) {
  const match = filename.match(/AGM\s+(\d{4})/i);
  return match?.[1] ?? "—";
}

function formatTimestamp(ts: bigint): string {
  return new Date(Number(ts / BigInt(1_000_000))).toLocaleString();
}

export function Step4Import({
  agmYear,
  validRows,
  filename,
  onBack,
  onReset,
}: Step4Props) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const hasStarted = useRef(false);

  const bulkCreate = useBulkCreateShareholders();
  const createBatch = useCreateImportBatch();
  const updateBatchStatus = useUpdateImportBatchStatus();
  const { data: batches } = useImportBatches();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const runImport = useCallback(async () => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    setStatus("running");
    setProgress(10);

    let batchId = "";
    try {
      const yearAwareFilename = `AGM ${agmYear} - ${filename}`;
      const batch = await createBatch.mutateAsync({
        filename: yearAwareFilename,
        totalRows: BigInt(validRows.length),
      });
      batchId = batch.id;
      setProgress(25);

      const inputs = validRows.map(toShareholderInput);
      setProgress(50);

      const res = await bulkCreate.mutateAsync(inputs);
      setProgress(80);
      setImportErrors(res.errors);

      await updateBatchStatus.mutateAsync({
        id: batchId,
        status: ImportStatus.Complete,
        importedRows: res.created,
        duplicates: res.duplicates,
      });

      setProgress(100);
      setResult({
        imported: Number(res.created),
        duplicatesSkipped: Number(res.duplicates),
        errors: res.errors.length,
        batchId,
      });
      setStatus("done");
      showToast(
        `Import complete: ${res.created} shareholders imported.`,
        "success",
      );
    } catch (_err) {
      if (batchId) {
        await updateBatchStatus
          .mutateAsync({
            id: batchId,
            status: ImportStatus.Failed,
            importedRows: BigInt(0),
            duplicates: BigInt(0),
          })
          .catch(() => {});
      }
      setStatus("error");
      showToast("Import failed. Please try again.", "error");
    }
  }, [
    validRows,
    filename,
    bulkCreate,
    createBatch,
    updateBatchStatus,
    showToast,
  ]);

  useEffect(() => {
    if (status === "idle") runImport();
  }, [runImport, status]);

  const statusIcon = {
    idle: <Loader2 className="w-10 h-10 text-primary animate-spin" />,
    running: <Loader2 className="w-10 h-10 text-primary animate-spin" />,
    done: <CheckCircle2 className="w-10 h-10 text-primary" />,
    error: <XCircle className="w-10 h-10 text-destructive" />,
  }[status];

  function statusBadge(s: ImportStatus) {
    const map: Record<string, { label: string; cls: string }> = {
      Complete: {
        label: "Completed",
        cls: "bg-primary/15 text-primary border-primary/30",
      },
      Failed: {
        label: "Failed",
        cls: "bg-destructive/15 text-destructive border-destructive/30",
      },
      Processing: {
        label: "Processing",
        cls: "bg-accent/20 text-accent-foreground border-accent/30",
      },
    };
    const key =
      Object.keys(ImportStatus).find(
        (k) => ImportStatus[k as keyof typeof ImportStatus] === s,
      ) ?? "Processing";
    const info = map[key] ?? {
      label: key,
      cls: "bg-muted border-border text-muted-foreground",
    };
    return (
      <span
        className={cn(
          "px-2.5 py-0.5 rounded-full text-xs font-semibold border",
          info.cls,
        )}
      >
        {info.label}
      </span>
    );
  }

  return (
    <div className="space-y-6" data-ocid="import.step4">
      {/* Progress/Result area */}
      <div className="rounded-2xl bg-card border border-border p-8 flex flex-col items-center gap-5">
        {statusIcon}
        <div className="text-center">
          <p className="font-display font-semibold text-lg text-foreground">
            {status === "idle" || status === "running"
              ? "Importing shareholders…"
              : status === "done"
                ? "Import Complete!"
                : "Import Failed"}
          </p>
          {(status === "idle" || status === "running") && (
            <p className="text-sm text-muted-foreground mt-1">
              Processing {validRows.length} rows from{" "}
              <span className="text-primary font-medium">{filename}</span>
            </p>
          )}
          {(status === "idle" || status === "running") && (
            <p className="text-xs text-muted-foreground mt-1">
              This batch will be tracked under AGM {agmYear}.
            </p>
          )}
        </div>

        {/* Progress bar */}
        {(status === "idle" || status === "running") && (
          <div className="w-full max-w-sm" data-ocid="import.progress_bar">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              {progress}%
            </p>
          </div>
        )}

        {/* Result stats */}
        {result && status === "done" && (
          <div
            className="grid grid-cols-3 gap-4 w-full max-w-sm"
            data-ocid="import.step4.success_state"
          >
            <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-center">
              <p className="font-display font-bold text-xl text-primary">
                {result.imported}
              </p>
              <p className="text-xs text-muted-foreground">Imported</p>
            </div>
            <div className="rounded-xl bg-muted border border-border p-3 text-center">
              <p className="font-display font-bold text-xl text-foreground">
                {result.duplicatesSkipped}
              </p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
            <div
              className={cn(
                "rounded-xl border p-3 text-center",
                result.errors > 0
                  ? "bg-destructive/10 border-destructive/20"
                  : "bg-muted border-border",
              )}
            >
              <p
                className={cn(
                  "font-display font-bold text-xl",
                  result.errors > 0 ? "text-destructive" : "text-foreground",
                )}
              >
                {result.errors}
              </p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
          </div>
        )}

        {status === "done" && importErrors.length > 0 && (
          <div className="w-full max-w-xl rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Import completed with validation errors
                </p>
                <p className="text-xs text-muted-foreground">
                  Download the operator summary to review failed rows and retry
                  cleanly.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const rows = [
                    ["Error"],
                    ...importErrors.map((message) => [message]),
                  ];
                  const csv = rows
                    .map((row) =>
                      row
                        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
                        .join(","),
                    )
                    .join("\n");
                  const blob = new Blob([csv], {
                    type: "text/csv;charset=utf-8",
                  });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `agm-${agmYear}-import-errors-${Date.now()}.csv`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                data-ocid="import.step4.download_errors_button"
              >
                Download Errors
              </Button>
            </div>
          </div>
        )}

        {status === "error" && (
          <p
            className="text-sm text-destructive"
            data-ocid="import.step4.error_state"
          >
            Something went wrong. Check your data and try again.
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        {status === "error" ? (
          <Button
            variant="outline"
            onClick={onBack}
            className="min-h-[44px] px-5"
            data-ocid="import.step4.back_button"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          {status === "done" && (
            <>
              <Button
                variant="outline"
                onClick={onReset}
                className="min-h-[44px] px-5"
                data-ocid="import.step4.import_again_button"
              >
                Import Another File
              </Button>
              <Button
                onClick={() => navigate({ to: "/shareholders" })}
                className="min-h-[44px] px-6 font-semibold"
                data-ocid="import.step4.view_shareholders_button"
              >
                <FileCheck2 className="w-4 h-4 mr-2" />
                View Shareholders
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Import history */}
      {batches && batches.length > 0 && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <p className="font-semibold text-sm text-foreground">
              Import History
            </p>
          </div>
          <div className="overflow-x-auto">
            <table
              className="min-w-full text-sm"
              data-ocid="import.history.table"
            >
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                    AGM Year
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                    File
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                    Total
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                    Imported
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                    Duplicates
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...batches]
                  .sort((a, b) => Number(b.uploadedAt) - Number(a.uploadedAt))
                  .map((b: ImportBatch, i) => (
                    <tr
                      key={b.id}
                      className="hover:bg-muted/30 transition-colors"
                      data-ocid={`import.history.item.${i + 1}`}
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {extractBatchYear(b.filename)}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground max-w-[180px] truncate">
                        {b.filename}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(b.uploadedAt)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {b.totalRows.toString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-primary">
                        {b.importedRows.toString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {b.duplicatesSkipped.toString()}
                      </td>
                      <td className="px-4 py-3">{statusBadge(b.status)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

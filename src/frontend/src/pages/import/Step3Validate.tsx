import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  SkipForward,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import type { MappedRow, ValidationResult } from "./types";
import { validateRows } from "./types";

const MAX_VISIBLE_VALIDATION_ROWS = 500;

interface Step3Props {
  mappedRows: MappedRow[];
  onBack: () => void;
  onNext: (validRows: MappedRow[], skipDuplicates: boolean) => void;
}

export function Step3Validate({ mappedRows, onBack, onNext }: Step3Props) {
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const result: ValidationResult = validateRows(mappedRows, skipDuplicates);
  const visibleDuplicates = result.duplicates.slice(0, MAX_VISIBLE_VALIDATION_ROWS);
  const visibleErrors = result.errors.slice(0, MAX_VISIBLE_VALIDATION_ROWS);

  const proceedCount =
    result.valid.length + (skipDuplicates ? 0 : result.duplicates.length);

  function handleProceed() {
    onNext(result.valid, skipDuplicates);
  }

  return (
    <div className="space-y-6" data-ocid="import.step3">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-card border border-border p-4 flex flex-col items-center gap-1">
          <CheckCircle2 className="w-7 h-7 text-primary" />
          <p className="font-display font-bold text-2xl text-foreground">
            {result.valid.length}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Valid rows
          </p>
        </div>
        <div
          className={cn(
            "rounded-xl border p-4 flex flex-col items-center gap-1",
            result.errors.length > 0
              ? "bg-destructive/10 border-destructive/30"
              : "bg-card border-border",
          )}
        >
          <XCircle
            className={cn(
              "w-7 h-7",
              result.errors.length > 0
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          />
          <p className="font-display font-bold text-2xl text-foreground">
            {result.errors.length}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            With errors
          </p>
        </div>
        <div
          className={cn(
            "rounded-xl border p-4 flex flex-col items-center gap-1",
            result.duplicates.length > 0
              ? "bg-accent/20 border-accent/30"
              : "bg-card border-border",
          )}
        >
          <AlertTriangle
            className={cn(
              "w-7 h-7",
              result.duplicates.length > 0
                ? "text-accent-foreground"
                : "text-muted-foreground",
            )}
          />
          <p className="font-display font-bold text-2xl text-foreground">
            {result.duplicates.length}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Duplicates
          </p>
        </div>
      </div>

      {/* Duplicate handling toggle */}
      {result.duplicates.length > 0 && (
        <div className="rounded-xl bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-foreground text-sm">
              Duplicate Shareholder Numbers
            </p>
            <button
              type="button"
              onClick={() => setSkipDuplicates((s) => !s)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-smooth min-h-[36px]",
                skipDuplicates
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-muted border-border text-muted-foreground",
              )}
              data-ocid="import.skip_duplicates.toggle"
            >
              <SkipForward className="w-3.5 h-3.5" />
              {skipDuplicates ? "Skipping duplicates" : "Include duplicates"}
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {visibleDuplicates.map((d, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: stable list order
                key={i}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40 text-sm"
                data-ocid={`import.duplicate.item.${i + 1}`}
              >
                <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {d.shareholderNumber}
                </span>
                <span className="text-muted-foreground truncate">
                  {d.data.fullName}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  Row {d.row}
                </span>
              </div>
            ))}
            {result.duplicates.length > visibleDuplicates.length && (
              <p className="text-xs text-muted-foreground px-1 pt-2">
                Showing first {visibleDuplicates.length.toLocaleString()} duplicate
                rows out of {result.duplicates.length.toLocaleString()}.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error rows */}
      {result.errors.length > 0 && (
        <div className="rounded-xl bg-card border border-destructive/30 p-4 space-y-3">
          <p className="font-semibold text-destructive text-sm">
            Rows with Errors (will be skipped)
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {visibleErrors.map((err, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: stable list order
                key={i}
                className="flex items-start gap-3 px-3 py-2 rounded-lg bg-destructive/10 text-sm"
                data-ocid={`import.error.item.${i + 1}`}
              >
                <span className="text-xs text-muted-foreground w-10 flex-shrink-0">
                  Row {err.row}
                </span>
                <span className="text-destructive text-xs break-words">
                  {err.message}
                </span>
              </div>
            ))}
            {result.errors.length > visibleErrors.length && (
              <p className="text-xs text-muted-foreground px-1 pt-2">
                Showing first {visibleErrors.length.toLocaleString()} error rows
                out of {result.errors.length.toLocaleString()}.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          className="min-h-[44px] px-5"
          data-ocid="import.step3.back_button"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button
          onClick={handleProceed}
          disabled={proceedCount === 0}
          className="min-h-[44px] px-6 font-semibold"
          data-ocid="import.step3.proceed_button"
        >
          Proceed with {result.valid.length} valid rows
        </Button>
      </div>
    </div>
  );
}

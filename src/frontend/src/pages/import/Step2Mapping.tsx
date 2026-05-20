import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import type { ColumnMapping, MappedRow, ParsedRow } from "./types";
import { TARGET_FIELDS, mapRow } from "./types";

interface Step2Props {
  headers: string[];
  rows: ParsedRow[];
  mapping: ColumnMapping;
  onMappingChange: (m: ColumnMapping) => void;
  onBack: () => void;
  onNext: (mapped: MappedRow[]) => void;
}

export function Step2Mapping({
  headers,
  rows,
  mapping,
  onMappingChange,
  onBack,
  onNext,
}: Step2Props) {
  const sampleRows = rows.slice(0, 5).map((r) => mapRow(r, mapping));
  const requiredMapped = TARGET_FIELDS.filter((f) => f.required).every(
    (f) => !!mapping[f.key],
  );

  function setField(key: keyof ColumnMapping, value: string) {
    onMappingChange({ ...mapping, [key]: value });
  }

  function handleNext() {
    const mapped = rows.map((r) => mapRow(r, mapping));
    onNext(mapped);
  }

  return (
    <div className="space-y-6" data-ocid="import.step2">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TARGET_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label
              htmlFor={`map-${field.key}`}
              className={cn(
                "text-sm font-medium",
                field.required ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {field.label}
              {field.required && (
                <span className="ml-1 text-destructive">*</span>
              )}
            </label>
            <select
              id={`map-${field.key}`}
              value={mapping[field.key]}
              onChange={(e) => setField(field.key, e.target.value)}
              className={cn(
                "w-full min-h-[44px] px-3 py-2 rounded-lg border bg-card text-foreground text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring transition-smooth",
                !mapping[field.key] && field.required
                  ? "border-destructive/60"
                  : "border-input",
              )}
              data-ocid={`import.mapping.${field.key}.select`}
            >
              <option value="">-- Not mapped --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Preview mapped */}
      {requiredMapped && sampleRows.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Mapped Data Preview (5 rows)
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {TARGET_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                    <th
                      key={f.key}
                      className="px-3 py-2 text-left text-xs font-semibold text-primary whitespace-nowrap"
                    >
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sampleRows.map((row, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: preview rows
                  <tr key={i} className="hover:bg-muted/30">
                    {TARGET_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <td
                        key={f.key}
                        className="px-3 py-2 text-foreground whitespace-nowrap max-w-[160px] truncate"
                      >
                        {String(row[f.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!requiredMapped && (
        <div
          className="rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive"
          data-ocid="import.step2.error_state"
        >
          Please map all required fields: Shareholder Number, Full Name, ID
          Number.
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          className="min-h-[44px] px-5"
          data-ocid="import.step2.back_button"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!requiredMapped}
          className="min-h-[44px] px-6 font-semibold"
          data-ocid="import.step2.next_button"
        >
          Validate Data
        </Button>
      </div>
    </div>
  );
}

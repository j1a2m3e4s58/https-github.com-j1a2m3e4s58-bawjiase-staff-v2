import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { label: "Upload", desc: "Select file" },
  { label: "Map", desc: "Column mapping" },
  { label: "Validate", desc: "Review & dedupe" },
  { label: "Import", desc: "Import data" },
];

export function StepIndicator({ current }: { current: number }) {
  return (
    <div
      className="flex items-center gap-0 w-full mb-8"
      data-ocid="import.step_indicator"
    >
      {STEPS.map((step, i) => {
        const stepNum = i + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <div key={step.label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center border-2 font-semibold text-sm transition-smooth",
                  done
                    ? "bg-primary border-primary text-primary-foreground"
                    : active
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-muted border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <p
                className={cn(
                  "text-xs mt-1 font-medium text-center hidden sm:block",
                  active
                    ? "text-primary"
                    : done
                      ? "text-primary/70"
                      : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
              <p className="text-[10px] text-muted-foreground hidden md:block text-center">
                {step.desc}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2 mt-[-20px] sm:mt-[-28px] transition-smooth",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

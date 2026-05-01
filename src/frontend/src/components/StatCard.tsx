import { cn } from "@/lib/utils";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  trend?: number;
  trendLabel?: string;
  className?: string;
  iconClassName?: string;
  "data-ocid"?: string;
}

export function StatCard({
  icon,
  value,
  label,
  trend,
  trendLabel,
  className,
  iconClassName,
  "data-ocid": ocid,
}: StatCardProps) {
  const trendDir =
    trend === undefined ? null : trend > 0 ? "up" : trend < 0 ? "down" : "flat";

  return (
    <div
      className={cn(
        "glass-card rounded-xl p-5 flex items-start gap-4",
        className,
      )}
      data-ocid={ocid}
    >
      <div
        className={cn(
          "flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center bg-primary/10",
          iconClassName,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-display font-bold text-foreground leading-none">
          {value}
        </div>
        <div className="text-xs text-muted-foreground mt-1 truncate">
          {label}
        </div>
        {trend !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 mt-1.5 text-xs font-medium",
              trendDir === "up" && "text-secondary",
              trendDir === "down" && "text-destructive",
              trendDir === "flat" && "text-muted-foreground",
            )}
          >
            {trendDir === "up" && <TrendingUp className="h-3 w-3" />}
            {trendDir === "down" && <TrendingDown className="h-3 w-3" />}
            {trendDir === "flat" && <Minus className="h-3 w-3" />}
            <span>
              {trend > 0 ? "+" : ""}
              {trend}%{trendLabel ? ` ${trendLabel}` : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

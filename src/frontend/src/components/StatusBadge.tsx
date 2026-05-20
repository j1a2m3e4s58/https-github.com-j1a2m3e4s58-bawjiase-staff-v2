import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, UserCheck, Users } from "lucide-react";

export enum SourceShareholderStatus {
  NotRegistered = "NotRegistered",
  RegisteredInPerson = "RegisteredInPerson",
  RegisteredProxy = "RegisteredProxy",
  CheckedIn = "CheckedIn",
}

interface StatusBadgeProps {
  status: SourceShareholderStatus | string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const CONFIG: Record<
  SourceShareholderStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    classes: string;
  }
> = {
  [SourceShareholderStatus.NotRegistered]: {
    label: "Not Registered",
    icon: Clock,
    classes: "bg-muted text-muted-foreground border-border",
  },
  [SourceShareholderStatus.RegisteredInPerson]: {
    label: "In-Person",
    icon: UserCheck,
    classes: "bg-blue-950/60 text-blue-300 border-blue-800",
  },
  [SourceShareholderStatus.RegisteredProxy]: {
    label: "Proxy",
    icon: Users,
    classes: "bg-amber-950/60 text-amber-300 border-amber-800",
  },
  [SourceShareholderStatus.CheckedIn]: {
    label: "Checked-In",
    icon: CheckCircle2,
    classes: "bg-primary/20 text-primary border-primary/40",
  },
};

const SIZE_CLASSES = {
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-sm px-2.5 py-1 gap-1.5",
  lg: "text-base px-3 py-1.5 gap-2",
};

const ICON_SIZE = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4",
};

function normalizeStatus(status: SourceShareholderStatus | string): SourceShareholderStatus {
  switch (status) {
    case "Checked In":
    case "CheckedIn":
      return SourceShareholderStatus.CheckedIn;
    case "Registered":
    case "RegisteredInPerson":
    case "In Person":
      return SourceShareholderStatus.RegisteredInPerson;
    case "RegisteredProxy":
    case "Proxy":
      return SourceShareholderStatus.RegisteredProxy;
    case "Not Registered":
    case "NotRegistered":
    default:
      return SourceShareholderStatus.NotRegistered;
  }
}

export function StatusBadge({
  status,
  size = "md",
  className,
}: StatusBadgeProps) {
  const normalized = normalizeStatus(status);
  const { label, icon: Icon, classes } = CONFIG[normalized];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        classes,
        SIZE_CLASSES[size],
        className,
      )}
    >
      <Icon className={ICON_SIZE[size]} />
      {label}
    </span>
  );
}

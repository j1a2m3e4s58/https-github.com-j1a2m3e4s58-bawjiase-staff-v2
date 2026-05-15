import { AgmSyncStatus } from "@/components/AgmSyncStatus";
import { AgmYearSwitcher } from "@/components/AgmYearSwitcher";
import { useAgmAuth } from "@/store/agm-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Cog,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  FileBarChart2,
  LogOut,
  Upload,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

const AGM_NAV_ITEMS = [
  {
    to: "/agm",
    label: "Overview",
    icon: <BriefcaseBusiness className="h-4 w-4" />,
  },
  {
    to: "/agm/dashboard",
    label: "Dashboard",
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    to: "/agm/board",
    label: "Board View",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    to: "/agm/registration",
    label: "Registration",
    icon: <UserPlus className="h-4 w-4" />,
  },
  {
    to: "/agm/checkin",
    label: "Check-In",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  {
    to: "/agm/shareholders",
    label: "Shareholders",
    icon: <Users className="h-4 w-4" />,
  },
  {
    to: "/agm/reports",
    label: "Reports",
    icon: <FileBarChart2 className="h-4 w-4" />,
  },
  {
    to: "/agm/import",
    label: "Import",
    icon: <Upload className="h-4 w-4" />,
  },
  {
    to: "/agm/admin",
    label: "Admin",
    icon: <Cog className="h-4 w-4" />,
  },
];

export function AgmSubnav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, logout } = useAgmAuth();

  async function handleLogout() {
    await logout();
    void navigate({ to: "/agm/login", replace: true });
  }

  return (
    <div className="panel-sharp glass-card flex flex-wrap items-center gap-2 p-2">
      {AGM_NAV_ITEMS.map((item) => {
        const isActive =
          item.to === "/agm"
            ? location.pathname === "/agm"
            : location.pathname.startsWith(item.to);

        return (
          <Button
            key={item.to}
            asChild
            variant="ghost"
            className={cn(
              "h-11 gap-2 px-4 text-sm font-semibold",
              isActive
                ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary"
                : "text-foreground/70 hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Link to={item.to}>
              {item.icon}
              {item.label}
            </Link>
          </Button>
        );
      })}
      <div className="ml-auto flex items-center gap-2">
        <AgmSyncStatus />
        <AgmYearSwitcher compact />
        {session ? (
          <span className="px-2 text-xs font-medium text-muted-foreground">
            {session.username}
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="h-11 gap-2 px-4 text-sm font-semibold text-foreground/70 hover:bg-muted/60 hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

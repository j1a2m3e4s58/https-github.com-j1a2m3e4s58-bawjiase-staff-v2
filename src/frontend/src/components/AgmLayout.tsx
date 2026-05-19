import { AgmSyncStatus } from "@/components/AgmSyncStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAgmYear } from "@/context/AgmYearContext";
import { withBase } from "@/lib/app-base";
import { AGM_UPDATED_EVENT, apiGetAgmSettings } from "@/lib/backend-client";
import { AGM_SUMMARY } from "@/lib/agm-module";
import { cn } from "@/lib/utils";
import { useAgmAuth } from "@/store/agm-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileBarChart2,
  LayoutDashboard,
  LogOut,
  Menu,
  Presentation,
  Settings,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const SIDEBAR_COLLAPSED_KEY = "bcb-agm-sidebar-collapsed";

const NAV_ITEMS = [
  { path: "/agm/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/agm/shareholders", label: "Shareholders", icon: Users },
  { path: "/agm/import", label: "Import", icon: Upload },
  { path: "/agm/registration", label: "Registration", icon: ClipboardList },
  { path: "/agm/board", label: "Board View", icon: Presentation },
  { path: "/agm/reports", label: "Reports", icon: FileBarChart2 },
  { path: "/agm/admin", label: "Admin", icon: Settings },
];

const MOBILE_QUICK_PATHS = [
  "/agm/dashboard",
  "/agm/registration",
  "/agm/shareholders",
  "/agm/reports",
];

const ROLE_LABEL: Record<string, string> = {
  SuperAdmin: "Super Admin",
  Admin: "Admin",
  RegistrationOfficer: "Officer",
  ReportsViewer: "Reports Viewer",
  BoardViewer: "Board Viewer",
  Viewer: "Viewer",
};

function NavItem({
  item,
  collapsed,
  onClick,
}: {
  item: (typeof NAV_ITEMS)[0];
  collapsed: boolean;
  onClick?: () => void;
}) {
  const location = useLocation();
  const isActive =
    location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={cn(
        "flex min-h-[44px] items-center gap-3 border border-transparent px-3 font-medium text-sm transition-smooth",
        collapsed ? "justify-center" : "",
        isActive
          ? "bg-primary/20 text-primary border-primary/30"
          : "text-foreground/70 hover:bg-muted hover:text-foreground",
      )}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
    >
      <Icon className={cn("flex-shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

export function AgmLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [agmName, setAgmName] = useState(AGM_SUMMARY.agmName);
  const [agmDate, setAgmDate] = useState(AGM_SUMMARY.agmDate);
  const { activeYear } = useAgmYear();
  const { session, logout } = useAgmAuth();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_KEY,
      collapsed ? "true" : "false",
    );
  }, [collapsed]);

  useEffect(() => {
    const load = () => {
      void apiGetAgmSettings().then((settings) => {
        setAgmName(settings.agmName || AGM_SUMMARY.agmName);
        setAgmDate(settings.agmDate || AGM_SUMMARY.agmDate);
      });
    };
    load();
    window.addEventListener(AGM_UPDATED_EVENT, load);
    return () => window.removeEventListener(AGM_UPDATED_EVENT, load);
  }, [activeYear]);

  const mobileQuickItems = useMemo(
    () => NAV_ITEMS.filter((item) => MOBILE_QUICK_PATHS.includes(item.path)),
    [],
  );

  async function handleLogout() {
    await logout();
  }

  const sidebarContent = (
    <>
      <div
        className={cn(
          "flex items-center gap-3 border-b border-border/50 px-3 py-4",
          collapsed ? "justify-center" : "",
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center flex-shrink-0 overflow-hidden border border-primary/20 bg-card/80">
          <img
            src={withBase("assets/images/bcb-logo.png")}
            alt="AGM logo"
            className="h-7 w-7 object-contain"
          />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold text-foreground">
              {agmName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {agmDate || "Annual General Meeting"}
            </p>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-4">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            collapsed={collapsed}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      <div
        className={cn(
          "border-t border-border/50 p-2",
          collapsed ? "flex flex-col items-center gap-2" : "",
        )}
      >
        {!collapsed && session ? (
          <div className="mb-1 px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">
              {session.username}
            </p>
            <Badge variant="secondary" className="mt-1 text-xs">
              {ROLE_LABEL[session.role] ?? session.role}
            </Badge>
          </div>
        ) : null}
        <Button
          asChild
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={cn(
            "min-h-[44px] w-full text-muted-foreground hover:bg-muted hover:text-foreground",
            collapsed ? "" : "justify-start gap-2 px-3",
          )}
          aria-label="Back to dashboard"
        >
          <Link to="/">
            <ArrowLeft className="h-4 w-4 flex-shrink-0" />
            {!collapsed && "Back to Dashboard"}
          </Link>
        </Button>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={handleLogout}
          className={cn(
            "min-h-[44px] w-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
            collapsed ? "" : "justify-start gap-2 px-3",
          )}
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && "Logout"}
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center border border-border bg-card shadow-sm hover:bg-muted lg:flex"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-transparent">
      <aside
        className={cn(
          "relative hidden flex-shrink-0 flex-col border-r border-border bg-card lg:flex",
          collapsed ? "w-16" : "w-56",
        )}
      >
        {sidebarContent}
      </aside>

      {mobileOpen ? (
        <div
          role="button"
          tabIndex={0}
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          onKeyDown={(event) => event.key === "Escape" && setMobileOpen(false)}
          aria-label="Close menu"
        />
      ) : null}

      <aside
        className={cn(
          "fixed bottom-0 left-0 top-0 z-50 flex w-[92vw] max-w-80 flex-col border-r border-border bg-card lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 p-2 hover:bg-muted"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        {sidebarContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-14 flex-shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center p-2 hover:bg-muted lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="max-w-[38vw] truncate font-display text-sm font-semibold text-foreground sm:max-w-[48vw] lg:max-w-none">
              {agmName}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle className="h-10 w-10" />
            <AgmSyncStatus />
            {session ? (
              <div className="hidden items-center gap-2 md:flex">
                <div className="flex h-7 w-7 items-center justify-center border border-primary/30 bg-primary/20">
                  <span className="text-xs font-semibold text-primary">
                    {session.username.slice(0, 1).toUpperCase()}
                  </span>
                </div>
                <span className="max-w-[120px] truncate text-sm text-muted-foreground">
                  {session.username}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {ROLE_LABEL[session.role] ?? session.role}
                </Badge>
              </div>
            ) : null}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background p-3 pb-24 sm:p-4 sm:pb-24 lg:p-6 lg:pb-6">
          {children}
        </main>

        {mobileQuickItems.length > 0 ? (
          <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
            <div
              className="grid gap-1 border-t border-border/70 bg-card/95 px-2 py-2 shadow-[0_-12px_32px_rgba(4,8,20,0.16)] backdrop-blur-xl"
              style={{
                gridTemplateColumns: `repeat(${mobileQuickItems.length}, minmax(0, 1fr))`,
              }}
            >
              {mobileQuickItems.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  location.pathname.startsWith(`${item.path}/`);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex min-h-[60px] flex-col items-center justify-center gap-1.5 border px-1 pb-1.5 pt-1 text-center",
                      isActive
                        ? "border-primary/35 bg-primary/95 text-primary-foreground shadow-[0_10px_24px_rgba(58,110,255,0.26)]"
                        : "border-transparent bg-transparent text-foreground/62",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center border",
                        isActive
                          ? "border-primary-foreground/18 bg-primary-foreground/10"
                          : "border-border/55 bg-background/45",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span
                      className={cn(
                        "font-display text-[10px] font-semibold uppercase tracking-[0.22em] leading-none",
                        isActive ? "text-primary-foreground" : "text-foreground/68",
                      )}
                    >
                      {item.label === "Registration"
                        ? "Register"
                        : item.label === "Shareholders"
                          ? "People"
                          : item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

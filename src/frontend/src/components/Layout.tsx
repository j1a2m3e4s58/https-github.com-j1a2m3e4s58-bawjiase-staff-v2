import { UserRole } from "@/types";
import { AnimatedAgmMark } from "@/components/AnimatedAgmMark";
import { SyncStatus } from "@/components/SyncStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-backend";
import { cn } from "@/lib/utils";
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
import { useEffect, useState } from "react";

const SIDEBAR_COLLAPSED_KEY = "agm-sidebar-collapsed";

const NAV_ITEMS = [
  { path: "/agm/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/agm/shareholders", label: "Shareholders", icon: Users },
  {
    path: "/agm/import",
    label: "Import",
    icon: Upload,
    roles: [UserRole.SuperAdmin, UserRole.Admin, UserRole.RegistrationOfficer],
  },
  {
    path: "/agm/registration",
    label: "Registration",
    icon: ClipboardList,
    roles: [UserRole.SuperAdmin, UserRole.Admin, UserRole.RegistrationOfficer],
  },
  {
    path: "/agm/board",
    label: "Board View",
    icon: Presentation,
    roles: [
      UserRole.SuperAdmin,
      UserRole.Admin,
      UserRole.ReportsViewer,
      UserRole.BoardViewer,
    ],
  },
  {
    path: "/agm/reports",
    label: "Reports",
    icon: FileBarChart2,
    roles: [
      UserRole.SuperAdmin,
      UserRole.Admin,
      UserRole.RegistrationOfficer,
      UserRole.ReportsViewer,
    ],
  },
  {
    path: "/agm/admin",
    label: "Admin",
    icon: Settings,
    roles: [UserRole.SuperAdmin, UserRole.Admin],
  },
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
    location.pathname === item.path ||
    (item.path !== "/agm/dashboard" && location.pathname.startsWith(item.path));
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 min-h-[44px] font-medium text-sm surface-highlight chamfer-sm",
        collapsed ? "justify-center" : "",
        isActive
          ? "bg-primary/20 text-primary border border-primary/30"
          : "text-foreground/70 hover:bg-muted hover:text-foreground border border-transparent",
      )}
      data-ocid={`nav.${item.label.toLowerCase().replace(/ /g, "-")}.link`}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
    >
      <Icon
        className={cn("flex-shrink-0", collapsed ? "w-5 h-5" : "w-4 h-4")}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { data: settings } = useSettings();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );
  const mobileQuickItems = visibleItems.filter((item) =>
    MOBILE_QUICK_PATHS.includes(item.path),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_KEY,
      collapsed ? "true" : "false",
    );
  }, [collapsed]);

  const sidebarContent = (
    <>
      {/* Logo area */}
      <div
        className={cn(
          "surface-highlight sea-shell flex items-center gap-3 px-3 py-4 border-b border-border/50",
          collapsed ? "justify-center" : "",
        )}
      >
        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
          <AnimatedAgmMark
            size={32}
            animate={false}
            className="border-none bg-transparent shadow-none"
            label="AGM logo"
          />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm text-foreground truncate">
              {settings?.agmName ?? "AGM Pro"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {settings?.agmDate ?? "Annual General Meeting"}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            collapsed={collapsed}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      {/* User area */}
      <div
        className={cn(
          "border-t border-border/50 p-2",
          collapsed ? "flex flex-col items-center gap-2" : "",
        )}
      >
        {!collapsed && user && (
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-foreground truncate">
              {user.username}
            </p>
            <Badge variant="secondary" className="mt-1 text-xs">
              {ROLE_LABEL[user.role] ?? user.role}
            </Badge>
          </div>
        )}
        <Button
          asChild
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={cn(
            "surface-highlight text-muted-foreground hover:text-foreground min-h-[44px] w-full",
            collapsed ? "" : "justify-start gap-2 px-3",
          )}
          data-ocid="nav.back_to_dashboard_button"
          aria-label="Back to dashboard"
        >
          <Link to="/">
            <ArrowLeft className="w-4 h-4 flex-shrink-0" />
            {!collapsed && "Back to Dashboard"}
          </Link>
        </Button>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={logout}
          className={cn(
            "surface-highlight text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-h-[44px] w-full",
            collapsed ? "" : "justify-start gap-2 px-3",
          )}
          data-ocid="nav.logout_button"
          aria-label="Logout"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && "Logout"}
        </Button>
      </div>

      {/* Collapse toggle (desktop) */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="hidden lg:flex items-center justify-center absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-card border border-border shadow-sm hover:bg-muted z-10 chamfer-sm"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </>
  );

  return (
    <div className="flex h-screen bg-transparent overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col relative bg-card border-r border-border flex-shrink-0 shell-panel sea-shell sea-outline",
          collapsed ? "w-16" : "w-56",
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          role="button"
          tabIndex={0}
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setMobileOpen(false)}
          aria-label="Close menu"
        />
      )}
      <aside
        className={cn(
          "fixed left-0 top-0 bottom-0 z-50 flex flex-col w-[92vw] max-w-80 bg-card border-r border-border lg:hidden shell-panel sea-shell sea-outline",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 p-2 hover:bg-muted chamfer-sm"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="shell-panel sea-shell sea-outline surface-highlight flex items-center justify-between px-3 sm:px-4 min-h-14 bg-card border-b border-border flex-shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center chamfer-sm"
              aria-label="Open menu"
              data-ocid="nav.mobile_menu_button"
            >
              <Menu className="w-5 h-5" />
            </button>
            <p className="font-display font-semibold text-foreground text-sm truncate max-w-[38vw] sm:max-w-[48vw] lg:max-w-none">
              {settings?.agmName ?? "AGM Pro"}
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <ThemeToggle />
            <SyncStatus />
            {user && (
              <div className="hidden md:flex items-center gap-2">
                <div className="w-7 h-7 bg-primary/20 border border-primary/30 flex items-center justify-center chamfer-sm">
                  <span className="text-xs font-semibold text-primary">
                    {user.username.slice(0, 1).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground truncate max-w-[120px]">
                  {user.username}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {ROLE_LABEL[user.role] ?? user.role}
                </Badge>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background p-3 pb-24 sm:p-4 sm:pb-24 lg:p-6 lg:pb-6">
          {children}
        </main>

        {mobileQuickItems.length > 0 && (
          <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
            <div
              className="sea-shell sea-outline grid gap-1 border-t border-border/70 bg-card/95 px-2 py-2 shadow-[0_-12px_32px_rgba(4,8,20,0.16)] backdrop-blur-xl dark:bg-[rgba(12,14,22,0.92)] dark:shadow-[0_-12px_32px_rgba(4,8,20,0.28)]"
              style={{
                gridTemplateColumns: `repeat(${mobileQuickItems.length}, minmax(0, 1fr))`,
              }}
            >
              {mobileQuickItems.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== "/agm/dashboard" &&
                    location.pathname.startsWith(item.path));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex min-h-[60px] flex-col items-center justify-center gap-1.5 border px-1 pt-1 pb-1.5 text-center",
                      isActive
                        ? "border-primary/35 bg-primary/95 text-primary-foreground shadow-[0_10px_24px_rgba(58,110,255,0.26)]"
                        : "border-transparent bg-transparent text-foreground/62 dark:text-foreground/72",
                    )}
                    data-ocid={`mobile.nav.${item.label.toLowerCase().replace(/ /g, "-")}.link`}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center border",
                        isActive
                          ? "border-primary-foreground/18 bg-primary-foreground/10"
                          : "border-border/55 bg-background/45 dark:bg-white/[0.03]",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span
                      className={cn(
                        "font-display text-[10px] font-semibold uppercase tracking-[0.22em] leading-none",
                        isActive
                          ? "text-primary-foreground"
                          : "text-foreground/68 dark:text-foreground/76",
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
        )}
      </div>
    </div>
  );
}

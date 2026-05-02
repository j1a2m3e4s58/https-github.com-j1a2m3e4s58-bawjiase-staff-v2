import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { withBase } from "@/lib/app-base";
import { resolveStoredAssetUrl } from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  GraduationCap,
  HeadphonesIcon,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { User as PortalUser } from "@/types";

const BRAND_LOGO = withBase("assets/images/bcb-logo.png");

// ── Nav Config ─────────────────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles?: string[];
  departments?: string[];
  bottomNav?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
    bottomNav: true,
  },
  {
    to: "/announcements",
    label: "Announcements",
    icon: <Megaphone className="h-5 w-5" />,
  },
  {
    to: "/directory",
    label: "Staff Directory",
    icon: <Users className="h-5 w-5" />,
    bottomNav: true,
  },
  {
    to: "/training",
    label: "Training",
    icon: <GraduationCap className="h-5 w-5" />,
    bottomNav: true,
  },
  {
    to: "/forms",
    label: "Forms Centre",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    to: "/notifications",
    label: "Notifications",
    icon: <Bell className="h-5 w-5" />,
    bottomNav: true,
  },
  {
    to: "/support",
    label: "IT Support",
    icon: <HeadphonesIcon className="h-5 w-5" />,
  },
  {
    to: "/audit",
    label: "Audit Logs",
    icon: <ClipboardList className="h-5 w-5" />,
    departments: ["IT"],
  },
  {
    to: "/backup",
    label: "Backup Center",
    icon: <Download className="h-5 w-5" />,
    roles: ["SuperAdmin", "HRAdmin"],
  },
  {
    to: "/profile",
    label: "Profile",
    icon: <User className="h-5 w-5" />,
  },
];

// ── BCB Badge ─────────────────────────────────────────────────────────────────

function BCBBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };
  return (
    <div
      className={cn(
        "overflow-hidden rounded-full border-2 border-primary/25 bg-white ring-2 ring-primary/10",
        sizes[size],
      )}
    >
      <img
        src={BRAND_LOGO}
        alt="Bawjiase Community Bank logo"
        className="h-full w-full object-cover"
        decoding="async"
      />
    </div>
  );
}

function canSeeNavItem(user: PortalUser | null, item: NavItem) {
  if (item.roles && (!user || !item.roles.includes(user.role))) return false;
  if (
    item.departments &&
    (!user || !item.departments.includes(user.department.toUpperCase()))
  ) {
    return false;
  }
  return true;
}

function logoutAndRedirect(logout: () => void) {
  logout();
  window.location.replace(withBase("login"));
}


// ── Sidebar ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed?: boolean;
}

function Sidebar({ collapsed = false }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const initials =
    user?.fullname
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "U";

  const visibleItems = NAV_ITEMS.filter((item) => canSeeNavItem(user, item));
  const userImage = resolveStoredAssetUrl(user?.imageFile);

  return (
    <aside
      className={cn(
        "flex flex-col h-full glass-card-elevated border-r border-border/50",
        collapsed ? "w-16" : "w-64",
        "transition-all duration-300",
      )}
      data-ocid="appshell.sidebar"
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-3 p-4 border-b border-border/30",
          collapsed && "justify-center",
        )}
      >
        <BCBBadge size="md" />
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-display font-bold text-foreground text-sm leading-tight">
              BCB
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Rural Bank
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-smooth group",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-foreground/70 hover:bg-muted/60 hover:text-foreground",
                collapsed && "justify-center px-2",
              )}
              data-ocid={`nav.${item.label.toLowerCase().replace(/\s+/g, "_")}.link`}
            >
              <span
                className={cn(
                  "flex-shrink-0",
                  isActive
                    ? "text-primary"
                    : "text-foreground/60 group-hover:text-foreground",
                )}
              >
                {item.icon}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && isActive && (
                <ChevronRight className="h-3.5 w-3.5 ml-auto text-primary/60" />
              )}
            </Link>
          );
        })}
      </nav>

      <Separator className="opacity-30" />

      {/* Footer */}
      <div
        className={cn(
          "p-3 space-y-1",
          collapsed && "flex flex-col items-center",
        )}
      >
        <ThemeToggle className="w-full justify-start gap-3" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center gap-3 w-full px-2 py-2 rounded-lg hover:bg-muted/60 transition-smooth text-left",
                collapsed && "justify-center",
              )}
              data-ocid="appshell.user_menu.button"
            >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  {userImage ? (
                    <AvatarImage key={userImage} src={userImage} alt={user?.fullname ?? "User"} />
                  ) : null}
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground truncate">
                    {user?.fullname}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {user?.role === "SuperAdmin"
                      ? "Super Admin"
                      : user?.role === "HRAdmin"
                        ? "HR Admin"
                        : "Staff"}
                  </div>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-52">
            <DropdownMenuItem asChild>
              <Link to="/profile" data-ocid="appshell.user_menu.profile_link">
                <User className="h-4 w-4 mr-2" />
                My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={logout}
              data-ocid="appshell.user_menu.logout_button"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

// ── Mobile Bottom Nav ──────────────────────────────────────────────────────────

void Sidebar;

function MobileBottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const bottomItems = NAV_ITEMS.filter((i) => i.bottomNav).slice(0, 5);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-card-elevated border-t border-border/30 flex items-stretch px-1"
      style={{ height: 64, paddingBottom: "env(safe-area-inset-bottom)" }}
      data-ocid="appshell.bottom_nav"
    >
      {bottomItems.map((item) => {
        const isActive =
          item.to === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.to);
        const isVisible = canSeeNavItem(user, item);
        if (!isVisible) return null;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-smooth",
              isActive ? "text-primary" : "text-muted-foreground",
            )}
            data-ocid={`bottom_nav.${item.label.toLowerCase().replace(/\s+/g, "_")}.link`}
          >
            <span
              className={cn(
                "panel-sharp p-1 transition-smooth",
                isActive && "bg-primary/10",
              )}
            >
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── Mobile Drawer ──────────────────────────────────────────────────────────────

function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const visibleItems = NAV_ITEMS.filter((item) => canSeeNavItem(user, item));

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" />
      <div
        ref={drawerRef}
        className="relative flex h-full w-72 flex-col glass-card-elevated animate-slide-up"
        data-ocid="appshell.mobile_drawer"
      >
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <BCBBadge size="md" />
            <div>
              <div className="font-display font-bold text-sm">BCB</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Staff Portal
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-ocid="appshell.mobile_drawer.close_button"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {visibleItems.map((item) => {
            const isActive =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={cn(
                  "panel-sharp flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-smooth",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-foreground/70 hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <Separator className="opacity-30" />
        <div className="p-4 space-y-2">
          <ThemeToggle className="w-full justify-start gap-3" />
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive"
            onClick={() => {
              onClose();
              logoutAndRedirect(logout);
            }}
            data-ocid="appshell.mobile_drawer.logout_button"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Top Bar ────────────────────────────────────────────────────────────────────

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const initials =
    user?.fullname
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "U";
  const userImage = resolveStoredAssetUrl(user?.imageFile);

  return (
    <header
      className="sticky top-0 z-40 glass-card border-b border-border/30 px-4 py-3 backdrop-blur-xl"
      data-ocid="appshell.topbar"
    >
      <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            data-ocid="appshell.menu_button"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div className="min-w-0">
          <span className="block truncate font-display text-sm font-semibold text-foreground/70">
            Bawjiase Area Rural Bank PLC
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="panel-sharp flex items-center gap-2 pl-2 transition-smooth hover:bg-muted/60"
              data-ocid="appshell.topbar.user_menu.button"
            >
                <Avatar className="h-7 w-7">
                  {userImage ? (
                    <AvatarImage key={userImage} src={userImage} alt={user?.fullname ?? "User"} />
                  ) : null}
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!isMobile && (
                <span className="text-xs font-medium text-foreground max-w-[120px] truncate pr-1">
                  {user?.fullname}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link
                to="/profile"
                data-ocid="appshell.topbar.user_menu.profile_link"
              >
                <User className="h-4 w-4 mr-2" />
                My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => logoutAndRedirect(logout)}
              data-ocid="appshell.topbar.user_menu.logout_button"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </div>
    </header>
  );
}

// ── AppShell ───────────────────────────────────────────────────────────────────

function DesktopTopNav() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const initials =
    user?.fullname
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "U";
  const userImage = resolveStoredAssetUrl(user?.imageFile);
  const topNavItems: NavItem[] = [
    {
      to: "/",
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      to: "/training",
      label: "Training Portal",
      icon: <GraduationCap className="h-4 w-4" />,
    },
    {
      to: "/directory",
      label: "Staff Directory",
      icon: <Users className="h-4 w-4" />,
    },
    {
      to: "/forms",
      label: "Forms Centre",
      icon: <FileText className="h-4 w-4" />,
    },
    {
      to: "/handbook",
      label: "Handbook",
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      to: "/audit",
      label: "Audit Logs",
      icon: <ClipboardList className="h-4 w-4" />,
      departments: ["IT"],
    },
  ];
  const visibleItems = topNavItems.filter((item) => canSeeNavItem(user, item));

  return (
    <header className="sticky top-4 z-40 mx-4 mt-4 panel-sharp-lg glass-card-elevated overflow-hidden border border-border/40 px-4 py-3">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex min-w-[220px] shrink-0 items-center gap-3">
          <BCBBadge size="md" />
          <div className="min-w-0">
            <div className="font-display font-bold text-sm text-foreground leading-tight">
              BAWJIASE
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Community Bank PLC
            </div>
          </div>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center justify-center gap-1">
          {visibleItems.map((item) => {
            const isActive =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={`${item.to}-${item.label}`}
                to={item.to}
                className={cn(
                  "panel-sharp inline-flex min-h-11 items-center justify-center gap-2 px-2 text-[12px] font-semibold whitespace-nowrap transition-smooth lg:px-2.5 xl:px-3 xl:text-sm",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-foreground/70 hover:bg-muted/60 hover:text-foreground",
                )}
                data-ocid={`topnav.${item.label.toLowerCase().replace(/\s+/g, "_")}.link`}
              >
                <span className="h-4 w-4 shrink-0 flex items-center justify-center">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex min-w-[190px] shrink-0 items-center justify-end gap-2">
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="panel-sharp flex items-center gap-2 border border-border/40 bg-muted/30 py-1.5 pl-1.5 pr-3 transition-smooth hover:bg-muted/60"
                data-ocid="appshell.desktop_user_menu.button"
              >
                  <Avatar className="h-9 w-9">
                    {userImage ? (
                      <AvatarImage key={userImage} src={userImage} alt={user?.fullname ?? "User"} />
                    ) : null}
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left min-w-0">
                  <div className="text-xs font-bold text-foreground max-w-[84px] truncate">
                    {user?.fullname}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">
                    {user?.department}
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/profile">
                  <User className="h-4 w-4 mr-2" />
                  My Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => logoutAndRedirect(logout)}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="app-shell-surface min-h-screen flex">
      {/* Mobile Drawer */}
      {isMobile && (
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {isMobile && <TopBar onMenuClick={() => setDrawerOpen(true)} />}
        {!isMobile && <DesktopTopNav />}
        <main
          className={cn("flex-1 overflow-y-auto p-4 md:p-6 lg:p-7 xl:px-8", isMobile && "pb-20")}
          data-ocid="appshell.main_content"
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && <MobileBottomNav />}

      <Toaster richColors position="top-right" />
    </div>
  );
}

import { BrandLoader } from "@/components/BrandLoader";
import { RouteLoadingBar } from "@/components/RouteLoadingBar";
import { appBasePath, withBase } from "@/lib/app-base";
import { AuthProvider, useAuth } from "@/store/auth";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
} from "@tanstack/react-router";
import { Suspense, lazy, useEffect } from "react";

const FRONTEND_ERROR_KEY = "bcb_last_frontend_error";

interface FrontendErrorSnapshot {
  id: string;
  message: string;
  path: string;
  timestamp: number;
}

function readLastFrontendError(): FrontendErrorSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FRONTEND_ERROR_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FrontendErrorSnapshot;
  } catch {
    return null;
  }
}

function writeFrontendError(message: string) {
  if (typeof window === "undefined") return;
  const snapshot: FrontendErrorSnapshot = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    path: window.location.pathname,
    timestamp: Date.now(),
  };
  try {
    window.localStorage.setItem(FRONTEND_ERROR_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage issues and keep the app usable.
  }
}

function lazyPage<TModule extends { default: React.ComponentType<any> }>(
  cacheKey: string,
  factory: () => Promise<TModule>,
) {
  return lazy(async () => {
    try {
      const loaded = await factory();
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(`bcb:lazy-reload:${cacheKey}`);
      }
      return loaded;
    } catch (error) {
      if (typeof window !== "undefined") {
        console.error("Lazy page load failed:", cacheKey, error);
        const reloadKey = `bcb:lazy-reload:${cacheKey}`;
        if (!window.sessionStorage.getItem(reloadKey)) {
          window.sessionStorage.setItem(reloadKey, "1");
          window.location.reload();
        }
      }
      throw error;
    }
  });
}

// ── Lazy Pages ─────────────────────────────────────────────────────────────────

const LoginPage = lazyPage("login", () => import("@/pages/LoginPage"));
const RegisterPage = lazyPage("register", () => import("@/pages/RegisterPage"));
const ForgotPasswordPage = lazyPage(
  "forgot-password",
  () => import("@/pages/ForgotPasswordPage"),
);
const ResetPasswordPage = lazyPage(
  "reset-password",
  () => import("@/pages/ResetPasswordPage"),
);
const VerifyEmailPage = lazyPage(
  "verify-email",
  () => import("@/pages/VerifyEmailPage"),
);
const DashboardPage = lazyPage("dashboard", () => import("@/pages/DashboardPage"));
const AnnouncementsPage = lazyPage(
  "announcements",
  () => import("@/pages/AnnouncementsPage"),
);
const NewsPortalPage = lazyPage("news-portal", () => import("@/pages/NewsPortalPage"));
const AnnouncementsTrashPage = lazyPage(
  "announcements-trash",
  () => import("@/pages/AnnouncementsTrashPage"),
);
const FormsPage = lazyPage("forms", () => import("@/pages/FormsPage"));
const DirectoryPage = lazyPage("directory", () => import("@/pages/DirectoryPage"));
const SupervisorManagementPage = lazyPage(
  "supervisors",
  () => import("@/pages/SupervisorManagementPage"),
);
const PastStaffPage = lazyPage("past-staff", () => import("@/pages/PastStaffPage"));
const NotificationsPage = lazyPage(
  "notifications",
  () => import("@/pages/NotificationsPage"),
);
const ProfilePage = lazyPage("profile", () => import("@/pages/ProfilePage"));
const TrainingHubPage = lazyPage("training", () => import("@/pages/TrainingHubPage"));
const TrainingVideoPage = lazyPage(
  "training-video",
  () => import("@/pages/TrainingVideoPage"),
);
const TrainingDocumentPage = lazyPage(
  "training-document",
  () => import("@/pages/TrainingDocumentPage"),
);
const TrainingUploadVideoPage = lazyPage(
  "training-upload-video",
  () => import("@/pages/TrainingUploadVideoPage"),
);
const TrainingUploadDocumentPage = lazyPage(
  "training-upload-document",
  () => import("@/pages/TrainingUploadDocumentPage"),
);
const TrainingAdminPage = lazyPage(
  "training-admin",
  () => import("@/pages/TrainingAdminPage"),
);
const SupportPage = lazyPage("support", () => import("@/pages/SupportPage"));
const SupportAdminPage = lazyPage(
  "support-admin",
  () => import("@/pages/SupportAdminPage"),
);
const AuditLogsPage = lazyPage("audit", () => import("@/pages/AuditLogsPage"));
const BackupCenterPage = lazyPage("backup", () => import("@/pages/BackupCenterPage"));

// ── Loading Fallback ───────────────────────────────────────────────────────────

function PageLoading() {
  return <BrandLoader fullscreen label="Opening your workspace..." />;
}

function AppErrorScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const recentError = readLastFrontendError();
  return (
    <div className="min-h-screen bg-background px-6 py-10 flex items-center justify-center">
      <div className="glass-card-elevated panel-sharp-lg max-w-lg w-full rounded-2xl p-8 text-center space-y-4">
        <img
          src={withBase("assets/images/bcb-logo.png")}
          alt="BCB Staff Portal"
          className="mx-auto h-20 w-20 rounded-full object-cover border-4 border-background shadow-glass"
        />
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-foreground">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground leading-6">
            {description}
          </p>
          {recentError ? (
        <div className="panel-sharp rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-left text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">
                Crash reference: {recentError.id}
              </div>
              <div className="mt-1">Path: {recentError.path}</div>
              <div className="mt-1">
                Logged:{" "}
                {new Date(recentError.timestamp).toLocaleString("en-GB")}
              </div>
              <div className="mt-2 line-clamp-3">{recentError.message}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RouteErrorComponent() {
  return (
    <AppErrorScreen
      title="We hit a page error"
      description="The portal could not render this page properly. Please refresh once. If it keeps happening, the deploy configuration or a runtime page error still needs attention."
    />
  );
}

function FrontendCrashMonitor() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      writeFrontendError(
        event.error?.stack || event.message || "Unknown frontend error",
      );
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? event.reason.stack || event.reason.message
          : typeof event.reason === "string"
            ? event.reason
            : JSON.stringify(event.reason);
      writeFrontendError(reason || "Unhandled promise rejection");
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}

function RouteNotFoundComponent() {
  return (
    <AppErrorScreen
      title="Page not found"
      description="This route is not being served correctly yet. On Render, that usually means the rewrite rule or deploy output needs adjustment."
    />
  );
}

// ── Auth Guards (component-based, using useNavigate) ──────────────────────────

function AuthGuard() {
  const { isLoggedIn, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      navigate({ to: "/login", replace: true });
    }
  }, [isLoggedIn, isLoading, navigate]);

  if (isLoading) return <PageLoading />;
  if (!isLoggedIn) return <PageLoading />;
  return (
    <Suspense fallback={<PageLoading />}>
      <Outlet />
    </Suspense>
  );
}

function GuestGuard() {
  const { isLoggedIn, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      navigate({ to: "/", replace: true });
    }
  }, [isLoggedIn, isLoading, navigate]);

  if (isLoading) return <PageLoading />;
  if (isLoggedIn) return <PageLoading />;
  return (
    <Suspense fallback={<PageLoading />}>
      <Outlet />
    </Suspense>
  );
}

// ── Route Tree ─────────────────────────────────────────────────────────────────

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: RouteNotFoundComponent,
  errorComponent: RouteErrorComponent,
});

// Guest routes (redirect to / if already logged in)
const guestRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "guest",
  component: GuestGuard,
});

const loginRoute = createRoute({
  getParentRoute: () => guestRoute,
  path: "/login",
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => guestRoute,
  path: "/register",
  component: RegisterPage,
});

const forgotRoute = createRoute({
  getParentRoute: () => guestRoute,
  path: "/forgot-password",
  component: ForgotPasswordPage,
});

const resetRoute = createRoute({
  getParentRoute: () => guestRoute,
  path: "/reset-password",
  component: ResetPasswordPage,
});

const verifyRoute = createRoute({
  getParentRoute: () => guestRoute,
  path: "/verify-email",
  component: VerifyEmailPage,
});

// Protected routes
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  component: AuthGuard,
});

const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/",
  component: DashboardPage,
});

const announcementsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/announcements",
  component: AnnouncementsPage,
});

const newsPortalRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/news-portal",
  component: NewsPortalPage,
});

const announcementsTrashRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/announcements/trash",
  component: AnnouncementsTrashPage,
});

const directoryRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/directory",
  component: DirectoryPage,
});

const directoryPastRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/directory/past-staff",
  component: PastStaffPage,
});

const supervisorManagementRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/directory/supervisors",
  component: SupervisorManagementPage,
});

const trainingRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/training",
  component: TrainingHubPage,
});

const handbookRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/handbook",
  component: TrainingHubPage,
});

const trainingVideoRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/training/video/$id",
  component: TrainingVideoPage,
});

const trainingDocumentRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/training/document/$id",
  component: TrainingDocumentPage,
});

const trainingUploadVideoRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/training/upload-video",
  component: TrainingUploadVideoPage,
});

const trainingUploadDocumentRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/training/upload-document",
  component: TrainingUploadDocumentPage,
});

const trainingAdminRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/training/admin",
  component: TrainingAdminPage,
});

const formsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/forms",
  component: FormsPage,
});

const notificationsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/notifications",
  component: NotificationsPage,
});

const supportRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/support",
  component: SupportPage,
});

const supportIncidentRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/support/incident",
  component: SupportPage,
});

const supportAmendmentRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/support/amendment",
  component: SupportPage,
});

const supportAdminRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/support/admin",
  component: SupportAdminPage,
});

const auditRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/audit",
  component: AuditLogsPage,
});

const backupRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/backup",
  component: BackupCenterPage,
});

const profileRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/profile",
  component: ProfilePage,
});

// ── Router ────────────────────────────────────────────────────────────────────

const routeTree = rootRoute.addChildren([
  guestRoute.addChildren([
    loginRoute,
    registerRoute,
    forgotRoute,
    resetRoute,
    verifyRoute,
  ]),
  protectedRoute.addChildren([
    dashboardRoute,
    announcementsRoute,
    newsPortalRoute,
    announcementsTrashRoute,
    directoryRoute,
    directoryPastRoute,
    supervisorManagementRoute,
    trainingRoute,
    handbookRoute,
    trainingVideoRoute,
    trainingDocumentRoute,
    trainingUploadVideoRoute,
    trainingUploadDocumentRoute,
    trainingAdminRoute,
    formsRoute,
    notificationsRoute,
    supportRoute,
    supportIncidentRoute,
    supportAmendmentRoute,
    supportAdminRoute,
    auditRoute,
    backupRoute,
    profileRoute,
  ]),
]);

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  basepath: appBasePath,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <FrontendCrashMonitor />
      <RouterProvider router={router}>
        <RouteLoadingBar />
      </RouterProvider>
    </AuthProvider>
  );
}

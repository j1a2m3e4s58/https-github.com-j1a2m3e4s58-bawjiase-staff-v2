import { AppSplashScreen } from "@/components/AppSplashScreen";
import { useAuth } from "@/hooks/use-auth";
import { Navigate, useLocation } from "@tanstack/react-router";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const {
    user,
    isLoading,
    mustChangePassword,
    requiresPhoneVerification,
    sessionToken,
  } = useAuth();
  const location = useLocation();

  if (isLoading && sessionToken && user) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <AppSplashScreen label="Restoring secure session" />;
  }

  if (!sessionToken || !user) {
    return <Navigate to="/agm/login" search={{ redirect: location.pathname }} />;
  }

  if (mustChangePassword && location.pathname !== "/agm/change-password") {
    return <Navigate to="/agm/change-password" />;
  }

  if (requiresPhoneVerification && location.pathname !== "/agm/change-password") {
    return <Navigate to="/agm/change-password" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/agm/dashboard" />;
  }

  return <>{children}</>;
}

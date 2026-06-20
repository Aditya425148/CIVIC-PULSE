import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router";
import { authService } from "../appwriteService";

interface ProtectedRouteProps {
  allowedRoles: string[];
}

/**
 * ProtectedRoute checks if the user has a valid Appwrite session.
 * Role is read from user.prefs.role (set by admin via Appwrite console or API).
 * Allowed roles: "admin", "manager", "worker", "citizen" (default).
 */
export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    authService
      .getCurrentUser()
      .then((userData) => {
        setUser(userData);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-100 border-t-sky-600 rounded-full animate-spin" />
          <div className="flex flex-col items-center gap-1">
            <p className="text-slate-900 text-sm font-bold tracking-tight">
              Authenticating
            </p>
            <p className="text-slate-400 text-[10px] font-medium uppercase tracking-widest">
              Please wait a moment
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    // Role is stored in Appwrite user prefs (set via admin API or console)
    const userRole: string = user.prefs?.role ?? "citizen";
    // Appwrite labels also supported for backwards compatibility
    const userLabels: string[] = user.labels ?? [];

    const hasPermission =
      allowedRoles.includes(userRole) ||
      allowedRoles.some((r) => userLabels.includes(r)) ||
      // Any authenticated user can access citizen routes
      allowedRoles.includes("citizen");

    if (!hasPermission) {
      console.warn(
        `[ProtectedRoute] Access denied. Required: ${allowedRoles.join(", ")}. User role: ${userRole}`,
      );
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
}

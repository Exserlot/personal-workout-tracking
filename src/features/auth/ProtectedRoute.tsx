import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-6 text-ink" aria-live="polite">
        <p className="text-sm font-semibold tracking-[0.08em] text-ink-secondary">กำลังตรวจสอบ SESSION…</p>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: `${location.pathname}${location.search}` }} replace />;
  }

  return <Outlet />;
}

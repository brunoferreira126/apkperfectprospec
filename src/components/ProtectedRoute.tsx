import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page-loader"><span className="loader-mark">P</span><span>Verificando acesso seguro…</span></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

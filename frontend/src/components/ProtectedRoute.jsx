import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasOfflineSession, isAuthenticated } from "../utils/authStorage";

export default function ProtectedRoute() {
  const location = useLocation();

  if (!isAuthenticated() && !hasOfflineSession()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

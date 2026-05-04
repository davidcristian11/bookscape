import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated } from "../utils/authStorage";

export default function PublicOnlyRoute() {
  if (isAuthenticated()) {
    return <Navigate to="/library" replace />;
  }

  return <Outlet />;
}
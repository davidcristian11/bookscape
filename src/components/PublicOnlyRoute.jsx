import { Navigate, Outlet } from "react-router-dom";
import { getAuthToken } from "../utils/authStorage";

export default function PublicOnlyRoute() {
  if (getAuthToken()) {
    return <Navigate to="/library" replace />;
  }

  return <Outlet />;
}

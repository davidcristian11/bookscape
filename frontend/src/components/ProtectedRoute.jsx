import { Navigate, Outlet, useLocation } from "react-router-dom";
import {
  getStoredUser,
  hasOfflineSession,
  isAuthenticated,
} from "../utils/authStorage";
import "./Library.css";

function hasRole(user, role) {
  return Boolean(user?.role === role || user?.roles?.includes(role));
}

export default function ProtectedRoute({ requiredRole = null }) {
  const location = useLocation();

  if (!isAuthenticated() && !hasOfflineSession()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredRole && !hasRole(getStoredUser(), requiredRole)) {
    return (
      <div className="library-container">
        <section className="review-card restricted-card">
          <span className="section-kicker">Restricted</span>
          <h1>Admin Access Required</h1>
          <p className="page-subtitle">
            Observation and log review is available only to administrator accounts.
          </p>
        </section>
      </div>
    );
  }

  return <Outlet />;
}

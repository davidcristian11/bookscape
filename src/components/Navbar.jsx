import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { logoutUser } from "../api/authApi";
import {
  clearAuthSession,
  getAuthToken,
  getStoredUser,
  isAuthenticated,
} from "../utils/authStorage";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [authenticated, setAuthenticated] = useState(isAuthenticated());
  const [user, setUser] = useState(getStoredUser());

  useEffect(() => {
    setAuthenticated(isAuthenticated());
    setUser(getStoredUser());
  }, [location.pathname]);

  const handleLogout = async () => {
    const token = getAuthToken();

    try {
      if (token) {
        await logoutUser(token);
      }
    } catch {
      // chiar dacă requestul pică, curățăm sesiunea locală
    } finally {
      clearAuthSession();
      setAuthenticated(false);
      setUser(null);
      navigate("/login");
    }
  };

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem 2rem",
        borderBottom: "1px solid #e5e5e5",
        background: "white",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link
          to="/"
          style={{
            textDecoration: "none",
            fontWeight: "bold",
            fontSize: "1.2rem",
            color: "#1f2937",
          }}
        >
          BookScape
        </Link>

        {authenticated && (
          <>
            <Link to="/library" style={{ textDecoration: "none", color: "#374151" }}>
              Library
            </Link>
            <Link to="/insights" style={{ textDecoration: "none", color: "#374151" }}>
              Insights
            </Link>
            <Link to="/nexus" style={{ textDecoration: "none", color: "#374151" }}>
              Idea Nexus
            </Link>
          </>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {authenticated ? (
          <>
            <span style={{ color: "#6b7280" }}>
              {user ? `Hi, ${user.name}` : "Logged in"}
            </span>
            <button
              onClick={handleLogout}
              style={{
                border: "none",
                background: "#ef4444",
                color: "white",
                padding: "0.55rem 1rem",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ textDecoration: "none", color: "#374151" }}>
              Login
            </Link>
            <Link
              to="/register"
              style={{
                textDecoration: "none",
                background: "#10b981",
                color: "white",
                padding: "0.55rem 1rem",
                borderRadius: "6px",
                fontWeight: "bold",
              }}
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
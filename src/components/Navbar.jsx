import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { logoutUser } from "../api/authApi";
import {
  clearAuthSession,
  getAuthToken,
  getStoredUser,
  isAuthenticated,
} from "../utils/authStorage";
import "./Navbar.css";

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
      // Clear the local session even if the in-memory backend already restarted.
    } finally {
      clearAuthSession();
      setAuthenticated(false);
      setUser(null);
      navigate("/login");
    }
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <motion.nav
      className="navbar"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
    >
      <div className="navbar-left">
        <Link to="/" className="navbar-brand" aria-label="BookScape home">
          <span className="brand-mark" aria-hidden="true">
            BS
          </span>
          <span className="logo-text">BookScape</span>
        </Link>

        {authenticated && (
          <div className="navbar-links" aria-label="Primary navigation">
            <Link to="/library" className={`nav-link ${isActive("/library") ? "active" : ""}`}>
              Library
            </Link>
            <Link to="/insights" className={`nav-link ${isActive("/insights") ? "active" : ""}`}>
              Insights
            </Link>
            <Link to="/nexus" className={`nav-link ${isActive("/nexus") ? "active" : ""}`}>
              Idea Nexus
            </Link>
          </div>
        )}
      </div>

      <div className="navbar-actions">
        {authenticated ? (
          <>
            <span className="nav-user">{user ? `Hi, ${user.name}` : "Logged in"}</span>
            <motion.button
              type="button"
              onClick={handleLogout}
              className="nav-link-button sign-out"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              Logout
            </motion.button>
          </>
        ) : (
          <>
            <Link to="/login" className={`nav-link ${isActive("/login") ? "active" : ""}`}>
              Login
            </Link>
            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
              <Link to="/register" className="nav-btn-solid">
                Register
              </Link>
            </motion.div>
          </>
        )}
      </div>
    </motion.nav>
  );
}

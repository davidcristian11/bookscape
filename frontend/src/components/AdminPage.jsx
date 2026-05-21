import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { getAdminLogs, getObservationList } from "../api/adminApi";
import { getStoredUser } from "../utils/authStorage";
import "./Library.css";

function isAdmin(user) {
  return Boolean(user?.is_admin || user?.role === "admin" || user?.roles?.includes("admin"));
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "N/A";
}

export default function AdminPage() {
  const shouldReduceMotion = useReducedMotion();
  const [user] = useState(() => getStoredUser());
  const [observations, setObservations] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(isAdmin(user));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAdmin(user)) {
      return;
    }

    let disposed = false;
    async function loadAdminData() {
      try {
        setLoading(true);
        setError("");
        const [observationData, logData] = await Promise.all([
          getObservationList(),
          getAdminLogs(75),
        ]);
        if (!disposed) {
          setObservations(observationData);
          setLogs(logData);
        }
      } catch (err) {
        if (!disposed) {
          setError(err.message || "Failed to load admin data.");
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    loadAdminData();

    return () => {
      disposed = true;
    };
  }, [user]);

  const motionProps = shouldReduceMotion
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

  if (!isAdmin(user)) {
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

  return (
    <div className="library-container admin-page">
      <header className="library-header page-header">
        <div>
          <span className="section-kicker">Admin</span>
          <h1>Observation Desk</h1>
          <p className="page-subtitle">
            Review users flagged by suspicious activity rules and inspect recent persisted actions.
          </p>
        </div>
      </header>

      {loading && <p className="author-text">Loading admin data...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && (
        <div className="admin-grid">
          <motion.section className="review-card" {...motionProps} transition={{ duration: 0.22 }}>
            <h3>Observation List</h3>
            {observations.length === 0 ? (
              <p className="author-text">No users are currently under observation.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Reason</th>
                      <th>Score</th>
                      <th>Last action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {observations.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.user_email || entry.user_name || entry.user_id}</td>
                        <td>{entry.role_name}</td>
                        <td>{entry.reason}</td>
                        <td>{entry.score}</td>
                        <td>{formatDate(entry.last_action_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.section>

          <motion.section
            className="review-card"
            {...motionProps}
            transition={{ duration: 0.22, delay: 0.04 }}
          >
            <h3>Recent Logs</h3>
            {logs.length === 0 ? (
              <p className="author-text">No persisted actions yet.</p>
            ) : (
              <div className="admin-log-list">
                {logs.map((entry) => (
                  <article key={entry.id} className="admin-log-row">
                    <div>
                      <strong>{entry.action}</strong>
                      <p className="author-text">
                        {entry.user_email || "anonymous"} - {entry.role_name}
                      </p>
                    </div>
                    <div>
                      <p>{entry.details}</p>
                      <span>{formatDate(entry.timestamp)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </motion.section>
        </div>
      )}
    </div>
  );
}

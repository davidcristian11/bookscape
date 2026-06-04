import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logoutUser, refreshSession } from "../api/authApi";
import {
  getAuthChangedEventName,
  getAuthToken,
  getRefreshToken,
  getTokenExpiresAt,
  markAuthSessionExpired,
  saveAuthSession,
} from "../utils/authStorage";

const DEFAULT_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const REFRESH_BEFORE_EXPIRY_MS = 60 * 1000;

function getConfiguredInactivityTimeoutMs() {
  const testOverride = window.__BOOKSCAPE_INACTIVITY_TIMEOUT_MS__;
  const rawValue =
    testOverride ?? import.meta.env.VITE_INACTIVITY_TIMEOUT_MS ?? DEFAULT_INACTIVITY_TIMEOUT_MS;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INACTIVITY_TIMEOUT_MS;
}

export default function AuthSessionMonitor() {
  const navigate = useNavigate();
  const [token, setToken] = useState(getAuthToken());
  const inactivityTimerRef = useRef(null);
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    const handleAuthChange = () => {
      setToken(getAuthToken());
    };

    window.addEventListener(getAuthChangedEventName(), handleAuthChange);
    return () => {
      window.removeEventListener(getAuthChangedEventName(), handleAuthChange);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let disposed = false;

    const expireForInactivity = async () => {
      const currentToken = getAuthToken();
      if (!currentToken || disposed) {
        return;
      }

      try {
        await logoutUser(currentToken);
      } catch {
        // Local expiry still wins when the network or server is unavailable.
      }

      markAuthSessionExpired("You were logged out after inactivity.");
      navigate("/login", { replace: true });
    };

    const resetTimer = () => {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = window.setTimeout(
        expireForInactivity,
        getConfiguredInactivityTimeoutMs()
      );
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      disposed = true;
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
      }
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [navigate, token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const refreshToken = getRefreshToken();
    const expiresAt = getTokenExpiresAt();
    if (!refreshToken || !expiresAt) {
      return undefined;
    }

    const refreshAt = new Date(expiresAt).getTime() - REFRESH_BEFORE_EXPIRY_MS;
    const delay = Math.max(5000, refreshAt - Date.now());
    let disposed = false;

    refreshTimerRef.current = window.setTimeout(async () => {
      try {
        const nextAuthData = await refreshSession(refreshToken);
        if (!disposed) {
          saveAuthSession(nextAuthData);
        }
      } catch {
        if (!disposed) {
          markAuthSessionExpired("Your server session expired. Please sign in again.");
          navigate("/login", { replace: true });
        }
      }
    }, delay);

    return () => {
      disposed = true;
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [navigate, token]);

  return null;
}

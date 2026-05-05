import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAuthChangedEventName,
} from "../utils/authStorage.js";
import {
  checkBooksServerAvailability,
  getOfflineQueueCount,
  syncQueuedBookOperations,
} from "../api/booksApi.js";
import { getOfflineQueueEventName } from "./offlineQueue.js";

export default function useBooksOfflineSync(onReconnectSync = null) {
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(
    getOfflineQueueCount()
  );
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [serverReachable, setServerReachable] = useState(navigator.onLine);
  const [syncMessage, setSyncMessage] = useState("");
  const refreshInFlightRef = useRef(null);
  const hideSuccessTimerRef = useRef(null);
  const wasDisconnectedRef = useRef(!navigator.onLine);

  const refreshConnectionState = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    if (hideSuccessTimerRef.current) {
      window.clearTimeout(hideSuccessTimerRef.current);
      hideSuccessTimerRef.current = null;
    }

    const refreshPromise = (async () => {
    if (!navigator.onLine) {
      setIsOfflineMode(true);
      setServerReachable(false);
      wasDisconnectedRef.current = true;
      setOfflineQueueCount(getOfflineQueueCount());
      setSyncMessage("Offline mode active");
      return false;
    }

    const serverAvailable = await checkBooksServerAvailability();

    if (!serverAvailable) {
      setIsOfflineMode(true);
      setServerReachable(false);
      wasDisconnectedRef.current = true;
      setOfflineQueueCount(getOfflineQueueCount());
      setSyncMessage("Server unreachable");
      return false;
    }

    setIsOfflineMode(false);
    setServerReachable(true);

    if (getOfflineQueueCount() === 0) {
      setOfflineQueueCount(0);
      setSyncMessage("Online");
      if (wasDisconnectedRef.current && typeof onReconnectSync === "function") {
        await onReconnectSync();
      }
      wasDisconnectedRef.current = false;
      return true;
    }

    try {
      setIsSyncingQueue(true);
      setSyncMessage("Syncing...");

      const syncResult = await syncQueuedBookOperations();

      setOfflineQueueCount(getOfflineQueueCount());

      if (syncResult.synced && typeof onReconnectSync === "function") {
        await onReconnectSync();
      }
      if (syncResult.synced) {
        wasDisconnectedRef.current = false;
      }

      setSyncMessage(
        syncResult.authExpired
          ? "Your in-memory server session expired after the backend restart. Please log in again to sync your offline changes."
          : syncResult.synced
            ? "Synced successfully"
            : "Sync failed"
      );
      if (syncResult.synced) {
        hideSuccessTimerRef.current = window.setTimeout(() => {
          setSyncMessage("Online");
          hideSuccessTimerRef.current = null;
        }, 2500);
      }
      return syncResult.synced;
    } catch {
      setSyncMessage("Sync failed");
      return false;
    } finally {
      setIsSyncingQueue(false);
    }
    })();

    refreshInFlightRef.current = refreshPromise;

    try {
      return await refreshPromise;
    } finally {
      refreshInFlightRef.current = null;
    }
  }, [onReconnectSync]);

  useEffect(() => {
    refreshConnectionState();

    const handleOnline = () => {
      window.setTimeout(refreshConnectionState, 150);
    };

    const handleOffline = () => {
      setIsOfflineMode(true);
      setServerReachable(false);
      wasDisconnectedRef.current = true;
      setOfflineQueueCount(getOfflineQueueCount());
      setSyncMessage("Offline mode active");
    };

    const handleQueueChange = () => {
      setOfflineQueueCount(getOfflineQueueCount());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(getOfflineQueueEventName(), handleQueueChange);
    window.addEventListener(getAuthChangedEventName(), handleOnline);

    return () => {
      if (hideSuccessTimerRef.current) {
        window.clearTimeout(hideSuccessTimerRef.current);
      }
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(getOfflineQueueEventName(), handleQueueChange);
      window.removeEventListener(getAuthChangedEventName(), handleOnline);
    };
  }, [refreshConnectionState]);

  const queueText =
    offlineQueueCount > 0
      ? `${offlineQueueCount} ${offlineQueueCount === 1 ? "change" : "changes"} queued`
      : "";

  const connectionStatus = !navigator.onLine
    ? "offline"
    : serverReachable
    ? "online"
    : "server_unreachable";

  const connectionMessage = !navigator.onLine
    ? "Offline mode active"
    : !serverReachable
    ? "Server unreachable"
    : isSyncingQueue
    ? "Syncing..."
    : syncMessage || "Online";

  return {
    isOfflineMode,
    offlineQueueCount,
    isSyncingQueue,
    serverReachable,
    connectionStatus,
    connectionMessage,
    queueText,
    syncMessage,
    refreshConnectionState,
  };
}

import { useCallback, useEffect, useState } from "react";
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

  const refreshConnectionState = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOfflineMode(true);
      setOfflineQueueCount(getOfflineQueueCount());
      return false;
    }

    const serverAvailable = await checkBooksServerAvailability();

    if (!serverAvailable) {
      setIsOfflineMode(true);
      setOfflineQueueCount(getOfflineQueueCount());
      return false;
    }

    setIsOfflineMode(false);

    if (getOfflineQueueCount() === 0) {
      setOfflineQueueCount(0);
      return true;
    }

    try {
      setIsSyncingQueue(true);

      const syncResult = await syncQueuedBookOperations();

      setOfflineQueueCount(getOfflineQueueCount());

      if (syncResult.synced && typeof onReconnectSync === "function") {
        await onReconnectSync();
      }

      return syncResult.synced;
    } finally {
      setIsSyncingQueue(false);
    }
  }, [onReconnectSync]);

  useEffect(() => {
    refreshConnectionState();

    const handleOnline = () => {
      refreshConnectionState();
    };

    const handleOffline = () => {
      setIsOfflineMode(true);
      setOfflineQueueCount(getOfflineQueueCount());
    };

    const handleQueueChange = () => {
      setOfflineQueueCount(getOfflineQueueCount());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(getOfflineQueueEventName(), handleQueueChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(getOfflineQueueEventName(), handleQueueChange);
    };
  }, [refreshConnectionState]);

  return {
    isOfflineMode,
    offlineQueueCount,
    isSyncingQueue,
    refreshConnectionState,
  };
}
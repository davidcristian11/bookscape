import { useEffect, useRef, useState } from "react";
import {
  getAuthChangedEventName,
  getAuthToken,
  markAuthSessionExpired,
} from "../utils/authStorage";
import { removeLocalBook, upsertLocalBook } from "../utils/localBooksStore";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

function toWebSocketBaseUrl(httpUrl) {
  if (httpUrl.startsWith("https://")) {
    return httpUrl.replace("https://", "wss://");
  }

  return httpUrl.replace("http://", "ws://");
}

export default function useBooksRealtime(onEvent = null) {
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState("connecting");
  const [realtimeMessage, setRealtimeMessage] = useState("Realtime updates connecting...");
  const [authToken, setAuthToken] = useState(getAuthToken());
  const callbackRef = useRef(onEvent);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const handleAuthChange = () => {
      setAuthToken(getAuthToken());
    };

    window.addEventListener(getAuthChangedEventName(), handleAuthChange);

    return () => {
      window.removeEventListener(getAuthChangedEventName(), handleAuthChange);
    };
  }, []);

  useEffect(() => {
    if (!authToken) {
      setIsRealtimeConnected(false);
      setRealtimeStatus("auth_required");
      setRealtimeMessage("Realtime updates paused until re-authentication.");
      return undefined;
    }

    let websocket = null;
    let disposed = false;
    let reconnectTimer = null;
    let reconnectAttempt = 0;

    const connect = () => {
      if (disposed) return;
      setRealtimeStatus("connecting");
      setRealtimeMessage("Realtime updates connecting...");

      websocket = new WebSocket(
        `${toWebSocketBaseUrl(API_BASE_URL)}/ws/books?token=${encodeURIComponent(authToken)}`
      );

      websocket.onopen = () => {
        reconnectAttempt = 0;
        setIsRealtimeConnected(true);
        setRealtimeStatus("connected");
        setRealtimeMessage("Realtime updates connected");
        if (typeof callbackRef.current === "function") {
          callbackRef.current({ type: "ws_reconnected" });
        }
      };

      websocket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (
            (payload.type === "book_created" || payload.type === "book_updated") &&
            payload.book
          ) {
            upsertLocalBook(payload.book);
          }

          if (payload.type === "book_deleted" && payload.book_id) {
            removeLocalBook(payload.book_id);
          }

          if (typeof callbackRef.current === "function") {
            callbackRef.current(payload);
          }
        } catch {
          // ignore malformed messages
        }
      };

      websocket.onclose = (event) => {
        setIsRealtimeConnected(false);

        if (disposed) return;

        if (event.code === 4401) {
          markAuthSessionExpired(
            "The backend restarted and your in-memory session expired. Please re-authenticate to sync your offline changes."
          );
          setRealtimeStatus("auth_required");
          setRealtimeMessage("Sync paused: re-authentication required.");
          return;
        }

        reconnectAttempt += 1;
        const delay = Math.min(30000, 1000 * 2 ** reconnectAttempt);
        setRealtimeStatus("retrying");
        setRealtimeMessage("Realtime updates disconnected, retrying...");
        reconnectTimer = window.setTimeout(connect, delay);
      };

      websocket.onerror = () => {
        try {
          websocket.close();
        } catch {
          // ignore
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      setIsRealtimeConnected(false);

      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }

      if (websocket) {
        try {
          websocket.close();
        } catch {
          // ignore
        }
      }
    };
  }, [authToken]);

  return {
    isRealtimeConnected,
    realtimeStatus,
    realtimeMessage,
  };
}

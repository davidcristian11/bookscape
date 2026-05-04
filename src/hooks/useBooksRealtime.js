import { useEffect, useRef, useState } from "react";
import { clearAuthSession, getAuthToken } from "../utils/authStorage";
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
  const callbackRef = useRef(onEvent);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      return undefined;
    }

    let websocket = null;
    let disposed = false;
    let reconnectTimer = null;

    const connect = () => {
      if (disposed) return;

      websocket = new WebSocket(
        `${toWebSocketBaseUrl(API_BASE_URL)}/ws/books?token=${encodeURIComponent(token)}`
      );

      websocket.onopen = () => {
        setIsRealtimeConnected(true);
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
          clearAuthSession();
          window.location.href = "/login";
          return;
        }

        reconnectTimer = window.setTimeout(connect, 2000);
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
  }, []);

  return {
    isRealtimeConnected,
  };
}
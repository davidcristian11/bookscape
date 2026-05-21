import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { buildChatWebSocketUrl, getChatMessages } from "../api/chatApi";
import { getAuthToken, getStoredUser } from "../utils/authStorage";
import "./Library.css";

function sortMessages(messages) {
  return [...messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export default function ChatPage() {
  const shouldReduceMotion = useReducedMotion();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState("");
  const websocketRef = useRef(null);
  const [user] = useState(() => getStoredUser());

  useEffect(() => {
    let disposed = false;
    getChatMessages(75)
      .then((data) => {
        if (!disposed) {
          setMessages(sortMessages(data));
        }
      })
      .catch((err) => {
        if (!disposed) {
          setError(err.message || "Failed to load chat.");
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setStatus("auth_required");
      return undefined;
    }

    const websocket = new WebSocket(buildChatWebSocketUrl(token));
    websocketRef.current = websocket;
    setStatus("connecting");

    websocket.onopen = () => {
      setStatus("connected");
      setError("");
    };

    websocket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "chat_message" && payload.message) {
          setMessages((current) => {
            if (current.some((message) => message.id === payload.message.id)) {
              return current;
            }
            return sortMessages([...current, payload.message]);
          });
        }
      } catch {
        setError("Received an unreadable chat update.");
      }
    };

    websocket.onclose = () => {
      setStatus("disconnected");
    };

    websocket.onerror = () => {
      setError("Chat connection is unavailable.");
      websocket.close();
    };

    return () => {
      websocketRef.current = null;
      websocket.close();
    };
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;

    const websocket = websocketRef.current;
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      setError("Chat is reconnecting. Try again in a moment.");
      return;
    }

    websocket.send(message);
    setDraft("");
    setError("");
  };

  const cardMotion = shouldReduceMotion
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="library-container chat-page">
      <header className="library-header page-header">
        <div>
          <span className="section-kicker">Community</span>
          <h1>Reading Chat</h1>
          <p className="page-subtitle">
            A shared room for logged-in readers. Messages are saved and restored after refresh.
          </p>
        </div>
        <span className={`chat-status ${status}`}>{status.replace("_", " ")}</span>
      </header>

      <motion.section className="review-card chat-panel" {...cardMotion} transition={{ duration: 0.22 }}>
        <div className="chat-messages" aria-live="polite">
          {messages.length === 0 ? (
            <p className="author-text">No messages yet.</p>
          ) : (
            messages.map((message) => {
              const mine = message.user_id === user?.id;
              return (
                <article key={message.id} className={`chat-message ${mine ? "mine" : ""}`}>
                  <div>
                    <strong>{message.user_name}</strong>
                    <span>{message.role_name}</span>
                  </div>
                  <p>{message.message}</p>
                  <time dateTime={message.created_at}>
                    {new Date(message.created_at).toLocaleTimeString()}
                  </time>
                </article>
              );
            })
          )}
        </div>

        {error && <p className="error-text">{error}</p>}

        <form className="chat-form" onSubmit={handleSubmit}>
          <label className="field-group" htmlFor="chat-message">
            <span className="field-label">Message</span>
            <input
              id="chat-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Share a thought"
              maxLength={1000}
            />
          </label>
          <button className="scrape-submit-btn" type="submit" disabled={status !== "connected"}>
            Send
          </button>
        </form>
      </motion.section>
    </div>
  );
}

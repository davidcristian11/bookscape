import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ReactFlow, { Background, Controls, Handle, Position, addEdge, applyEdgeChanges, applyNodeChanges } from "reactflow";
import "reactflow/dist/style.css";
import { getBooks } from "../api/booksApi";
import { createQuote, deleteQuote, getQuotesByBook, updateQuote } from "../api/quotesApi";
import useBooksOfflineSync from "../hooks/useBooksOfflineSync";
import "./IdeaNexus.css";

function QuoteCardNode({ data }) {
  return (
    <motion.div
      className="quote-card"
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <Handle type="target" position={Position.Top} className="custom-handle" />
      <div className="quote-meta">
        <div className="mock-cover-small" aria-hidden="true" />
        <div className="quote-source">
          <span className="from-text">From:</span>
          <strong>{data.bookTitle}</strong>
        </div>
      </div>
      <p className="nexus-quote-text">&quot;{data.quote}&quot;</p>
      {data.relationshipLabel && <span className="genre-badge">{data.relationshipLabel}</span>}
      <div className="quote-actions">
        <button className="delete-node-btn" type="button" onClick={() => data.onDelete?.(data.id)}>
          Delete
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} className="custom-handle" />
    </motion.div>
  );
}

const nodeTypes = { customQuote: QuoteCardNode };

export default function IdeaNexus() {
  const shouldReduceMotion = useReducedMotion();
  const [books, setBooks] = useState([]);
  const [quoteCards, setQuoteCards] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [form, setForm] = useState({ book_id: "", quote: "", note: "", relationship_label: "Related" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const bookTitleById = useMemo(
    () => Object.fromEntries(books.map((book) => [book.id, book.title])),
    [books]
  );

  const buildEdges = useCallback((cards) => {
    const groupedByLabel = new Map();
    for (const card of cards) {
      if (!card.relationship_label) continue;
      const list = groupedByLabel.get(card.relationship_label) || [];
      list.push(card);
      groupedByLabel.set(card.relationship_label, list);
    }

    const nextEdges = [];
    for (const [label, cardsForLabel] of groupedByLabel.entries()) {
      for (let index = 0; index < cardsForLabel.length - 1; index += 1) {
        nextEdges.push({
          id: `${label}-${cardsForLabel[index].id}-${cardsForLabel[index + 1].id}`,
          source: cardsForLabel[index].id,
          target: cardsForLabel[index + 1].id,
          label,
          animated: true,
        });
      }
    }
    return nextEdges;
  }, []);

  const mapQuoteToNode = useCallback(
    (card) => ({
      id: card.id,
      type: "customQuote",
      position: { x: card.position_x || 0, y: card.position_y || 0 },
      data: {
        id: card.id,
        bookTitle: bookTitleById[card.book_id] || "Book",
        quote: card.quote,
        relationshipLabel: card.relationship_label,
        onDelete: handleDeleteNode,
      },
    }),
    [bookTitleById]
  );

  const loadBoard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const page = await getBooks(1, 100);
      const loadedBooks = page.items;
      const quoteLists = await Promise.all(loadedBooks.map((book) => getQuotesByBook(book.id)));
      const loadedQuotes = quoteLists.flat();
      setBooks(loadedBooks);
      setQuoteCards(loadedQuotes);
      if (!form.book_id && loadedBooks[0]) {
        setForm((prev) => ({ ...prev, book_id: loadedBooks[0].id }));
      }
    } catch (err) {
      const message = err?.message || "";
      setError(
        message.toLowerCase().includes("failed to fetch")
          ? "Idea Nexus could not reach the server. Check that the backend is running, then try again."
          : message || "Idea Nexus could not load your quote cards. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [form.book_id]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const {
    isOfflineMode,
    connectionMessage,
    queueText,
    refreshConnectionState,
  } = useBooksOfflineSync(loadBoard);

  useEffect(() => {
    const retryAfterOnline = () => {
      window.setTimeout(() => {
        refreshConnectionState();
        loadBoard();
      }, 200);
    };

    window.addEventListener("online", retryAfterOnline);

    return () => {
      window.removeEventListener("online", retryAfterOnline);
    };
  }, [loadBoard, refreshConnectionState]);

  useEffect(() => {
    setNodes(quoteCards.map(mapQuoteToNode));
    setEdges(buildEdges(quoteCards));
  }, [quoteCards, mapQuoteToNode, buildEdges]);

  async function handleDeleteNode(nodeId) {
    if (!window.confirm("Delete this quote card?")) return;
    await deleteQuote(nodeId);
    setQuoteCards((prev) => prev.filter((card) => card.id !== nodeId));
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddQuoteCard = async (event) => {
    event.preventDefault();
    if (!form.book_id || !form.quote.trim()) {
      setError("Choose a book and enter quote text.");
      return;
    }

    try {
      setError("");
      const created = await createQuote(form.book_id, {
        quote: form.quote.trim(),
        note: form.note.trim() || null,
        relationship_label: form.relationship_label.trim() || null,
        position_x: 120 + Math.random() * 300,
        position_y: 120 + Math.random() * 180,
      });
      setQuoteCards((prev) => [...prev, created]);
      setForm((prev) => ({ ...prev, quote: "", note: "" }));
    } catch (err) {
      setError(err.message || "Could not add the quote card. Please try again.");
    }
  };

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((connection) => {
    setEdges((eds) => addEdge({ ...connection, animated: true, label: "Related" }, eds));
  }, []);

  const handleNodeDragStop = async (_event, node) => {
    await updateQuote(node.id, {
      position_x: node.position.x,
      position_y: node.position.y,
    });
    setQuoteCards((prev) =>
      prev.map((card) =>
        card.id === node.id
          ? { ...card, position_x: node.position.x, position_y: node.position.y }
          : card
      )
    );
  };

  if (loading) {
    return (
      <div className="nexus-container">
        <div className="nexus-header page-header">
          <div>
            <span className="section-kicker">Quote relationships</span>
            <h1>Idea Nexus</h1>
          </div>
        </div>
        <div className="nexus-loading-board" role="status">
          <p>Loading Idea Nexus...</p>
          <div className="skeleton-card" aria-hidden="true" />
        </div>
      </div>
    );
  }

  const authSyncRequired =
    (connectionMessage || "").includes("in-memory session expired") ||
    (error || "").includes("in-memory session expired");
  const showOfflineState = isOfflineMode || !navigator.onLine || Boolean(queueText) || authSyncRequired;
  const showServerError = Boolean(error) && !showOfflineState;

  return (
    <motion.div
      className="nexus-container"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
    >
      <div className="nexus-header page-header">
        <div>
          <span className="section-kicker">Quote relationships</span>
          <h1>Idea Nexus</h1>
          <p className="page-subtitle">
            Arrange quote cards into a visual board of themes, links, and recurring ideas.
          </p>
        </div>
      </div>

      <motion.form
        className="nexus-form"
        onSubmit={handleAddQuoteCard}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.04 }}
      >
        <select name="book_id" value={form.book_id} onChange={handleChange} disabled={books.length === 0}>
          {books.length === 0 && <option value="">No books available</option>}
          {books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
        </select>
        <input name="quote" placeholder="Quote text" value={form.quote} onChange={handleChange} />
        <input name="relationship_label" placeholder="Relationship label" value={form.relationship_label} onChange={handleChange} />
        <input name="note" placeholder="Optional note" value={form.note} onChange={handleChange} />
        <motion.button
          className="add-quote-btn"
          type="submit"
          whileHover={shouldReduceMotion ? undefined : { y: -1 }}
          whileTap={{ scale: 0.98 }}
        >
          Add Quote Card
        </motion.button>
      </motion.form>

      <AnimatePresence>
        {showOfflineState && (
          <motion.div
            className="review-card connection-banner"
            role="status"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <h3>
              {!navigator.onLine
                ? "Offline mode active"
                : authSyncRequired
                  ? "Sync paused: re-authentication required"
                  : connectionMessage}
            </h3>
            <p>
              {authSyncRequired
                ? "The backend restarted and the RAM-only session expired. Re-authenticate to sync queued offline changes."
                : "Idea Nexus will refresh when BookScape can reach the server again."}
            </p>
            {queueText && (
              <p style={{ marginTop: "0.75rem", fontWeight: "bold" }}>
                {queueText}
              </p>
            )}
            <button className="cancel-btn" type="button" onClick={loadBoard}>
              Retry
            </button>
            {authSyncRequired && (
              <div className="recovery-actions">
                <Link className="view-details-btn" to="/login">
                  Log in to sync
                </Link>
                <Link className="scrape-submit-btn" to="/register">
                  Re-register account
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showServerError && (
          <motion.div
            className="review-card nexus-error-card"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <p className="error-text">{error}</p>
            <button className="cancel-btn" type="button" onClick={loadBoard}>
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`canvas-wrapper ${nodes.length === 0 ? "is-empty" : ""}`}>
        {nodes.length === 0 && !showServerError && (
          <div className="nexus-empty-note">
            <h3>No quote cards yet</h3>
            <p>Create quote cards from a book detail page or add one above.</p>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.24 }}
        >
          <Background color="#cabca7" gap={22} variant="dots" />
          <Controls />
        </ReactFlow>
      </div>
    </motion.div>
  );
}

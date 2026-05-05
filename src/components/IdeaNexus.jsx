import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, Handle, Position, addEdge, applyEdgeChanges, applyNodeChanges } from "reactflow";
import "reactflow/dist/style.css";
import { getBooks } from "../api/booksApi";
import { createQuote, deleteQuote, getQuotesByBook, updateQuote } from "../api/quotesApi";
import useBooksOfflineSync from "../hooks/useBooksOfflineSync";
import "./IdeaNexus.css";

function QuoteCardNode({ data }) {
  return (
    <div className="quote-card">
      <Handle type="target" position={Position.Top} className="custom-handle" />
      <div className="quote-meta">
        <div className="mock-cover-small"></div>
        <div className="quote-source">
          <span className="from-text">From:</span>
          <strong>{data.bookTitle}</strong>
        </div>
      </div>
      <p className="quote-text">"{data.quote}"</p>
      {data.relationshipLabel && <span className="genre-badge">{data.relationshipLabel}</span>}
      <div className="quote-actions">
        <button className="delete-node-btn" type="button" onClick={() => data.onDelete?.(data.id)}>
          Delete
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} className="custom-handle" />
    </div>
  );
}

const nodeTypes = { customQuote: QuoteCardNode };

export default function IdeaNexus() {
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
    return <div className="nexus-container"><div className="nexus-header"><h1>Idea Nexus</h1></div><p>Loading Idea Nexus...</p></div>;
  }

  const showOfflineState = isOfflineMode || !navigator.onLine || Boolean(queueText);
  const showServerError = Boolean(error) && !showOfflineState;

  return (
    <div className="nexus-container">
      <div className="nexus-header">
        <h1>Idea Nexus</h1>
      </div>

      <form className="nexus-form" onSubmit={handleAddQuoteCard}>
        <select name="book_id" value={form.book_id} onChange={handleChange} disabled={books.length === 0}>
          {books.length === 0 && <option value="">No books available</option>}
          {books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
        </select>
        <input name="quote" placeholder="Quote text" value={form.quote} onChange={handleChange} />
        <input name="relationship_label" placeholder="Relationship label" value={form.relationship_label} onChange={handleChange} />
        <input name="note" placeholder="Optional note" value={form.note} onChange={handleChange} />
        <button className="add-quote-btn" type="submit">Add Quote Card</button>
      </form>

      {showOfflineState && (
        <div className="review-card connection-banner" role="status">
          <h3 style={{ marginBottom: "0.75rem" }}>
            {!navigator.onLine ? "Offline mode active" : connectionMessage}
          </h3>
          <p style={{ margin: 0, color: "var(--text-gray)" }}>
            Idea Nexus will refresh when BookScape can reach the server again.
          </p>
          {queueText && (
            <p style={{ margin: "0.75rem 0 0 0", fontWeight: "bold" }}>
              {queueText}
            </p>
          )}
          <button
            className="cancel-btn"
            type="button"
            onClick={loadBoard}
            style={{ marginTop: "1rem" }}
          >
            Retry
          </button>
        </div>
      )}

      {showServerError && (
        <div className="review-card" style={{ marginBottom: "1.5rem" }}>
          <p className="error-text">{error}</p>
          <button className="cancel-btn" type="button" onClick={loadBoard}>
            Retry
          </button>
        </div>
      )}

      <div className="canvas-wrapper">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#ccc" gap={20} variant="dots" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

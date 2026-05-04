import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "reactflow";
import "reactflow/dist/style.css";
import "./IdeaNexus.css";
import {
  createNexusEdge,
  createNexusNode,
  deleteNexusEdge,
  deleteNexusNode,
  getNexusGraph,
  updateNexusNode,
} from "../api/nexusApi";

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

      <div className="quote-actions">
        <button
          className="connect-btn"
          type="button"
          onClick={() =>
            alert("Use the handles to drag a connection between cards.")
          }
        >
          Connect
        </button>
        <button
          className="delete-node-btn"
          type="button"
          onClick={() => data.onDelete?.(data.id)}
        >
          🗑️
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="custom-handle"
      />
    </div>
  );
}

const nodeTypes = { customQuote: QuoteCardNode };

function mapBackendNodeToReactFlow(node, onDelete) {
  return {
    id: node.id,
    type: "customQuote",
    position: { x: node.x, y: node.y },
    data: {
      id: node.id,
      bookTitle: node.book_title,
      quote: node.quote,
      onDelete,
    },
  };
}

function mapBackendEdgeToReactFlow(edge) {
  return {
    id: edge.id,
    source: edge.source_id,
    target: edge.target_id,
    animated: true,
    label: edge.label || undefined,
  };
}

export default function IdeaNexus() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleDeleteNode = useCallback(
    async (nodeId) => {
      const confirmed = window.confirm(
        "Are you sure you want to delete this quote card?"
      );
      if (!confirmed) return;

      try {
        await deleteNexusNode(nodeId);

        setNodes((prev) => prev.filter((node) => node.id !== nodeId));
        setEdges((prev) =>
          prev.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId
          )
        );
      } catch (err) {
        alert(err.message || "Failed to delete node.");
      }
    },
    []
  );

  const loadGraph = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getNexusGraph();

      setNodes(
        data.nodes.map((node) =>
          mapBackendNodeToReactFlow(node, handleDeleteNode)
        )
      );
      setEdges(data.edges.map(mapBackendEdgeToReactFlow));
    } catch (err) {
      setError(err.message || "Failed to load Idea Nexus.");
    } finally {
      setLoading(false);
    }
  }, [handleDeleteNode]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback(async (connection) => {
    try {
      const createdEdge = await createNexusEdge({
        source_id: connection.source,
        target_id: connection.target,
        label: "Related",
      });

      setEdges((eds) =>
        addEdge(
          {
            id: createdEdge.id,
            source: createdEdge.source_id,
            target: createdEdge.target_id,
            animated: true,
            label: createdEdge.label || undefined,
          },
          eds
        )
      );
    } catch (err) {
      alert(err.message || "Failed to create connection.");
    }
  }, []);

  const handleAddQuoteCard = async () => {
    const bookTitle = window.prompt("Book title:");
    if (!bookTitle || !bookTitle.trim()) return;

    const quote = window.prompt("Quote:");
    if (!quote || !quote.trim()) return;

    try {
      const createdNode = await createNexusNode({
        book_title: bookTitle.trim(),
        quote: quote.trim(),
        x: 250 + Math.random() * 150,
        y: 120 + Math.random() * 150,
      });

      setNodes((prev) => [
        ...prev,
        mapBackendNodeToReactFlow(createdNode, handleDeleteNode),
      ]);
    } catch (err) {
      alert(err.message || "Failed to create quote card.");
    }
  };

  const handleNodeDragStop = async (_event, node) => {
    try {
      await updateNexusNode(node.id, {
        x: node.position.x,
        y: node.position.y,
      });
    } catch (err) {
      alert(err.message || "Failed to save node position.");
    }
  };

  const handleEdgeClick = async (_event, edge) => {
    const confirmed = window.confirm(
      "Do you want to delete this connection?"
    );
    if (!confirmed) return;

    try {
      await deleteNexusEdge(edge.id);
      setEdges((prev) => prev.filter((item) => item.id !== edge.id));
    } catch (err) {
      alert(err.message || "Failed to delete connection.");
    }
  };

  const enrichedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onDelete: handleDeleteNode,
        },
      })),
    [nodes, handleDeleteNode]
  );

  if (loading) {
    return (
      <div className="nexus-container">
        <div className="nexus-header">
          <h1>Idea Nexus</h1>
        </div>
        <p>Loading Idea Nexus...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="nexus-container">
        <div className="nexus-header">
          <h1>Idea Nexus</h1>
        </div>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="nexus-container">
      <div className="nexus-header">
        <h1>Idea Nexus</h1>
        <button className="add-quote-btn" onClick={handleAddQuoteCard}>
          + Add Quote Card
        </button>
      </div>

      <div className="canvas-wrapper">
        <ReactFlow
          nodes={enrichedNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={handleNodeDragStop}
          onEdgeClick={handleEdgeClick}
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
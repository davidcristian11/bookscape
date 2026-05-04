import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import IdeaNexus from './IdeaNexus';

vi.mock('reactflow', () => ({
    __esModule: true,
    default: ({ children, nodes, edges }) => (
        <div>
            <div>ReactFlow Mock</div>
            <div>Nodes: {nodes.length}</div>
            <div>Edges: {edges.length}</div>
            {nodes.map((node) => (
                <div key={node.id}>
                    <div>{node.data.bookTitle}</div>
                    <div>{node.data.quote}</div>
                </div>
            ))}
            {children}
        </div>
    ),
    Background: () => <div>Background Mock</div>,
    Controls: () => <div>Controls Mock</div>,
    Handle: () => <div>Handle Mock</div>,
    Position: { Top: 'top', Bottom: 'bottom' },
    applyNodeChanges: vi.fn((changes, nodes) => nodes),
    applyEdgeChanges: vi.fn((changes, edges) => edges),
    addEdge: vi.fn((edge, edges) => [...edges, edge]),
}));

describe('IdeaNexus', () => {
    it('renders title, button, initial nodes and controls', () => {
        render(<IdeaNexus />);

        expect(screen.getByText(/idea nexus/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /\+ add quote card/i })).toBeInTheDocument();
        expect(screen.getByText(/reactflow mock/i)).toBeInTheDocument();
        expect(screen.getByText(/nodes: 2/i)).toBeInTheDocument();
        expect(screen.getByText(/edges: 1/i)).toBeInTheDocument();
        expect(screen.getByText(/the midnight library/i)).toBeInTheDocument();
        expect(screen.getByText(/educated/i)).toBeInTheDocument();
        expect(screen.getByText(/background mock/i)).toBeInTheDocument();
        expect(screen.getByText(/controls mock/i)).toBeInTheDocument();
    });
});
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import LibraryPage from './LibraryPage';

vi.mock('./ScrapeModal', () => ({
    default: ({ isOpen }) => (isOpen ? <div>Mock Scrape Modal</div> : null),
}));

const books = [
    { id: 1, title: 'Book 1', author: 'Author 1', genre: 'Fiction', rating: 4, source: 'Manual' },
    { id: 2, title: 'Book 2', author: 'Author 2', genre: 'Fantasy', rating: 5, source: 'Web' },
    { id: 3, title: 'Book 3', author: 'Author 3', genre: 'Sci-Fi', rating: 3, source: 'Manual' },
    { id: 4, title: 'Book 4', author: 'Author 4', genre: 'Drama', rating: 2, source: 'Web' },
    { id: 5, title: 'Book 5', author: 'Author 5', genre: 'Mystery', rating: 4, source: 'Manual' },
    { id: 6, title: 'Book 6', author: 'Author 6', genre: 'Romance', rating: 5, source: 'Web' },
    { id: 7, title: 'Book 7', author: 'Author 7', genre: 'History', rating: 1, source: 'Manual' },
];

function renderPage(extraProps = {}) {
    return render(
        <MemoryRouter>
            <LibraryPage books={books} onDelete={vi.fn()} onAdd={vi.fn()} {...extraProps} />
        </MemoryRouter>
    );
}

describe('LibraryPage', () => {
    beforeEach(() => {
        document.cookie = 'libraryViewPreference=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    });

    it('renders in list view by default', () => {
        renderPage();

        expect(screen.getByText(/my library/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /list/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /grid/i })).toBeInTheDocument();
        expect(screen.getByText(/title & author/i)).toBeInTheDocument();
        expect(screen.getByText(/showing page 1 of 3 \(7 total books\)/i)).toBeInTheDocument();
    });

    it('switches to grid view when grid button is clicked', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByRole('button', { name: /grid/i }));

        expect(screen.queryByText(/title & author/i)).not.toBeInTheDocument();
        expect(screen.getByText('Book 1')).toBeInTheDocument();
        expect(screen.getByText(/showing page 1 of 2 \(7 total books\)/i)).toBeInTheDocument();
    });

    it('opens scrape modal when clicking scrape button', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByRole('button', { name: /\+ scrape new book/i }));

        expect(screen.getByText(/mock scrape modal/i)).toBeInTheDocument();
    });

    it('calls onDelete when delete button is clicked in list view', async () => {
        const user = userEvent.setup();
        const onDelete = vi.fn();

        renderPage({ onDelete });

        const deleteButtons = document.querySelectorAll('button.action-icon.delete');
        expect(deleteButtons.length).toBeGreaterThan(0);

        await user.click(deleteButtons[0]);

        expect(onDelete).toHaveBeenCalledWith(1);
    });

    it('goes to next page and previous page', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByRole('button', { name: /next/i }));
        expect(screen.getByText(/showing page 2 of 3 \(7 total books\)/i)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /previous/i }));
        expect(screen.getByText(/showing page 1 of 3 \(7 total books\)/i)).toBeInTheDocument();
    });

    it('resets to page 1 when view mode changes', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByRole('button', { name: /next/i }));
        expect(screen.getByText(/showing page 2 of 3/i)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /grid/i }));
        expect(screen.getByText(/showing page 1 of 2/i)).toBeInTheDocument();
    });
});
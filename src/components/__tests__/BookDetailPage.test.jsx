import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import BookDetailPage from '../BookDetailPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

const books = [
    {
        id: 1,
        title: 'The Midnight Library',
        author: 'Matt Haig',
        genre: 'Fiction',
        source: 'Manual',
        review: 'Nice book',
    },
];

function renderPage(path = '/book/1', extraProps = {}) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route
                    path="/book/:id"
                    element={
                        <BookDetailPage
                            books={books}
                            onDelete={vi.fn()}
                            onUpdate={vi.fn()}
                            {...extraProps}
                        />
                    }
                />
            </Routes>
        </MemoryRouter>
    );
}

describe('BookDetailPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(window, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        window.alert.mockRestore();
    });

    it('renders not found when book does not exist', () => {
        renderPage('/book/999');
        expect(screen.getByText(/book not found/i)).toBeInTheDocument();
    });

    it('renders existing book details', () => {
        renderPage();
        expect(screen.getByText('The Midnight Library')).toBeInTheDocument();
        expect(screen.getByText(/by Matt Haig/i)).toBeInTheDocument();
        expect(screen.getByText(/your review/i)).toBeInTheDocument();
    });

    it('updates textarea and saves changes', async () => {
        const user = userEvent.setup();
        const onUpdate = vi.fn();

        renderPage('/book/1', { onUpdate });

        const textarea = screen.getByPlaceholderText(/write your thoughts here/i);
        await user.clear(textarea);
        await user.type(textarea, 'Updated review text');

        await user.click(screen.getByRole('button', { name: /save changes/i }));

        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 1,
                review: 'Updated review text',
            })
        );
        expect(window.alert).toHaveBeenCalled();
    });

    it('deletes book and navigates back to library', async () => {
        const user = userEvent.setup();
        const onDelete = vi.fn();

        renderPage('/book/1', { onDelete });

        await user.click(screen.getByRole('button', { name: /delete book/i }));

        expect(onDelete).toHaveBeenCalledWith(1);
        expect(mockNavigate).toHaveBeenCalledWith('/library');
    });
});
// src/components/__tests__/InsightsPage.test.jsx
import { render, screen } from '@testing-library/react';
import InsightsPage from '../InsightsPage';
import { describe, it, expect } from 'vitest';

describe('InsightsPage Component', () => {
    // Un set de date false (mock) pentru a alimenta componenta
    const mockBooks = [
        { id: 1, title: 'Book 1', genre: 'Fiction', rating: 5, source: 'Amazon' },
        { id: 2, title: 'Book 2', genre: 'Fiction', rating: 4, source: 'Goodreads' },
        { id: 3, title: 'Book 3', genre: 'Memoir', rating: 3, source: 'Amazon' }
    ];

    it('renders the title successfully', () => {
        render(<InsightsPage books={mockBooks} />);

        // Verificăm dacă titlul paginii există pe ecran
        const titleElement = screen.getByText('Reading Insights');
        expect(titleElement).toBeDefined();
    });

    it('calculates total books in the donut chart correctly', () => {
        render(<InsightsPage books={mockBooks} />);

        // Verificăm dacă numărul total (3 cărți) apare în centrul graficului
        const centerText = screen.getByText('3');
        expect(centerText).toBeDefined();
    });
});
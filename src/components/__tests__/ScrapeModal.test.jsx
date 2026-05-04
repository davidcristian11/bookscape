import { render, screen, fireEvent } from '@testing-library/react';
import ScrapeModal from '../ScrapeModal';
import { describe, it, expect, vi } from 'vitest';

describe('ScrapeModal Component', () => {

    it('nu randează nimic dacă isOpen este false', () => {
        const { container } = render(<ScrapeModal isOpen={false} />);
        // Dacă isOpen e false, componenta ar trebui să returneze null (nimic)
        expect(container.firstChild).toBeNull();
    });

    it('afișează eroare dacă se apasă submit fără URL valid', () => {
        render(<ScrapeModal isOpen={true} onClose={() => {}} onAddBook={() => {}} />);

        const submitButton = screen.getByText('Scrape Book');
        fireEvent.click(submitButton); // Simulăm click-ul

        // Ar trebui să apară mesajul de eroare din validarea ta
        expect(screen.getByText('Please enter a valid URL.')).toBeDefined();
    });

    it('apelează funcția onAddBook cu date valide și se închide', () => {
        // vi.fn() creează o funcție "spion" (spy) ca să vedem dacă a fost apelată
        const mockOnAddBook = vi.fn();
        const mockOnClose = vi.fn();

        render(
            <ScrapeModal
                isOpen={true}
                onClose={mockOnClose}
                onAddBook={mockOnAddBook}
            />
        );

        // 1. Găsim input-ul și scriem un link în el
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'https://www.goodreads.com/book/123' } });

        // 2. Găsim și apăsăm butonul
        const submitButton = screen.getByText('Scrape Book');
        fireEvent.click(submitButton);

        // 3. Verificăm (Assert) că funcțiile "spion" au fost apelate
        expect(mockOnAddBook).toHaveBeenCalled(); // Cartea a fost trimisă spre App.jsx?
        expect(mockOnClose).toHaveBeenCalled();   // Modalul a cerut să fie închis?
    });
});
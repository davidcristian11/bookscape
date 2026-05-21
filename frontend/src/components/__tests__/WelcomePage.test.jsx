import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import WelcomePage from '../WelcomePage';
import { describe, it, expect } from 'vitest';

describe('WelcomePage Component', () => {
    it('randează titlul și butonul corect', () => {
        // Randăm componenta în interiorul unui Router pentru ca <Link> să funcționeze
        render(
            <BrowserRouter>
                <WelcomePage />
            </BrowserRouter>
        );

        // Verificăm dacă titlul principal există pe ecran
        expect(screen.getByText('Curate your digital library.')).toBeDefined();

        // Verificăm dacă butonul de start există
        expect(screen.getByText('Start Scraping Now')).toBeDefined();
    });
});
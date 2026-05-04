import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';

function renderNavbar(path = '/') {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Navbar />
        </MemoryRouter>
    );
}

describe('Navbar', () => {
    it('shows auth links on welcome page', () => {
        renderNavbar('/');

        expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /insights/i })).not.toBeInTheDocument();
    });

    it('shows app links inside the application', () => {
        renderNavbar('/library');

        expect(screen.getByRole('link', { name: /library/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /insights/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /idea nexus/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /sign out/i })).toBeInTheDocument();
    });

    it('applies active class for current route', () => {
        renderNavbar('/insights');

        expect(screen.getByRole('link', { name: /insights/i })).toHaveClass('active');
        expect(screen.getByRole('link', { name: /library/i })).not.toHaveClass('active');
    });
});
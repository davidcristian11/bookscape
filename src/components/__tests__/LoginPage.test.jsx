import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';
import { describe, it, expect } from 'vitest';

describe('LoginPage Component', () => {
    it('permite completarea formularului și trimiterea lui', () => {
        render(
            <BrowserRouter>
                <LoginPage />
            </BrowserRouter>
        );

        // Testăm dacă găsește titlul din AuthLayout
        expect(screen.getByText('Welcome Back')).toBeDefined();

        // Completăm adresa de email (căutăm după placeholder)
        const emailInput = screen.getByPlaceholderText('your@email.com');
        fireEvent.change(emailInput, { target: { value: 'test@bookscape.com' } });

        // Completăm parola
        const passInput = screen.getByPlaceholderText('••••••••');
        fireEvent.change(passInput, { target: { value: 'parolamea' } });

        // Apăsăm submit
        const submitButton = screen.getByText('Log In');
        fireEvent.click(submitButton);

        // Deoarece în LoginPage avem doar `Maps('/library')` la submit,
        // acest test doar se asigură că formularul poate fi completat și trimis fără să crape.
    });
});
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import RegisterPage from './RegisterPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('RegisterPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders register form fields', () => {
        render(
            <MemoryRouter>
                <RegisterPage />
            </MemoryRouter>
        );

        expect(screen.getByText(/create your account/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
    });

    it('navigates to library after submit', async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter>
                <RegisterPage />
            </MemoryRouter>
        );

        await user.type(screen.getByLabelText(/name/i), 'Cristian');
        await user.type(screen.getByLabelText(/email/i), 'cristian@test.com');
        await user.type(screen.getByLabelText(/password/i), 'password123');

        await user.click(screen.getByRole('button', { name: /register/i }));

        expect(mockNavigate).toHaveBeenCalledWith('/library');
    });
});
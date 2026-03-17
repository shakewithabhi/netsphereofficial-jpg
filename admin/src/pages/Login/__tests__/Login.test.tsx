import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../index';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../api/auth', () => ({
  authApi: {
    login: vi.fn(),
  },
}));

vi.mock('../../../store/auth', () => ({
  useAuthStore: (selector: any) => selector({ setUser: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const renderLogin = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );

describe('LoginPage', () => {
  it('renders the brand header', () => {
    renderLogin();
    expect(screen.getByText('ByteBox Admin')).toBeInTheDocument();
    expect(screen.getByText('Sign in to manage your platform')).toBeInTheDocument();
  });

  it('renders email and password fields', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });

  it('renders the sign in button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders the sign up link', () => {
    renderLogin();
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
  });

  it('sign up link points to /register', () => {
    renderLogin();
    const link = screen.getByText('Sign Up');
    expect(link.closest('a')).toHaveAttribute('href', '/register');
  });
});

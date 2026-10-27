// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import App from './App';

const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
};

const storageMock = createStorageMock();
Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  configurable: true,
  writable: true,
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: storageMock,
    configurable: true,
    writable: true,
  });
}

describe('App Component', () => {
  beforeEach(() => {
    storageMock.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the AuthScreen when not authenticated', () => {
    render(<App />);
    expect(screen.getAllByText(/ResearchForge/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sign in to your workspace/i)).toBeDefined();
    expect(screen.getByLabelText(/Academic or Work Email/i)).toBeDefined();
    expect(screen.getByLabelText(/Password/i)).toBeDefined();
  });

  it('toggles between Sign In and Create Account modes', () => {
    render(<App />);
    const switchButton = screen.getByRole('button', { name: 'Create an account' });
    fireEvent.click(switchButton);

    expect(screen.getByText(/Create researcher account/i)).toBeDefined();
    expect(screen.getByLabelText(/Full Name/i)).toBeDefined();

    const switchBack = screen.getByRole('button', { name: 'Sign in' });
    fireEvent.click(switchBack);
    expect(screen.getAllByText(/Sign in to your workspace/i).length).toBeGreaterThan(0);
  });

  it('renders the workspace shell when authenticated with saved token', async () => {
    storageMock.setItem('researchforge_token', 'valid-test-token');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ id: 'u1', email: 'test@example.com', display_name: 'Dr. Researcher' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      if (typeof url === 'string' && url.includes('/projects')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 'p1',
                name: 'Neuroscience AI',
                description: 'Investigating neural network representations',
                members: 2,
                created_at: '2026-10-01T12:00:00Z',
              },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/Neuroscience AI/i).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/Overview/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/My projects/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Discover papers/i).length).toBeGreaterThan(0);
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api';

const tokenKey = 'researchforge_token';
let fetchMock: ReturnType<typeof vi.fn>;

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('apiRequest', () => {
  it('sends JSON accept/content headers and a saved bearer token', async () => {
    localStorage.setItem(tokenKey, 'test-token');
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    const result = await apiRequest<{ ok: boolean }>('/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'ResearchForge' }),
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/test');
    const headers = new Headers(init.headers);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer test-token');
  });

  it('returns undefined for successful no-content responses', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiRequest<void>('/test', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('uses structured API error details when a request fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: { code: 'PREMIUM_REQUIRED', message: 'Premium is required.' } }, 402));
    await expect(apiRequest('/test')).rejects.toThrow('Premium is required.');
  });

  it('clears an expired token and emits the unauthorized event on protected calls', async () => {
    localStorage.setItem(tokenKey, 'expired-token');
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Not authenticated' }, 401));
    const handler = vi.fn();
    window.addEventListener('researchforge:unauthorized', handler);

    await expect(apiRequest('/projects')).rejects.toThrow('Not authenticated');

    expect(localStorage.getItem(tokenKey)).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('researchforge:unauthorized', handler);
  });

  it('does not clear a token or emit the global unauthorized event for login failures', async () => {
    localStorage.setItem(tokenKey, 'existing-token');
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Invalid credentials' }, 401));
    const handler = vi.fn();
    window.addEventListener('researchforge:unauthorized', handler);

    await expect(apiRequest('/auth/login', { method: 'POST', body: '{}' })).rejects.toThrow('Invalid credentials');

    expect(localStorage.getItem(tokenKey)).toBe('existing-token');
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener('researchforge:unauthorized', handler);
  });
});

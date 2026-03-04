import { vi } from 'vitest';
import { RemoteStorageAdapter, RemoteStorageError } from './remote-storage.adapter';
import type { StorageAdapter } from './storage-adapter';

class FakeLocalFallback implements StorageAdapter {
  store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

describe('RemoteStorageAdapter', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.removeItem('op_org_settings');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('uses local fallback for guests (no access token)', async () => {
    const localFallback = new FakeLocalFallback();
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const adapter = new RemoteStorageAdapter('https://api.example.com', {
      accessTokenProvider: async () => null,
      localFallback,
    });

    await adapter.setItem('guest-key', 'guest-value');
    const value = await adapter.getItem('guest-key');

    expect(value).toBe('guest-value');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('forces local fallback when admin test mode is enabled, even with a token', async () => {
    localStorage.setItem('op_org_settings', JSON.stringify({ testModeEnabled: true }));
    const localFallback = new FakeLocalFallback();
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const adapter = new RemoteStorageAdapter('https://api.example.com', {
      accessTokenProvider: async () => 'token-123',
      localFallback,
    });

    await adapter.setItem('k', 'v');
    expect(await adapter.getItem('k')).toBe('v');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses remote storage for authenticated users when test mode is disabled', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/storage/item') && init?.method === 'PUT') {
        return new Response(JSON.stringify({ version: 1 }), { status: 200 });
      }
      if (url.includes('/storage/item?key=') && init?.method === 'GET') {
        return new Response(JSON.stringify({ value: 'remote-value', version: 1 }), {
          status: 200,
        });
      }
      return new Response(null, { status: 404 });
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const adapter = new RemoteStorageAdapter('https://api.example.com', {
      accessTokenProvider: async () => 'token-123',
    });

    await adapter.setItem('k', 'v');
    const value = await adapter.getItem('k');

    expect(value).toBe('remote-value');
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('adds correlation headers for remote requests when providers are configured', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/storage/item') && init?.method === 'PUT') {
        return new Response(JSON.stringify({ version: 2 }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const adapter = new RemoteStorageAdapter('https://api.example.com', {
      accessTokenProvider: async () => 'token-123',
      requestIdProvider: () => 'api_req_1',
      sessionIdProvider: () => 'sess_1',
    });

    await adapter.setItem('corr-key', 'corr-value');
    const [, init] = fetchSpy.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Operator-Request-Id']).toBe('api_req_1');
    expect(headers['X-Operator-Session-Id']).toBe('sess_1');
  });

  it('enforces request-per-minute quota when configured', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ keys: [] }), { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const adapter = new RemoteStorageAdapter('https://api.example.com', {
      accessTokenProvider: async () => 'token-123',
      requestRateLimitPerMinute: 1,
    });

    await adapter.keys();
    await expect(adapter.keys()).rejects.toBeInstanceOf(RemoteStorageError);
  });
});

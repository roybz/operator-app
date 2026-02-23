import { StorageAdapter } from './storage-adapter';

interface KeysResponse {
  keys: string[];
}

interface ItemResponse {
  value: string | null;
  version?: number;
  updatedAt?: number;
}

interface BatchGetResponse {
  items?: Record<string, ItemResponse | undefined>;
}

interface RemoteStorageAdapterOptions {
  accessTokenProvider?: () => Promise<string | null>;
  localFallback?: StorageAdapter;
}

export class RemoteStorageError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'RemoteStorageError';
  }
}

// DynamoDB item max is 400KB including attribute names/metadata; keep a safety margin.
const REMOTE_VALUE_SOFT_LIMIT_BYTES = 340 * 1024;

export class RemoteStorageAdapter implements StorageAdapter {
  private versions = new Map<string, number>();

  constructor(
    private baseUrl: string,
    private options: RemoteStorageAdapterOptions = {},
  ) {}

  async getItem(key: string): Promise<string | null> {
    if (!(await this.canUseRemote())) {
      return this.options.localFallback?.getItem(key) ?? null;
    }
    const url = `${this.baseUrl}/storage/item?key=${encodeURIComponent(key)}`;
    const headers = await this.authHeaders({ Accept: 'application/json' });
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as ItemResponse;
    if (typeof data?.version === 'number') {
      this.versions.set(key, data.version);
    }
    return data?.value ?? null;
  }

  async getItems(keys: string[]): Promise<Record<string, string | null>> {
    if (!(await this.canUseRemote())) {
      return (await this.options.localFallback?.getItems?.(keys)) ?? {};
    }
    if (keys.length === 0) return {};
    const url = `${this.baseUrl}/storage/batchGet`;
    const headers = await this.authHeaders({ 'Content-Type': 'application/json' });
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ keys }),
    });
    if (!response.ok) {
      const out: Record<string, string | null> = {};
      for (const key of keys) {
        out[key] = await this.getItem(key);
      }
      return out;
    }
    const data = (await response.json()) as BatchGetResponse;
    const items = data?.items ?? {};
    const out: Record<string, string | null> = {};
    for (const key of keys) {
      const item = items[key];
      if (item && typeof item.version === 'number') {
        this.versions.set(key, item.version);
      }
      out[key] = item?.value ?? null;
    }
    return out;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!(await this.canUseRemote())) {
      await this.options.localFallback?.setItem(key, value);
      return;
    }
    const url = `${this.baseUrl}/storage/item`;
    const headers = await this.authHeaders({ 'Content-Type': 'application/json' });
    const valueBytes = this.byteLength(value);
    if (valueBytes > REMOTE_VALUE_SOFT_LIMIT_BYTES) {
      throw new RemoteStorageError(
        `Remote item too large (${valueBytes} bytes). Limit is ~${REMOTE_VALUE_SOFT_LIMIT_BYTES} bytes for now.`,
        413,
        'item_too_large_client',
      );
    }
    const version = this.versions.get(key);
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        key,
        value,
        ...(typeof version === 'number' ? { version } : {}),
      }),
    });
    if (!response.ok) {
      const details = await this.readErrorBody(response);
      throw new RemoteStorageError(
        details?.message ?? `Remote setItem failed (${response.status})`,
        response.status,
        details?.code,
      );
    }
    try {
      const data = (await response.json()) as { version?: number };
      if (typeof data.version === 'number') this.versions.set(key, data.version);
    } catch {
      // API may return no body; version cache is optional.
    }
  }

  async removeItem(key: string): Promise<void> {
    if (!(await this.canUseRemote())) {
      await this.options.localFallback?.removeItem(key);
      return;
    }
    const url = `${this.baseUrl}/storage/item?key=${encodeURIComponent(key)}`;
    const headers = await this.authHeaders();
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });
    if (response.ok) this.versions.delete(key);
  }

  async keys(): Promise<string[]> {
    if (!(await this.canUseRemote())) {
      return (await this.options.localFallback?.keys()) ?? [];
    }
    const url = `${this.baseUrl}/storage/keys`;
    const headers = await this.authHeaders({ Accept: 'application/json' });
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    if (!response.ok) return [];
    const data = (await response.json()) as KeysResponse;
    return Array.isArray(data?.keys) ? data.keys : [];
  }

  private async canUseRemote() {
    if (!this.baseUrl) return false;
    const token = await this.options.accessTokenProvider?.();
    return Boolean(token);
  }

  private async authHeaders(headers: Record<string, string> = {}) {
    const token = await this.options.accessTokenProvider?.();
    return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
  }

  private byteLength(value: string) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(value).length;
    }
    return value.length * 2;
  }

  private async readErrorBody(
    response: Response,
  ): Promise<{ message?: string; code?: string } | null> {
    try {
      const data = (await response.json()) as { message?: string; error?: string; code?: string };
      return {
        message:
          (typeof data.message === 'string' && data.message) ||
          (typeof data.error === 'string' && data.error) ||
          undefined,
        code: typeof data.code === 'string' ? data.code : undefined,
      };
    } catch {
      return null;
    }
  }
}

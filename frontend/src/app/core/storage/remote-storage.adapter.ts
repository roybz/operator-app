import { StorageAdapter } from './storage-adapter';

interface KeysResponse {
  keys: string[];
}

interface ItemResponse {
  value: string | null;
}

export class RemoteStorageAdapter implements StorageAdapter {
  constructor(private baseUrl: string) {}

  async getItem(key: string): Promise<string | null> {
    const url = `${this.baseUrl}/storage/item?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as ItemResponse;
    return data?.value ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    const url = `${this.baseUrl}/storage/item`;
    await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
  }

  async removeItem(key: string): Promise<void> {
    const url = `${this.baseUrl}/storage/item?key=${encodeURIComponent(key)}`;
    await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
    });
  }

  async keys(): Promise<string[]> {
    const url = `${this.baseUrl}/storage/keys`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as KeysResponse;
    return Array.isArray(data?.keys) ? data.keys : [];
  }
}

import { StorageAdapter } from './storage-adapter';

export class LocalStorageAdapter implements StorageAdapter {
  async getItem(key: string) {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  }

  async setItem(key: string, value: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  }

  async getItems(keys: string[]) {
    const out: Record<string, string | null> = {};
    for (const key of keys) {
      out[key] = await this.getItem(key);
    }
    return out;
  }

  async removeItem(key: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  }

  async keys() {
    if (typeof window === 'undefined') return [];
    return Object.keys(window.localStorage);
  }
}

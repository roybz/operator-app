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

  async removeItem(key: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  }

  async keys() {
    if (typeof window === 'undefined') return [];
    return Object.keys(window.localStorage);
  }
}

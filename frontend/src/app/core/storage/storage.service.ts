import { Injectable, inject, signal } from '@angular/core';
import { StorageAdapter, STORAGE_ADAPTER } from './storage-adapter';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private cache = new Map<string, string>();
  private hydrated = false;
  private lastLocalMutationAt = 0;
  private remoteChangeSeq = 0;
  private adapter = inject<StorageAdapter>(STORAGE_ADAPTER);
  readonly lastRemoteChange = signal<{ seq: number; keys: string[] } | null>(null);

  async hydrate() {
    const keys = await this.adapter.keys();
    this.cache.clear();
    if (this.adapter.getItems) {
      const values = await this.adapter.getItems(keys);
      for (const key of keys) {
        const value = values[key] ?? null;
        if (value !== null) this.cache.set(key, value);
      }
      this.hydrated = true;
      return;
    }
    for (const key of keys) {
      const value = await this.adapter.getItem(key);
      if (value !== null) {
        this.cache.set(key, value);
      }
    }
    this.hydrated = true;
  }

  async hydrateAndDetectChanges() {
    const before = new Map(this.cache);
    await this.hydrate();
    const changedKeys = this.computeChangedKeys(before, this.cache);
    if (changedKeys.length > 0) {
      this.remoteChangeSeq += 1;
      this.lastRemoteChange.set({ seq: this.remoteChangeSeq, keys: changedKeys });
    }
    return changedKeys.length > 0;
  }

  async hydrateAndGetChangedKeys() {
    const before = new Map(this.cache);
    await this.hydrate();
    const changedKeys = this.computeChangedKeys(before, this.cache);
    if (changedKeys.length > 0) {
      this.remoteChangeSeq += 1;
      this.lastRemoteChange.set({ seq: this.remoteChangeSeq, keys: changedKeys });
    }
    return changedKeys;
  }

  getItem(key: string) {
    return this.adapter.getItem(key);
  }

  getItemSync(key: string) {
    return this.cache.get(key) ?? null;
  }

  keys() {
    return this.adapter.keys();
  }

  async getJson<T>(key: string, fallback: T): Promise<T> {
    const raw = await this.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  async setJson<T>(key: string, value: T): Promise<void> {
    await this.setItem(key, JSON.stringify(value));
  }

  getJsonSync<T>(key: string, fallback: T): T {
    const raw = this.getItemSync(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  async setItem(key: string, value: string) {
    this.cache.set(key, value);
    this.lastLocalMutationAt = Date.now();
    await this.adapter.setItem(key, value);
  }

  async removeItem(key: string) {
    this.cache.delete(key);
    this.lastLocalMutationAt = Date.now();
    await this.adapter.removeItem(key);
  }

  keysSync() {
    return Array.from(this.cache.keys());
  }

  getLastLocalMutationAt() {
    return this.lastLocalMutationAt;
  }

  private cacheSignature() {
    return JSON.stringify(Array.from(this.cache.entries()).sort(([a], [b]) => a.localeCompare(b)));
  }

  private computeChangedKeys(before: Map<string, string>, after: Map<string, string>) {
    const changed = new Set<string>();
    for (const [key, value] of before.entries()) {
      if (!after.has(key) || after.get(key) !== value) changed.add(key);
    }
    for (const [key, value] of after.entries()) {
      if (!before.has(key) || before.get(key) !== value) changed.add(key);
    }
    return Array.from(changed).sort();
  }
}

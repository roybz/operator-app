import { Injectable, inject, signal } from '@angular/core';
import { StorageAdapter, STORAGE_ADAPTER } from './storage-adapter';
import {
  applyBuiltInStorageMigrations,
  parseAppliedStorageMigrations,
  STORAGE_MIGRATION_STATE_KEY,
} from './storage-migrations';

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
      await this.applyMigrations();
      this.hydrated = true;
      return;
    }
    for (const key of keys) {
      const value = await this.adapter.getItem(key);
      if (value !== null) {
        this.cache.set(key, value);
      }
    }
    await this.applyMigrations();
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

  emitRemoteChange(keys: string[]) {
    if (!keys.length) return;
    this.remoteChangeSeq += 1;
    this.lastRemoteChange.set({ seq: this.remoteChangeSeq, keys: [...new Set(keys)].sort() });
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

  async getJsonValidated<T>(
    key: string,
    fallback: T,
    validator: (value: unknown) => value is T,
  ): Promise<T> {
    const raw = await this.getItem(key);
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw) as unknown;
      return validator(parsed) ? parsed : fallback;
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

  getJsonSyncValidated<T>(
    key: string,
    fallback: T,
    validator: (value: unknown) => value is T,
  ): T {
    const raw = this.getItemSync(key);
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw) as unknown;
      return validator(parsed) ? parsed : fallback;
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

  private async applyMigrations() {
    const applied = parseAppliedStorageMigrations(this.cache.get(STORAGE_MIGRATION_STATE_KEY) ?? null);
    const { touchedKeys, newlyApplied } = applyBuiltInStorageMigrations(this.cache, applied);
    if (touchedKeys.length === 0 && newlyApplied.length === 0) return;

    for (const key of touchedKeys) {
      if (key === STORAGE_MIGRATION_STATE_KEY) continue;
      const nextValue = this.cache.get(key);
      if (nextValue === undefined) {
        await this.adapter.removeItem(key);
      } else {
        await this.adapter.setItem(key, nextValue);
      }
    }

    if (newlyApplied.length > 0) {
      const nextApplied = new Set([...applied, ...newlyApplied]);
      const serialized = JSON.stringify(Array.from(nextApplied).sort());
      this.cache.set(STORAGE_MIGRATION_STATE_KEY, serialized);
      await this.adapter.setItem(STORAGE_MIGRATION_STATE_KEY, serialized);
    }
  }
}

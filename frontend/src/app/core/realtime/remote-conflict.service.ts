import { Injectable, signal } from '@angular/core';

type RemoteConflictReason = 'dirty' | 'recent-local-write';

export interface RemoteConflictState {
  keys: string[];
  reason: RemoteConflictReason;
  updatedAt: number;
}

@Injectable({ providedIn: 'root' })
export class RemoteConflictService {
  private dirtyKeys = new Set<string>();
  readonly pending = signal<RemoteConflictState | null>(null);

  markDirty(key: string) {
    if (!key) return;
    this.dirtyKeys.add(key);
  }

  clearDirty(key: string) {
    if (!key) return;
    this.dirtyKeys.delete(key);
  }

  hasDirtyOverlap(keys: string[]) {
    return keys.some((key) => this.dirtyKeys.has(key));
  }

  queue(keys: string[], reason: RemoteConflictReason) {
    const uniqueKeys = [...new Set(keys)].sort();
    if (!uniqueKeys.length) return;
    const current = this.pending();
    const merged = current ? [...new Set([...current.keys, ...uniqueKeys])].sort() : uniqueKeys;
    this.pending.set({
      keys: merged,
      reason,
      updatedAt: Date.now(),
    });
  }

  clearPending() {
    this.pending.set(null);
  }
}

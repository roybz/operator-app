import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { writeWithConflictRetry } from '../storage/remote-write-utils';

interface SeenEnvelopeEntry {
  requestId: string;
  createdAt: number;
}

const ENVELOPE_SEEN_KEY_PREFIX = 'op_llm_envelope_seen_v1';
const DEFAULT_TTL_MS = 10 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class LlmEnvelopeGuardService {
  private readonly storage = inject(StorageService);

  async hasSeen(universeOwnerId: string, universeId: string, requestId: string): Promise<boolean> {
    const entries = await this.load(universeOwnerId, universeId);
    const now = Date.now();
    return entries.some(
      (entry) => entry.requestId === requestId && now - entry.createdAt < DEFAULT_TTL_MS,
    );
  }

  async markSeen(universeOwnerId: string, universeId: string, requestId: string): Promise<void> {
    const now = Date.now();
    const entries = await this.load(universeOwnerId, universeId);
    const filtered = entries.filter(
      (entry) => now - entry.createdAt < DEFAULT_TTL_MS && entry.requestId !== requestId,
    );
    const next = [{ requestId, createdAt: now }, ...filtered].slice(0, 500);
    const key = this.key(universeOwnerId, universeId);
    const serialized = JSON.stringify(next);
    await writeWithConflictRetry({
      key,
      serialized,
      getCurrentSerialized: () => this.storage.getItemSync(key),
      write: (payload) => this.storage.setItem(key, payload),
      refresh: async () => {
        await this.storage.getItem(key);
      },
    });
  }

  private async load(universeOwnerId: string, universeId: string): Promise<SeenEnvelopeEntry[]> {
    return this.storage.getJson(this.key(universeOwnerId, universeId), []);
  }

  private key(universeOwnerId: string, universeId: string): string {
    return `${ENVELOPE_SEEN_KEY_PREFIX}:${universeOwnerId}:${universeId}`;
  }
}

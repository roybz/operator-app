import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { LlmActionEnvelope, LlmContext } from './llm-types';
import { writeWithConflictRetry } from '../storage/remote-write-utils';

const ACTION_LOG_KEY_PREFIX = 'op_llm_action_log_v1';
const MAX_ACTION_LOG_ENTRIES = 500;

@Injectable({ providedIn: 'root' })
export class LlmActionLogService {
  private readonly storage = inject(StorageService);

  async list(context: LlmContext): Promise<LlmActionEnvelope[]> {
    return this.storage.getJson<LlmActionEnvelope[]>(this.key(context), []);
  }

  async append(context: LlmContext, entry: LlmActionEnvelope): Promise<LlmActionEnvelope[]> {
    const current = await this.list(context);
    const next = [entry, ...current].slice(0, MAX_ACTION_LOG_ENTRIES);
    await this.persistWithConflictRetry(this.key(context), next);
    return next;
  }

  async clear(context: LlmContext): Promise<void> {
    await this.persistWithConflictRetry(this.key(context), []);
  }

  private key(context: LlmContext): string {
    return `${ACTION_LOG_KEY_PREFIX}:${context.universeOwnerId}:${context.universeId}`;
  }

  private async persistWithConflictRetry(key: string, value: LlmActionEnvelope[]): Promise<void> {
    const serialized = JSON.stringify(value);
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
}

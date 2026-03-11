import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { LlmContext, LlmResident, LlmResidentPermissions } from './llm-types';
import { writeWithConflictRetry } from '../storage/remote-write-utils';

const RESIDENTS_KEY_PREFIX = 'op_llm_residents_v1';

@Injectable({ providedIn: 'root' })
export class LlmResidentService {
  private readonly storage = inject(StorageService);

  async list(context: LlmContext): Promise<LlmResident[]> {
    return this.storage.getJson<LlmResident[]>(this.key(context), []);
  }

  async upsert(
    context: LlmContext,
    resident: Omit<LlmResident, 'createdAt' | 'updatedAt' | 'universeOwnerId' | 'universeId'>,
  ): Promise<LlmResident[]> {
    const now = Date.now();
    const current = await this.list(context);
    const existing = current.find((item) => item.id === resident.id);
    const nextResident: LlmResident = {
      ...resident,
      universeOwnerId: context.universeOwnerId,
      universeId: context.universeId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      permissions: this.normalizePermissions(resident.permissions),
    };
    const next = existing
      ? current.map((item) => (item.id === resident.id ? nextResident : item))
      : [...current, nextResident];
    await this.persistWithConflictRetry(this.key(context), next);
    return next;
  }

  async remove(context: LlmContext, residentId: string): Promise<LlmResident[]> {
    const current = await this.list(context);
    const next = current.filter((item) => item.id !== residentId);
    await this.persistWithConflictRetry(this.key(context), next);
    return next;
  }

  private normalizePermissions(input: LlmResidentPermissions): LlmResidentPermissions {
    return {
      canWrite: Boolean(input.canWrite),
      canMoveDialogs: Boolean(input.canMoveDialogs),
      canCreateInstances: Boolean(input.canCreateInstances),
      canComment: Boolean(input.canComment),
    };
  }

  private key(context: LlmContext): string {
    return `${RESIDENTS_KEY_PREFIX}:${context.universeOwnerId}:${context.universeId}`;
  }

  private async persistWithConflictRetry(key: string, value: LlmResident[]): Promise<void> {
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

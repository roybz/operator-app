import { Injectable, inject } from '@angular/core';
import { AuthService, UniverseEditHolder } from '../auth.service';
import { StorageService } from '../storage/storage.service';
import { LlmContext } from './llm-types';
import { writeWithConflictRetry } from '../storage/remote-write-utils';

const PENCIL_LEASE_KEY_PREFIX = 'op_llm_pencil_lease_v1';
const DEFAULT_LEASE_TTL_MS = 5 * 60 * 1000;

export interface LlmPencilLease {
  universeOwnerId: string;
  universeId: string;
  residentId: string;
  residentName: string;
  grantedByUserId: string;
  createdAt: number;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class LlmPencilLeaseService {
  private readonly storage = inject(StorageService);
  private readonly auth = inject(AuthService);

  async getLease(context: LlmContext): Promise<LlmPencilLease | null> {
    const lease = await this.storage.getJson<LlmPencilLease | null>(this.key(context), null);
    if (!lease) return null;
    if (Date.now() <= lease.expiresAt) return lease;
    await this.revokeLease(context, lease.residentId);
    return null;
  }

  async grantLease(
    context: LlmContext,
    input: {
      residentId: string;
      residentName: string;
      ttlMs?: number;
      grantedByUserId?: string;
    },
  ): Promise<{ ok: boolean; message?: string; lease?: LlmPencilLease }> {
    if (
      !this.auth.canGrantPencil({
        universeOwnerId: context.universeOwnerId,
        multiUserEnabled: true,
      })
    ) {
      return { ok: false, message: 'llm.lease.unauthorized' };
    }
    const residentId = input.residentId.trim();
    const residentName = input.residentName.trim();
    if (!residentId || !residentName) {
      return { ok: false, message: 'llm.lease.invalidResident' };
    }

    const now = Date.now();
    const ttl = Math.min(60 * 60 * 1000, Math.max(15_000, input.ttlMs ?? DEFAULT_LEASE_TTL_MS));
    const lease: LlmPencilLease = {
      universeOwnerId: context.universeOwnerId,
      universeId: context.universeId,
      residentId,
      residentName,
      grantedByUserId:
        input.grantedByUserId ?? this.auth.session().userId ?? context.universeOwnerId,
      createdAt: now,
      expiresAt: now + ttl,
    };

    await this.persistWithConflictRetry(this.key(context), lease);
    this.auth.setUniverseEditHolder(context.universeId, this.toEditHolder(lease));
    return { ok: true, lease };
  }

  async revokeLease(context: LlmContext, residentId?: string): Promise<void> {
    const current = await this.storage.getJson<LlmPencilLease | null>(this.key(context), null);
    await this.persistWithConflictRetry(this.key(context), null);
    const holder = this.auth.getUniverseEditHolder(context.universeId);
    const targetId = residentId?.trim() || current?.residentId || null;
    if (!holder || !targetId || holder.id !== targetId) return;
    this.auth.setUniverseEditHolder(context.universeId, null);
  }

  async isLeaseActiveForResident(context: LlmContext, residentId: string): Promise<boolean> {
    const lease = await this.getLease(context);
    if (!lease) return false;
    return lease.residentId === residentId;
  }

  private key(context: LlmContext): string {
    return `${PENCIL_LEASE_KEY_PREFIX}:${context.universeOwnerId}:${context.universeId}`;
  }

  private toEditHolder(lease: LlmPencilLease): UniverseEditHolder {
    return {
      id: lease.residentId,
      username: lease.residentName,
      // Resident users participate like read-only observers in the shared presence/count
      // model and should be visible in the shared bottom-bar participant list.
      role: 'observer',
    };
  }

  private async persistWithConflictRetry(
    key: string,
    value: LlmPencilLease | null,
  ): Promise<void> {
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

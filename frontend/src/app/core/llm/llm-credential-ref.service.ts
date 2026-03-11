import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { StorageService } from '../storage/storage.service';
import { LlmCredentialMode, LlmCredentialRef, LlmCredentialStatus, LlmProvider } from './llm-types';
import { LlmModeGuardService } from './llm-mode-guard.service';
import { writeWithConflictRetry } from '../storage/remote-write-utils';

const CREDENTIAL_REFS_KEY = 'op_llm_credential_refs_v1';
const SECRET_SESSION_PREFIX = 'op_llm_secret_v1:';

type CredentialRefsStore = Record<string, LlmCredentialRef[]>;

@Injectable({ providedIn: 'root' })
export class LlmCredentialRefService {
  private readonly storage = inject(StorageService);
  private readonly auth = inject(AuthService);
  private readonly modeGuard = inject(LlmModeGuardService);
  private readonly runtimeSecrets = new Map<string, string>();

  async listForCurrentUser(): Promise<LlmCredentialRef[]> {
    const userId = this.auth.actualUser()?.id;
    if (!userId) return [];
    const store = await this.storage.getJson<CredentialRefsStore>(CREDENTIAL_REFS_KEY, {});
    return store[userId] ?? [];
  }

  async upsertRef(input: {
    id?: string;
    alias: string;
    provider: LlmProvider;
    model?: string;
    mode?: LlmCredentialMode;
    status?: LlmCredentialStatus;
    metadata?: { region?: string; baseUrl?: string };
  }): Promise<{ ok: boolean; message?: string; ref?: LlmCredentialRef }> {
    const guard = this.modeGuard.assertCloudLlmAllowed();
    if (!guard.ok) return guard;

    const userId = this.auth.actualUser()?.id;
    if (!userId) return { ok: false, message: 'llm.credentials.noUser' };

    const alias = input.alias.trim();
    if (!alias) return { ok: false, message: 'llm.credentials.aliasRequired' };

    const now = Date.now();
    const nextRefId = input.id ?? this.uid('llmcred');
    const nextRef: LlmCredentialRef = {
      id: nextRefId,
      userId,
      alias,
      provider: input.provider,
      mode: input.mode ?? 'clientHeld',
      status: input.status ?? 'unverified',
      model: input.model,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };

    const store = await this.storage.getJson<CredentialRefsStore>(CREDENTIAL_REFS_KEY, {});
    const current = store[userId] ?? [];
    const existing = current.find((entry) => entry.id === nextRefId);
    const merged: LlmCredentialRef = existing
      ? { ...existing, ...nextRef, createdAt: existing.createdAt, updatedAt: now }
      : nextRef;

    const next = existing
      ? current.map((entry) => (entry.id === merged.id ? merged : entry))
      : [...current, merged];
    await this.persistRefsWithRetry({ ...store, [userId]: next });

    return { ok: true, ref: merged };
  }

  async removeRef(credentialRefId: string): Promise<void> {
    const userId = this.auth.actualUser()?.id;
    if (!userId) return;
    const store = await this.storage.getJson<CredentialRefsStore>(CREDENTIAL_REFS_KEY, {});
    const current = store[userId] ?? [];
    const next = current.filter((entry) => entry.id !== credentialRefId);
    await this.persistRefsWithRetry({ ...store, [userId]: next });
    this.clearSecret(credentialRefId);
  }

  setSessionSecret(credentialRefId: string, secret: string): { ok: boolean; message?: string } {
    const guard = this.modeGuard.assertCloudLlmAllowed();
    if (!guard.ok) return guard;

    const normalized = secret.trim();
    if (!normalized) return { ok: false, message: 'llm.credentials.secretRequired' };

    this.runtimeSecrets.set(credentialRefId, normalized);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`${SECRET_SESSION_PREFIX}${credentialRefId}`, '1');
    }
    return { ok: true };
  }

  getSecret(credentialRefId: string): string | null {
    const inMemory = this.runtimeSecrets.get(credentialRefId);
    if (inMemory) return inMemory;
    return null;
  }

  clearSecret(credentialRefId: string): void {
    this.runtimeSecrets.delete(credentialRefId);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`${SECRET_SESSION_PREFIX}${credentialRefId}`);
    }
  }

  private uid(prefix: string): string {
    return `${prefix}_${this.secureRandomString(8)}`;
  }

  private secureRandomString(length: number): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    const cryptoObj = globalThis.crypto;
    if (cryptoObj?.getRandomValues) {
      const bytes = new Uint8Array(length);
      cryptoObj.getRandomValues(bytes);
      let result = '';
      for (const byte of bytes) {
        result += chars[byte % chars.length];
      }
      return result;
    }
    const fallback = Date.now().toString(36);
    return fallback.padEnd(length, '0').slice(0, length);
  }

  private async persistRefsWithRetry(store: CredentialRefsStore): Promise<void> {
    const serialized = JSON.stringify(store);
    await writeWithConflictRetry({
      key: CREDENTIAL_REFS_KEY,
      serialized,
      getCurrentSerialized: () => this.storage.getItemSync(CREDENTIAL_REFS_KEY),
      write: (payload) => this.storage.setItem(CREDENTIAL_REFS_KEY, payload),
      refresh: async () => {
        await this.storage.getItem(CREDENTIAL_REFS_KEY);
      },
    });
  }
}

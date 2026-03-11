import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { StorageService } from '../storage/storage.service';
import { DEFAULT_LLM_POLICY, LlmContext, LlmPolicy } from './llm-types';
import { LlmModeGuardService } from './llm-mode-guard.service';
import { writeWithConflictRetry } from '../storage/remote-write-utils';

const POLICY_KEY_PREFIX = 'op_llm_policy_v1';

@Injectable({ providedIn: 'root' })
export class LlmPolicyService {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly modeGuard = inject(LlmModeGuardService);

  async getPolicy(context: LlmContext): Promise<LlmPolicy> {
    return this.storage.getJson(this.key(context), DEFAULT_LLM_POLICY);
  }

  async setPolicy(
    context: LlmContext,
    policy: LlmPolicy,
  ): Promise<{ ok: boolean; message?: string }> {
    if (!this.auth.canInvite({ universeOwnerId: context.universeOwnerId })) {
      return { ok: false, message: 'llm.policy.unauthorized' };
    }
    await this.persistWithConflictRetry(this.key(context), policy);
    return { ok: true };
  }

  async canActivateResidents(context: LlmContext): Promise<boolean> {
    if (this.isCloudLlmBlockedBySession()) return false;
    if (!this.auth.canEditUniverse({ universeOwnerId: context.universeOwnerId })) return false;
    const policy = await this.getPolicy(context);
    return policy.enabled;
  }

  isCloudLlmBlockedBySession(): boolean {
    return !this.modeGuard.isCloudLlmAllowed();
  }

  private key(context: LlmContext): string {
    return `${POLICY_KEY_PREFIX}:${context.universeOwnerId}:${context.universeId}`;
  }

  private async persistWithConflictRetry(key: string, value: LlmPolicy): Promise<void> {
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

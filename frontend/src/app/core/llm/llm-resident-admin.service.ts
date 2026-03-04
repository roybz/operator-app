import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { LlmModeGuardService } from './llm-mode-guard.service';
import { LlmPencilLease, LlmPencilLeaseService } from './llm-pencil-lease.service';
import { LlmPolicyService } from './llm-policy.service';
import { LlmContext, LlmPolicy, LlmResident } from './llm-types';
import { LlmResidentService } from './llm-resident.service';

export interface LlmResidentAdminState {
  residents: LlmResident[];
  policy: LlmPolicy;
  lease: LlmPencilLease | null;
}

@Injectable({ providedIn: 'root' })
export class LlmResidentAdminService {
  private readonly auth = inject(AuthService);
  private readonly modeGuard = inject(LlmModeGuardService);
  private readonly residents = inject(LlmResidentService);
  private readonly policy = inject(LlmPolicyService);
  private readonly leases = inject(LlmPencilLeaseService);

  async loadState(context: LlmContext): Promise<LlmResidentAdminState> {
    const [residents, policy, lease] = await Promise.all([
      this.residents.list(context),
      this.policy.getPolicy(context),
      this.leases.getLease(context),
    ]);
    return { residents, policy, lease };
  }

  async upsertResident(
    context: LlmContext,
    resident: Omit<LlmResident, 'createdAt' | 'updatedAt' | 'universeOwnerId' | 'universeId'>,
  ): Promise<{ ok: boolean; message?: string; residents?: LlmResident[] }> {
    const guard = this.assertAdminManageAllowed(context);
    if (!guard.ok) return guard;
    const residents = await this.residents.upsert(context, resident);
    return { ok: true, residents };
  }

  async removeResident(
    context: LlmContext,
    residentId: string,
  ): Promise<{ ok: boolean; message?: string; residents?: LlmResident[] }> {
    const guard = this.assertAdminManageAllowed(context);
    if (!guard.ok) return guard;
    await this.leases.revokeLease(context, residentId);
    const residents = await this.residents.remove(context, residentId);
    return { ok: true, residents };
  }

  async setPolicy(
    context: LlmContext,
    policy: LlmPolicy,
  ): Promise<{ ok: boolean; message?: string }> {
    const guard = this.assertAdminManageAllowed(context);
    if (!guard.ok) return guard;
    return this.policy.setPolicy(context, policy);
  }

  async grantLease(
    context: LlmContext,
    residentId: string,
    residentName: string,
    ttlMs?: number,
  ): Promise<{ ok: boolean; message?: string; lease?: LlmPencilLease }> {
    const guard = this.assertAdminManageAllowed(context);
    if (!guard.ok) return guard;
    return this.leases.grantLease(context, { residentId, residentName, ttlMs });
  }

  async revokeLease(context: LlmContext, residentId?: string): Promise<{ ok: true }> {
    await this.leases.revokeLease(context, residentId);
    return { ok: true };
  }

  private assertAdminManageAllowed(
    context: LlmContext,
  ): { ok: true } | { ok: false; message: string } {
    const mode = this.modeGuard.assertCloudLlmAllowed();
    if (!mode.ok) return mode;
    if (!this.auth.canInvite({ universeOwnerId: context.universeOwnerId })) {
      return { ok: false, message: 'llm.policy.unauthorized' };
    }
    return { ok: true };
  }
}

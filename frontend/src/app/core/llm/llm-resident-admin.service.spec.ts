import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../auth.service';
import { LlmModeGuardService } from './llm-mode-guard.service';
import { LlmPencilLeaseService } from './llm-pencil-lease.service';
import { LlmPolicyService } from './llm-policy.service';
import { LlmResidentAdminService } from './llm-resident-admin.service';
import { LlmResidentService } from './llm-resident.service';
import { LlmResident } from './llm-types';

describe('LlmResidentAdminService', () => {
  const context = { universeOwnerId: 'u_owner', universeId: 'u1' };
  const resident = {
    id: 'r1',
    name: 'Agent One',
    provider: 'custom' as const,
    model: 'mock-1',
    role: 'editor' as const,
    active: true,
    permissions: {
      canWrite: true,
      canMoveDialogs: true,
      canCreateInstances: true,
      canComment: true,
    },
  };

  const authStub = {
    canInvite: vi.fn(() => true),
  };
  const modeGuardStub = {
    assertCloudLlmAllowed: vi.fn<
      () => { ok: true } | { ok: false; message: string }
    >(() => ({ ok: true })),
  };
  const residentStoreStub = {
    list: vi.fn<() => Promise<LlmResident[]>>(async () => []),
    upsert: vi.fn<() => Promise<LlmResident[]>>(async () => []),
    remove: vi.fn<() => Promise<LlmResident[]>>(async () => []),
  };
  const policyStub = {
    getPolicy: vi.fn(async () => ({
      enabled: true,
      requireActionConfirmation: true,
      maxActionsPerMinute: 20,
      maxTokensPerMinute: 12000,
      allowDestructiveActions: false,
    })),
    setPolicy: vi.fn(async () => ({ ok: true })),
  };
  const leaseStub = {
    getLease: vi.fn(async () => null),
    grantLease: vi.fn(async () => ({ ok: true })),
    revokeLease: vi.fn(async () => undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        LlmResidentAdminService,
        { provide: AuthService, useValue: authStub },
        { provide: LlmModeGuardService, useValue: modeGuardStub },
        { provide: LlmResidentService, useValue: residentStoreStub },
        { provide: LlmPolicyService, useValue: policyStub },
        { provide: LlmPencilLeaseService, useValue: leaseStub },
      ],
    });
  });

  it('loads residents + policy + lease state', async () => {
    const service = TestBed.inject(LlmResidentAdminService);
    const result = await service.loadState(context);
    expect(result.policy.enabled).toBe(true);
    expect(Array.isArray(result.residents)).toBe(true);
    expect(result.lease).toBeNull();
  });

  it('upserts resident when authorized', async () => {
    residentStoreStub.upsert.mockResolvedValueOnce([
      {
        ...resident,
        universeOwnerId: 'u_owner',
        universeId: 'u1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    const service = TestBed.inject(LlmResidentAdminService);
    const result = await service.upsertResident(context, resident);
    expect(result.ok).toBe(true);
    expect(residentStoreStub.upsert).toHaveBeenCalledTimes(1);
  });

  it('blocks writes when mode guard denies', async () => {
    modeGuardStub.assertCloudLlmAllowed.mockReturnValueOnce({
      ok: false as const,
      message: 'llm.mode.blocked',
    });
    const service = TestBed.inject(LlmResidentAdminService);
    const result = await service.setPolicy(context, {
      enabled: true,
      requireActionConfirmation: true,
      maxActionsPerMinute: 10,
      maxTokensPerMinute: 5000,
      allowDestructiveActions: false,
    });
    expect(result).toEqual({ ok: false, message: 'llm.mode.blocked' });
  });

  it('revokes lease before resident deletion', async () => {
    const service = TestBed.inject(LlmResidentAdminService);
    const result = await service.removeResident(context, 'r1');
    expect(result.ok).toBe(true);
    expect(leaseStub.revokeLease).toHaveBeenCalledWith(context, 'r1');
    expect(residentStoreStub.remove).toHaveBeenCalledWith(context, 'r1');
  });
});

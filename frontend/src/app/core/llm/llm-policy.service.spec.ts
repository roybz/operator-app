import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../auth.service';
import { StorageService } from '../storage/storage.service';
import { LlmPolicyService } from './llm-policy.service';
import { UserRole } from '../auth.service';

describe('LlmPolicyService', () => {
  const context = { universeOwnerId: 'u_admin', universeId: 'u1' };
  const storageMap = new Map<string, unknown>();

  const authState = {
    canInvite: true,
    canEditUniverse: true,
    guestModeOnly: false,
    actualUser: { id: 'u_admin', role: 'admin' as UserRole },
    testModeEnabled: false,
  };

  const authStub = {
    canInvite: vi.fn(() => authState.canInvite),
    canEditUniverse: vi.fn(() => authState.canEditUniverse),
    guestModeOnly: vi.fn(() => authState.guestModeOnly),
    actualUser: vi.fn(() => authState.actualUser),
    orgSettings: vi.fn(() => ({ testModeEnabled: authState.testModeEnabled })),
  };

  const storageStub = {
    getJson: vi.fn(async (key: string, fallback: unknown) =>
      storageMap.has(key) ? storageMap.get(key) : fallback,
    ),
    setJson: vi.fn(async (key: string, value: unknown) => {
      storageMap.set(key, value);
    }),
  };

  beforeEach(() => {
    storageMap.clear();
    authState.canInvite = true;
    authState.canEditUniverse = true;
    authState.guestModeOnly = false;
    authState.actualUser = { id: 'u_admin', role: 'admin' };
    authState.testModeEnabled = false;
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        LlmPolicyService,
        { provide: AuthService, useValue: authStub },
        { provide: StorageService, useValue: storageStub },
      ],
    });
  });

  it('blocks cloud llm when guest mode only is enabled', () => {
    authState.guestModeOnly = true;
    const service = TestBed.inject(LlmPolicyService);
    expect(service.isCloudLlmBlockedBySession()).toBe(true);
  });

  it('blocks cloud llm for guest users', () => {
    authState.actualUser = { id: 'u_guest', role: 'guest' };
    const service = TestBed.inject(LlmPolicyService);
    expect(service.isCloudLlmBlockedBySession()).toBe(true);
  });

  it('blocks cloud llm when org test mode is enabled', () => {
    authState.testModeEnabled = true;
    const service = TestBed.inject(LlmPolicyService);
    expect(service.isCloudLlmBlockedBySession()).toBe(true);
  });

  it('allows activation when policy is enabled and user can edit', async () => {
    const service = TestBed.inject(LlmPolicyService);
    await service.setPolicy(context, {
      enabled: true,
      requireActionConfirmation: true,
      maxActionsPerMinute: 20,
      maxTokensPerMinute: 12000,
      allowDestructiveActions: false,
    });

    await expect(service.canActivateResidents(context)).resolves.toBe(true);
  });

  it('rejects policy write when inviter permission is missing', async () => {
    authState.canInvite = false;
    const service = TestBed.inject(LlmPolicyService);

    await expect(
      service.setPolicy(context, {
        enabled: true,
        requireActionConfirmation: true,
        maxActionsPerMinute: 20,
        maxTokensPerMinute: 12000,
        allowDestructiveActions: false,
      }),
    ).resolves.toEqual({ ok: false, message: 'llm.policy.unauthorized' });
  });
});

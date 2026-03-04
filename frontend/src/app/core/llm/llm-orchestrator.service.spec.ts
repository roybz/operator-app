import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { LlmActionLogService } from './llm-action-log.service';
import { LlmCredentialRefService } from './llm-credential-ref.service';
import { LlmEnvelopeGuardService } from './llm-envelope-guard.service';
import { LlmModeGuardService } from './llm-mode-guard.service';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import { LlmPolicyService } from './llm-policy.service';
import { LlmProviderRegistryService } from './llm-provider-registry.service';
import { LlmResidentService } from './llm-resident.service';

describe('LlmOrchestratorService', () => {
  const context = { universeOwnerId: 'u_owner', universeId: 'u1' };
  const resident = {
    id: 'r1',
    universeOwnerId: 'u_owner',
    universeId: 'u1',
    name: 'Op Agent',
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
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const adapter = {
    name: 'custom' as const,
    supportsClientHeld: true,
    validateCredential: vi.fn(async () => ({ ok: true })),
    complete: vi.fn(async () => ({ text: 'ok', usage: { totalTokens: 2 } })),
  };

  const modeGuardStub = {
    assertCloudLlmAllowed: vi.fn(() => ({ ok: true as const })),
  };
  const policyStub = {
    getPolicy: vi.fn(async () => ({
      enabled: true,
      requireActionConfirmation: true,
      maxActionsPerMinute: 10,
      maxTokensPerMinute: 1000,
      allowDestructiveActions: false,
    })),
  };
  const credentialStub = {
    listForCurrentUser: vi.fn(async () => [
      {
        id: 'cred_1',
        userId: 'u_owner',
        alias: 'primary',
        provider: 'custom' as const,
        mode: 'clientHeld' as const,
        status: 'verified' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]),
    getSecret: vi.fn(() => 'sk-test'),
  };
  const providerRegistryStub = {
    resolve: vi.fn(() => adapter),
  };
  const residentStub = {
    list: vi.fn(async () => [resident]),
  };
  const envelopeStub = {
    hasSeen: vi.fn(async () => false),
    markSeen: vi.fn(async () => undefined),
  };
  const actionLogStub = {
    append: vi.fn(async () => []),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        LlmOrchestratorService,
        { provide: LlmModeGuardService, useValue: modeGuardStub },
        { provide: LlmPolicyService, useValue: policyStub },
        { provide: LlmCredentialRefService, useValue: credentialStub },
        { provide: LlmProviderRegistryService, useValue: providerRegistryStub },
        { provide: LlmResidentService, useValue: residentStub },
        { provide: LlmEnvelopeGuardService, useValue: envelopeStub },
        { provide: LlmActionLogService, useValue: actionLogStub },
      ],
    });
  });

  it('executes successfully and logs', async () => {
    const service = TestBed.inject(LlmOrchestratorService);

    const result = await service.execute({
      context,
      residentId: 'r1',
      credentialRefId: 'cred_1',
      requestId: 'req_1',
      actionType: 'chat.post',
      request: { model: 'mock-1', prompt: 'hello' },
      payload: { token: 'should-redact' },
    });

    expect(result.ok).toBe(true);
    expect(adapter.complete).toHaveBeenCalledTimes(1);
    expect(envelopeStub.markSeen).toHaveBeenCalledTimes(1);
    expect(actionLogStub.append).toHaveBeenCalledTimes(1);
    const firstCall = actionLogStub.append.mock.calls[0] as unknown[] | undefined;
    const envelope = (firstCall?.[1] as { payload?: Record<string, unknown> } | undefined) ?? {};
    expect(envelope.payload?.['token']).toBe('[REDACTED]');
  });

  it('deduplicates by request id without invoking provider again', async () => {
    envelopeStub.hasSeen.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const service = TestBed.inject(LlmOrchestratorService);

    const first = await service.execute({
      context,
      residentId: 'r1',
      credentialRefId: 'cred_1',
      requestId: 'req_dup',
      actionType: 'chat.post',
      request: { model: 'mock-1', prompt: 'hello' },
    });
    const second = await service.execute({
      context,
      residentId: 'r1',
      credentialRefId: 'cred_1',
      requestId: 'req_dup',
      actionType: 'chat.post',
      request: { model: 'mock-1', prompt: 'hello' },
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.deduplicated).toBe(true);
    expect(adapter.complete).toHaveBeenCalledTimes(1);
  });

  it('blocks when resident lacks required permission for action type', async () => {
    residentStub.list.mockResolvedValueOnce([
      {
        ...resident,
        permissions: {
          canWrite: false,
          canMoveDialogs: true,
          canCreateInstances: true,
          canComment: true,
        },
      },
    ]);
    const service = TestBed.inject(LlmOrchestratorService);

    const result = await service.execute({
      context,
      residentId: 'r1',
      credentialRefId: 'cred_1',
      requestId: 'req_perm',
      actionType: 'instance.write',
      request: { model: 'mock-1', prompt: 'write' },
    });

    expect(result).toEqual({ ok: false, message: 'llm.resident.actionDenied' });
    expect(adapter.complete).not.toHaveBeenCalled();
  });

  it('enforces action rate limits', async () => {
    policyStub.getPolicy.mockResolvedValue({
      enabled: true,
      requireActionConfirmation: true,
      maxActionsPerMinute: 1,
      maxTokensPerMinute: 1000,
      allowDestructiveActions: false,
    });
    const service = TestBed.inject(LlmOrchestratorService);

    await service.execute({
      context,
      residentId: 'r1',
      credentialRefId: 'cred_1',
      requestId: 'req_rate_1',
      actionType: 'chat.post',
      request: { model: 'mock-1', prompt: 'a' },
    });
    const second = await service.execute({
      context,
      residentId: 'r1',
      credentialRefId: 'cred_1',
      requestId: 'req_rate_2',
      actionType: 'chat.post',
      request: { model: 'mock-1', prompt: 'b' },
    });

    expect(second).toEqual({ ok: false, message: 'llm.rate.actionLimit' });
  });
});

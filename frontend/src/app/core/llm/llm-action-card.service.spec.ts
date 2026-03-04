import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../auth.service';
import { StorageService } from '../storage/storage.service';
import { LlmActionCardService } from './llm-action-card.service';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import { LlmPolicyService } from './llm-policy.service';

describe('LlmActionCardService', () => {
  const memory = new Map<string, string>();
  const storageStub = {
    getItem: vi.fn(async (key: string) => {
      return memory.has(key) ? memory.get(key) : null;
    }),
    getItemSync: vi.fn((key: string) => memory.get(key) ?? null),
    getJson: vi.fn(async <T>(key: string, fallback: T): Promise<T> => {
      const raw = memory.get(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      memory.set(key, value);
    }),
  };
  const authStub = {
    actualUser: vi.fn(() => ({ id: 'u_owner', username: 'owner', role: 'admin' })),
  };
  const policyStub = {
    getPolicy: vi.fn(async () => ({
      enabled: true,
      requireActionConfirmation: true,
      maxActionsPerMinute: 20,
      maxTokensPerMinute: 12_000,
      allowDestructiveActions: false,
    })),
  };
  const orchestratorStub = {
    execute: vi.fn(async () => ({ ok: true, response: { text: 'done' } })),
  };

  const context = { universeOwnerId: 'u_owner', universeId: 'uv1' };

  beforeEach(() => {
    memory.clear();
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        LlmActionCardService,
        { provide: StorageService, useValue: storageStub },
        { provide: AuthService, useValue: authStub },
        { provide: LlmPolicyService, useValue: policyStub },
        { provide: LlmOrchestratorService, useValue: orchestratorStub },
      ],
    });
  });

  it('proposes and approves a card', async () => {
    const service = TestBed.inject(LlmActionCardService);
    const proposed = await service.propose(context, {
      residentId: 'r1',
      credentialRefId: 'cred_1',
      actionType: 'chat.post',
      model: 'gpt-4.1-mini',
      prompt: 'hello',
    });
    expect(proposed.ok).toBe(true);
    const approved = await service.approve(context, proposed.card!.id);
    expect(approved.ok).toBe(true);
    expect(approved.card?.status).toBe('approved');
  });

  it('requires approval before execute when policy demands confirmation', async () => {
    const service = TestBed.inject(LlmActionCardService);
    const proposed = await service.propose(context, {
      residentId: 'r1',
      credentialRefId: 'cred_1',
      actionType: 'chat.post',
      model: 'gpt-4.1-mini',
      prompt: 'hello',
    });
    const executed = await service.execute(context, proposed.card!.id);
    expect(executed).toEqual({ ok: false, message: 'llm.workflow.approvalRequired' });
    expect(orchestratorStub.execute).not.toHaveBeenCalled();
  });

  it('executes approved cards and stores response text', async () => {
    const service = TestBed.inject(LlmActionCardService);
    const proposed = await service.propose(context, {
      residentId: 'r1',
      credentialRefId: 'cred_1',
      actionType: 'chat.post',
      model: 'gpt-4.1-mini',
      prompt: 'hello',
    });
    await service.approve(context, proposed.card!.id);
    const executed = await service.execute(context, proposed.card!.id);
    expect(executed.ok).toBe(true);
    expect(executed.card?.status).toBe('executed');
    expect(executed.card?.responseText).toBe('done');
  });
});

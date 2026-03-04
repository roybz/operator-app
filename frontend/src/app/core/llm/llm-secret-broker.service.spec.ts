import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CognitoOidcService } from '../auth/cognito-oidc.service';
import { LlmSecretBrokerService } from './llm-secret-broker.service';

describe('LlmSecretBrokerService', () => {
  const cognitoStub = {
    getAccessToken: vi.fn(async () => 'token_123'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [LlmSecretBrokerService, { provide: CognitoOidcService, useValue: cognitoStub }],
    });
  });

  it('returns disabled when broker capability is not enabled', async () => {
    (window as Window & { __OP_CONFIG__?: Record<string, unknown> }).__OP_CONFIG__ = {
      llmSecretBrokerEnabled: false,
      llmSecretBrokerBaseUrl: 'https://broker.example.com',
      capabilities: { llmSecretBroker: false },
    };
    const service = TestBed.inject(LlmSecretBrokerService);
    const result = await service.execute({
      context: { universeOwnerId: 'u1', universeId: 'uv1' },
      residentId: 'r1',
      credentialRef: {
        id: 'cred',
        userId: 'u1',
        alias: 'a',
        provider: 'openai',
        mode: 'serverHeld',
        status: 'verified',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      requestId: 'req_1',
      actionType: 'chat.post',
      request: { model: 'gpt-4.1-mini', prompt: 'hello' },
    });
    expect(result).toEqual({ ok: false, message: 'llm.broker.disabled' });
  });

  it('posts execute payload to broker and maps the response', async () => {
    (window as Window & { __OP_CONFIG__?: Record<string, unknown> }).__OP_CONFIG__ = {
      llmSecretBrokerEnabled: true,
      llmSecretBrokerBaseUrl: 'https://broker.example.com',
      capabilities: { llmSecretBroker: true },
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          text: 'done',
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const service = TestBed.inject(LlmSecretBrokerService);
    const result = await service.execute({
      context: { universeOwnerId: 'u1', universeId: 'uv1' },
      residentId: 'r1',
      credentialRef: {
        id: 'cred',
        userId: 'u1',
        alias: 'a',
        provider: 'openai',
        mode: 'serverHeld',
        status: 'verified',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      requestId: 'req_2',
      actionType: 'chat.post',
      request: { model: 'gpt-4.1-mini', prompt: 'hello' },
    });

    expect(result.ok).toBe(true);
    expect(result.response?.text).toBe('done');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });
});

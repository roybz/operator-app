import { Injectable, inject } from '@angular/core';
import { CognitoOidcService } from '../auth/cognito-oidc.service';
import { getOpCapabilities, getOpConfig } from '../op-config';
import { LlmContext, LlmCredentialRef, LlmProviderRequest, LlmProviderResponse } from './llm-types';

interface BrokerExecuteInput {
  context: LlmContext;
  residentId: string;
  credentialRef: LlmCredentialRef;
  requestId: string;
  actionType: string;
  request: LlmProviderRequest;
}

interface BrokerExecuteResponse {
  ok?: boolean;
  text?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  errorCode?: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class LlmSecretBrokerService {
  private readonly cognitoOidc = inject(CognitoOidcService);

  isEnabled(): boolean {
    const caps = getOpCapabilities();
    const config = getOpConfig();
    return caps.llmSecretBroker && Boolean(config.llmSecretBrokerBaseUrl);
  }

  async execute(
    input: BrokerExecuteInput,
  ): Promise<{ ok: boolean; message?: string; response?: LlmProviderResponse }> {
    if (!this.isEnabled()) {
      return { ok: false, message: 'llm.broker.disabled' };
    }
    const response = await this.safePost<BrokerExecuteResponse>('/llm/execute', {
      universeOwnerId: input.context.universeOwnerId,
      universeId: input.context.universeId,
      residentId: input.residentId,
      credentialRefId: input.credentialRef.id,
      provider: input.credentialRef.provider,
      model: input.request.model,
      requestId: input.requestId,
      actionType: input.actionType,
      request: {
        prompt: input.request.prompt,
        maxTokens: input.request.maxTokens,
        temperature: input.request.temperature,
      },
    });
    if (!response.ok || !response.data?.ok) {
      return {
        ok: false,
        message: response.data?.errorCode ?? response.data?.message ?? 'llm.broker.failed',
      };
    }
    return {
      ok: true,
      response: {
        text: response.data.text ?? '',
        usage: response.data.usage,
      },
    };
  }

  private async safePost<T>(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<{ ok: boolean; data?: T }> {
    const config = getOpConfig();
    const baseUrl = String(config.llmSecretBrokerBaseUrl ?? '').replace(/\/$/, '');
    if (!baseUrl) return { ok: false };
    const timeoutMs = Math.max(1000, Number(config.llmSecretBrokerTimeoutMs ?? 12_000));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const token = await this.cognitoOidc.getAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) return { ok: false };
      const data = (await response.json()) as T;
      return { ok: true, data };
    } catch {
      return { ok: false };
    } finally {
      clearTimeout(timeout);
    }
  }
}

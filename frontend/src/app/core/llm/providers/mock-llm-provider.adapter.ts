import { Injectable } from '@angular/core';
import { LlmProviderAdapter, LlmProviderRequest, LlmProviderResponse } from '../llm-types';

@Injectable({ providedIn: 'root' })
export class MockLlmProviderAdapter implements LlmProviderAdapter {
  readonly name = 'custom' as const;
  readonly supportsClientHeld = true;

  async validateCredential(secret: string): Promise<{ ok: boolean; message?: string }> {
    if (!secret.trim()) return { ok: false, message: 'llm.credentials.secretRequired' };
    return { ok: true };
  }

  async complete(request: LlmProviderRequest): Promise<LlmProviderResponse> {
    const prompt = request.prompt.trim();
    const text = prompt ? `Mock response: ${prompt.slice(0, 320)}` : 'Mock response: ready.';
    return {
      text,
      usage: {
        promptTokens: Math.ceil(prompt.length / 4),
        completionTokens: Math.ceil(text.length / 4),
        totalTokens: Math.ceil((prompt.length + text.length) / 4),
      },
    };
  }
}

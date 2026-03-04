import { Injectable } from '@angular/core';
import { LlmProviderAdapter, LlmProviderRequest, LlmProviderResponse } from '../llm-types';

interface AnthropicResponse {
  content?: { type?: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

@Injectable({ providedIn: 'root' })
export class AnthropicLlmProviderAdapter implements LlmProviderAdapter {
  readonly name = 'anthropic' as const;
  readonly supportsClientHeld = true;

  async validateCredential(secret: string): Promise<{ ok: boolean; message?: string }> {
    if (!secret.trim()) return { ok: false, message: 'llm.credentials.secretRequired' };
    return { ok: true };
  }

  async complete(request: LlmProviderRequest, secret: string): Promise<LlmProviderResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': secret,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens ?? 512,
        temperature: request.temperature ?? 0.7,
        messages: [{ role: 'user', content: request.prompt }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Anthropic request failed (${response.status})`);
    }
    const data = (await response.json()) as AnthropicResponse;
    const text = (data.content ?? [])
      .filter((entry) => entry.type === 'text')
      .map((entry) => entry.text ?? '')
      .join('\n')
      .trim();
    const promptTokens = data.usage?.input_tokens;
    const completionTokens = data.usage?.output_tokens;
    const totalTokens =
      typeof promptTokens === 'number' && typeof completionTokens === 'number'
        ? promptTokens + completionTokens
        : undefined;
    return {
      text,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
      },
    };
  }
}

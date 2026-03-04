import { Injectable } from '@angular/core';
import { LlmProviderAdapter, LlmProviderRequest, LlmProviderResponse } from '../llm-types';

interface OpenAiResponse {
  output_text?: string;
  output?: { content?: { text?: string }[] }[];
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
}

@Injectable({ providedIn: 'root' })
export class OpenAiLlmProviderAdapter implements LlmProviderAdapter {
  readonly name = 'openai' as const;
  readonly supportsClientHeld = true;

  async validateCredential(secret: string): Promise<{ ok: boolean; message?: string }> {
    if (!secret.trim()) return { ok: false, message: 'llm.credentials.secretRequired' };
    return { ok: true };
  }

  async complete(request: LlmProviderRequest, secret: string): Promise<LlmProviderResponse> {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        model: request.model,
        input: request.prompt,
        ...(typeof request.maxTokens === 'number' ? { max_output_tokens: request.maxTokens } : {}),
        ...(typeof request.temperature === 'number' ? { temperature: request.temperature } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI request failed (${response.status})`);
    }
    const data = (await response.json()) as OpenAiResponse;
    const fallbackText =
      data.output
        ?.flatMap((entry) => entry.content ?? [])
        .map((entry) => entry.text ?? '')
        .join('\n')
        .trim() ?? '';
    const text = (data.output_text ?? fallbackText ?? '').trim();
    return {
      text,
      usage: {
        promptTokens: data.usage?.input_tokens,
        completionTokens: data.usage?.output_tokens,
        totalTokens: data.usage?.total_tokens,
      },
    };
  }
}

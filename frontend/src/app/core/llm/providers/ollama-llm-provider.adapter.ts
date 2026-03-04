import { Injectable } from '@angular/core';
import { LlmProviderAdapter, LlmProviderRequest, LlmProviderResponse } from '../llm-types';

interface OllamaResponse {
  response?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

@Injectable({ providedIn: 'root' })
export class OllamaLlmProviderAdapter implements LlmProviderAdapter {
  readonly name = 'ollama' as const;
  readonly supportsClientHeld = true;

  async validateCredential(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true };
  }

  async complete(request: LlmProviderRequest): Promise<LlmProviderResponse> {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        stream: false,
        options: {
          ...(typeof request.temperature === 'number' ? { temperature: request.temperature } : {}),
          ...(typeof request.maxTokens === 'number' ? { num_predict: request.maxTokens } : {}),
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Ollama request failed (${response.status})`);
    }
    const data = (await response.json()) as OllamaResponse;
    const promptTokens = data.prompt_eval_count;
    const completionTokens = data.eval_count;
    const totalTokens =
      typeof promptTokens === 'number' && typeof completionTokens === 'number'
        ? promptTokens + completionTokens
        : undefined;
    return {
      text: (data.response ?? '').trim(),
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
      },
    };
  }
}

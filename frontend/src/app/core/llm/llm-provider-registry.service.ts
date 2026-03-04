import { Injectable, inject } from '@angular/core';
import { LlmProvider, LlmProviderAdapter } from './llm-types';
import { AnthropicLlmProviderAdapter } from './providers/anthropic-llm-provider.adapter';
import { MockLlmProviderAdapter } from './providers/mock-llm-provider.adapter';
import { OllamaLlmProviderAdapter } from './providers/ollama-llm-provider.adapter';
import { OpenAiLlmProviderAdapter } from './providers/openai-llm-provider.adapter';

@Injectable({ providedIn: 'root' })
export class LlmProviderRegistryService {
  private readonly mockProvider = inject(MockLlmProviderAdapter);
  private readonly openaiProvider = inject(OpenAiLlmProviderAdapter);
  private readonly anthropicProvider = inject(AnthropicLlmProviderAdapter);
  private readonly ollamaProvider = inject(OllamaLlmProviderAdapter);

  private readonly providers: Partial<Record<LlmProvider, LlmProviderAdapter>> = {
    custom: this.mockProvider,
    openai: this.openaiProvider,
    anthropic: this.anthropicProvider,
    ollama: this.ollamaProvider,
  };

  resolve(provider: LlmProvider): LlmProviderAdapter {
    return this.providers[provider] ?? this.mockProvider;
  }
}

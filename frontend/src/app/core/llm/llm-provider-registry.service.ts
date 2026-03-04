import { Injectable, inject } from '@angular/core';
import { LlmProvider, LlmProviderAdapter } from './llm-types';
import { MockLlmProviderAdapter } from './providers/mock-llm-provider.adapter';

@Injectable({ providedIn: 'root' })
export class LlmProviderRegistryService {
  private readonly mockProvider = inject(MockLlmProviderAdapter);

  private readonly providers: Partial<Record<LlmProvider, LlmProviderAdapter>> = {
    custom: this.mockProvider,
    // External providers are intentionally not enabled until explicit adapter hardening is completed.
    openai: this.mockProvider,
    anthropic: this.mockProvider,
    ollama: this.mockProvider,
  };

  resolve(provider: LlmProvider): LlmProviderAdapter {
    return this.providers[provider] ?? this.mockProvider;
  }
}

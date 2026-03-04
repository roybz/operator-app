import { TestBed } from '@angular/core/testing';
import { LlmProviderRegistryService } from './llm-provider-registry.service';

describe('LlmProviderRegistryService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LlmProviderRegistryService],
    });
  });

  it('resolves configured providers and falls back to mock adapter', () => {
    const service = TestBed.inject(LlmProviderRegistryService);

    const custom = service.resolve('custom');
    const openai = service.resolve('openai');
    const unknown = service.resolve('custom_unknown' as never);

    expect(custom.name).toBe('custom');
    expect(openai.name).toBe('openai');
    expect(unknown.name).toBe('custom');
  });
});

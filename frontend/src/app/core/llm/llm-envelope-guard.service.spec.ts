import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { StorageService } from '../storage/storage.service';
import { LlmEnvelopeGuardService } from './llm-envelope-guard.service';

describe('LlmEnvelopeGuardService', () => {
  const store = new Map<string, unknown>();
  const storageStub = {
    getItem: vi.fn(async (key: string) => {
      const value = store.get(key);
      return value === undefined ? null : JSON.stringify(value);
    }),
    getItemSync: vi.fn((key: string) => {
      const value = store.get(key);
      return value === undefined ? null : JSON.stringify(value);
    }),
    getJson: vi.fn(async (key: string, fallback: unknown) =>
      store.has(key) ? store.get(key) : fallback,
    ),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, JSON.parse(value));
    }),
  };

  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [LlmEnvelopeGuardService, { provide: StorageService, useValue: storageStub }],
    });
  });

  it('deduplicates seen request ids', async () => {
    const service = TestBed.inject(LlmEnvelopeGuardService);
    await expect(service.hasSeen('u_owner', 'u1', 'req-1')).resolves.toBe(false);
    await service.markSeen('u_owner', 'u1', 'req-1');
    await expect(service.hasSeen('u_owner', 'u1', 'req-1')).resolves.toBe(true);
  });
});

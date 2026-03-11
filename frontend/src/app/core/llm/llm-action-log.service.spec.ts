import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { StorageService } from '../storage/storage.service';
import { LlmActionLogService } from './llm-action-log.service';

describe('LlmActionLogService', () => {
  const storageMap = new Map<string, unknown>();
  const storageStub = {
    getItem: vi.fn(async (key: string) => {
      const value = storageMap.get(key);
      if (value === undefined) return null;
      return JSON.stringify(value);
    }),
    getItemSync: vi.fn((key: string) => {
      const value = storageMap.get(key);
      if (value === undefined) return null;
      return JSON.stringify(value);
    }),
    getJson: vi.fn(async (key: string, fallback: unknown) =>
      storageMap.has(key) ? storageMap.get(key) : fallback,
    ),
    setItem: vi.fn(async (key: string, value: string) => {
      storageMap.set(key, JSON.parse(value));
    }),
  };

  const context = { universeOwnerId: 'u_owner', universeId: 'u1' };

  beforeEach(() => {
    storageMap.clear();
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [LlmActionLogService, { provide: StorageService, useValue: storageStub }],
    });
  });

  it('appends newest-first action entries', async () => {
    const service = TestBed.inject(LlmActionLogService);

    await service.append(context, {
      id: 'a1',
      requestId: 'a1',
      residentId: 'r1',
      universeOwnerId: context.universeOwnerId,
      universeId: context.universeId,
      actionType: 'chat.post',
      payload: { text: 'one' },
      success: true,
      createdAt: 1,
    });
    await service.append(context, {
      id: 'a2',
      requestId: 'a2',
      residentId: 'r1',
      universeOwnerId: context.universeOwnerId,
      universeId: context.universeId,
      actionType: 'chat.post',
      payload: { text: 'two' },
      success: true,
      createdAt: 2,
    });

    const entries = await service.list(context);
    expect(entries.map((entry) => entry.id)).toEqual(['a2', 'a1']);
  });

  it('caps log length to 500 entries', async () => {
    const service = TestBed.inject(LlmActionLogService);

    for (let index = 0; index < 510; index += 1) {
      await service.append(context, {
        id: `a${index}`,
        requestId: `a${index}`,
        residentId: 'r1',
        universeOwnerId: context.universeOwnerId,
        universeId: context.universeId,
        actionType: 'chat.post',
        payload: { text: index },
        success: true,
        createdAt: index,
      });
    }

    const entries = await service.list(context);
    expect(entries).toHaveLength(500);
    expect(entries[0]?.id).toBe('a509');
    expect(entries.at(-1)?.id).toBe('a10');
  });
});

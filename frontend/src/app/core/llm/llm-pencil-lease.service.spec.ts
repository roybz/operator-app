import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../auth.service';
import { StorageService } from '../storage/storage.service';
import { LlmPencilLeaseService } from './llm-pencil-lease.service';

describe('LlmPencilLeaseService', () => {
  const context = { universeOwnerId: 'u_owner', universeId: 'u1' };
  const store = new Map<string, unknown>();
  const holderState = new Map<string, { id: string; username: string; role: 'observer' | 'invitee' } | null>();

  const authStub = {
    canGrantPencil: vi.fn(() => true),
    session: vi.fn(() => ({ userId: 'u_admin' })),
    getUniverseEditHolder: vi.fn((universeId: string) => holderState.get(universeId) ?? null),
    setUniverseEditHolder: vi.fn(
      (
        universeId: string,
        holder: { id: string; username: string; role: 'observer' | 'invitee' } | null,
      ) => {
        holderState.set(universeId, holder);
      },
    ),
  };
  const storageStub = {
    getItem: vi.fn(async (key: string) => {
      const value = store.get(key);
      if (value === undefined) return null;
      return JSON.stringify(value);
    }),
    getItemSync: vi.fn((key: string) => {
      const value = store.get(key);
      if (value === undefined) return null;
      return JSON.stringify(value);
    }),
    getJson: vi.fn(async (key: string, fallback: unknown) =>
      store.has(key) ? (store.get(key) ?? null) : fallback,
    ),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, JSON.parse(value));
    }),
  };

  beforeEach(() => {
    store.clear();
    holderState.clear();
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        LlmPencilLeaseService,
        { provide: AuthService, useValue: authStub },
        { provide: StorageService, useValue: storageStub },
      ],
    });
  });

  it('grants a lease and mirrors holder state', async () => {
    const service = TestBed.inject(LlmPencilLeaseService);
    const result = await service.grantLease(context, {
      residentId: 'r1',
      residentName: 'Agent One',
    });

    expect(result.ok).toBe(true);
    expect(result.lease?.residentId).toBe('r1');
    expect(authStub.setUniverseEditHolder).toHaveBeenCalledWith('u1', {
      id: 'r1',
      username: 'Agent One',
      role: 'observer',
    });
  });

  it('revokes lease and clears holder when holder matches resident', async () => {
    const service = TestBed.inject(LlmPencilLeaseService);
    await service.grantLease(context, { residentId: 'r1', residentName: 'Agent One' });
    await service.revokeLease(context, 'r1');

    expect(authStub.setUniverseEditHolder).toHaveBeenLastCalledWith('u1', null);
    expect(await service.getLease(context)).toBeNull();
  });

  it('expires stale lease automatically on read', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-04T12:00:00Z'));
    const service = TestBed.inject(LlmPencilLeaseService);
    await service.grantLease(context, {
      residentId: 'r1',
      residentName: 'Agent One',
      ttlMs: 20_000,
    });

    vi.setSystemTime(new Date('2026-03-04T12:01:00Z'));
    const lease = await service.getLease(context);

    expect(lease).toBeNull();
    expect(authStub.setUniverseEditHolder).toHaveBeenLastCalledWith('u1', null);
    vi.useRealTimers();
  });

  it('blocks grant when actor cannot grant pencil', async () => {
    authStub.canGrantPencil.mockReturnValueOnce(false);
    const service = TestBed.inject(LlmPencilLeaseService);
    const result = await service.grantLease(context, {
      residentId: 'r1',
      residentName: 'Agent One',
    });
    expect(result).toEqual({ ok: false, message: 'llm.lease.unauthorized' });
  });
});

import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../auth.service';
import { StorageService } from '../storage/storage.service';
import { LlmCredentialRefService } from './llm-credential-ref.service';
import { LlmModeGuardService } from './llm-mode-guard.service';

describe('LlmCredentialRefService', () => {
  const store = new Map<string, unknown>();
  const authStub = {
    actualUser: vi.fn(() => ({ id: 'u_admin' })),
  };
  const modeGuardStub = {
    assertCloudLlmAllowed: vi.fn((): { ok: true } | { ok: false; message: string } => ({
      ok: true,
    })),
  };
  const storageStub = {
    getJson: vi.fn(async (key: string, fallback: unknown) =>
      store.has(key) ? store.get(key) : fallback,
    ),
    setJson: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
  };

  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        LlmCredentialRefService,
        { provide: AuthService, useValue: authStub },
        { provide: LlmModeGuardService, useValue: modeGuardStub },
        { provide: StorageService, useValue: storageStub },
      ],
    });
    sessionStorage.clear();
  });

  it('persists metadata-only credential refs without secret material', async () => {
    const service = TestBed.inject(LlmCredentialRefService);

    const result = await service.upsertRef({ alias: 'Primary', provider: 'openai' });
    expect(result.ok).toBe(true);

    const refs = await service.listForCurrentUser();
    expect(refs).toHaveLength(1);
    expect(Object.keys(refs[0] ?? {})).not.toContain('secret');
  });

  it('stores and reads secret from session scope only', () => {
    const service = TestBed.inject(LlmCredentialRefService);

    expect(service.setSessionSecret('cred_1', 'sk-test')).toEqual({ ok: true });
    expect(service.getSecret('cred_1')).toBe('sk-test');

    service.clearSecret('cred_1');
    expect(service.getSecret('cred_1')).toBeNull();
  });

  it('refuses writes when mode guard blocks cloud llm', async () => {
    modeGuardStub.assertCloudLlmAllowed.mockReturnValue({
      ok: false as const,
      message: 'llm.mode.blocked',
    });
    const service = TestBed.inject(LlmCredentialRefService);

    await expect(service.upsertRef({ alias: 'Blocked', provider: 'openai' })).resolves.toEqual({
      ok: false,
      message: 'llm.mode.blocked',
    });
  });
});

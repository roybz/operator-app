import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService, UserRole } from '../auth.service';
import { LlmModeGuardService } from './llm-mode-guard.service';

describe('LlmModeGuardService', () => {
  const state = {
    guestModeOnly: false,
    testModeEnabled: false,
    user: { id: 'u_admin', role: 'admin' as UserRole },
  };

  const authStub = {
    guestModeOnly: vi.fn(() => state.guestModeOnly),
    orgSettings: vi.fn(() => ({ testModeEnabled: state.testModeEnabled })),
    actualUser: vi.fn(() => state.user),
  };

  beforeEach(() => {
    state.guestModeOnly = false;
    state.testModeEnabled = false;
    state.user = { id: 'u_admin', role: 'admin' };
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [LlmModeGuardService, { provide: AuthService, useValue: authStub }],
    });
  });

  it('allows cloud llm for authenticated non-guest admin/user', () => {
    const service = TestBed.inject(LlmModeGuardService);
    expect(service.isCloudLlmAllowed()).toBe(true);
  });

  it('blocks in guest-only mode', () => {
    state.guestModeOnly = true;
    const service = TestBed.inject(LlmModeGuardService);
    expect(service.isCloudLlmAllowed()).toBe(false);
  });

  it('blocks observer/guest roles and test mode', () => {
    state.user = { id: 'u_obs', role: 'observer' };
    const service = TestBed.inject(LlmModeGuardService);
    expect(service.isCloudLlmAllowed()).toBe(false);

    state.user = { id: 'u_user', role: 'user' };
    state.testModeEnabled = true;
    expect(service.isCloudLlmAllowed()).toBe(false);
  });
});

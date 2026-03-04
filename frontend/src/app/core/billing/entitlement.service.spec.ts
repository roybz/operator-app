import { TestBed } from '@angular/core/testing';
import { EntitlementService } from './entitlement.service';
import { AuthService } from '../auth.service';

const makeAuthStub = () =>
  ({
    guestModeOnly: () => false,
    isLoggedIn: () => true,
    session: () => ({ userId: 'u_1' }),
    orgSettings: () => ({ testModeEnabled: false }),
  }) as unknown as AuthService;

describe('EntitlementService', () => {
  afterEach(() => {
    const w = window as Window & { __OP_CONFIG__?: Record<string, unknown> };
    delete w.__OP_CONFIG__;
  });

  it('grants cloud vault entitlement with valid runtime conditions', () => {
    const w = window as Window & { __OP_CONFIG__?: Record<string, unknown> };
    w.__OP_CONFIG__ = { capabilities: { billingGuard: true, cloudVault: true } };
    TestBed.configureTestingModule({
      providers: [EntitlementService, { provide: AuthService, useValue: makeAuthStub() }],
    });
    const service = TestBed.inject(EntitlementService);
    expect(service.canUseCloudVaultBeta().status).toBe('granted');
  });

  it('denies when billing guard is enabled and guest mode is active', () => {
    const w = window as Window & { __OP_CONFIG__?: Record<string, unknown> };
    w.__OP_CONFIG__ = { capabilities: { billingGuard: true, cloudVault: true } };
    const auth = makeAuthStub();
    (auth.guestModeOnly as unknown as () => boolean) = () => true;
    TestBed.configureTestingModule({
      providers: [EntitlementService, { provide: AuthService, useValue: auth }],
    });
    const service = TestBed.inject(EntitlementService);
    const result = service.canUseCloudVaultBeta();
    expect(result.status).toBe('denied');
    expect(result.code).toBe('guest_mode_only');
  });
});

import { describe, expect, it, vi, afterEach } from 'vitest';
import { CognitoOidcService } from './cognito-oidc.service';

describe('CognitoOidcService signup guard', () => {
  afterEach(() => {
    const w = window as Window & { __OP_CONFIG__?: Record<string, unknown> };
    delete w.__OP_CONFIG__;
  });

  it('does not start signup flow when public signup capability is disabled', async () => {
    const w = window as Window & { __OP_CONFIG__?: Record<string, unknown> };
    w.__OP_CONFIG__ = {
      authProvider: 'cognito',
      cognito: { enabled: true, domain: 'https://example.test', clientId: 'client-1' },
      capabilities: { auth: true, publicSignupPrepared: true, publicSignupEnabled: false },
    };
    const service = new CognitoOidcService();
    const authorizeSpy = vi
      .spyOn(
        service as unknown as { startAuthorizeFlow: (arg?: unknown) => Promise<void> },
        'startAuthorizeFlow',
      )
      .mockResolvedValue();

    await service.startSignup();

    expect(authorizeSpy).not.toHaveBeenCalled();
  });

  it('starts signup flow when public signup capability is enabled', async () => {
    const w = window as Window & { __OP_CONFIG__?: Record<string, unknown> };
    w.__OP_CONFIG__ = {
      authProvider: 'cognito',
      cognito: { enabled: true, domain: 'https://example.test', clientId: 'client-1' },
      capabilities: { auth: true, publicSignupPrepared: true, publicSignupEnabled: true },
    };
    const service = new CognitoOidcService();
    const authorizeSpy = vi
      .spyOn(
        service as unknown as { startAuthorizeFlow: (arg?: unknown) => Promise<void> },
        'startAuthorizeFlow',
      )
      .mockResolvedValue();

    await service.startSignup();

    expect(authorizeSpy).toHaveBeenCalledTimes(1);
    expect(authorizeSpy).toHaveBeenCalledWith({ screenHint: 'signup' });
  });

  it('defaults token session persistence to sessionStorage', () => {
    const w = window as Window & { __OP_CONFIG__?: Record<string, unknown> };
    w.__OP_CONFIG__ = {
      authProvider: 'cognito',
      cognito: { enabled: true, domain: 'https://example.test', clientId: 'client-1' },
      capabilities: { auth: true },
    };
    const service = new CognitoOidcService();

    const storage = (
      service as unknown as { sessionStorage: () => Storage | null }
    ).sessionStorage();

    expect(storage).toBe(window.sessionStorage);
  });

  it('allows explicit localStorage session persistence opt-in', () => {
    const w = window as Window & { __OP_CONFIG__?: Record<string, unknown> };
    w.__OP_CONFIG__ = {
      authProvider: 'cognito',
      cognito: {
        enabled: true,
        domain: 'https://example.test',
        clientId: 'client-1',
        sessionPersistence: 'localStorage',
      },
      capabilities: { auth: true },
    };
    const service = new CognitoOidcService();

    const storage = (
      service as unknown as { sessionStorage: () => Storage | null }
    ).sessionStorage();

    expect(storage).toBe(window.localStorage);
  });
});

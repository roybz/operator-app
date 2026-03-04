import { getOpCapabilities, getOpConfig, type OpRuntimeConfig } from './op-config';

type OpWindow = Window & {
  __OP_CONFIG__?: OpRuntimeConfig;
};

describe('op-config capability registry', () => {
  afterEach(() => {
    const w = window as OpWindow;
    delete w.__OP_CONFIG__;
  });

  it('returns empty config safely when runtime config is missing', () => {
    const config = getOpConfig();
    expect(config).toEqual({});
  });

  it('derives default capabilities from runtime config', () => {
    const caps = getOpCapabilities({
      authProvider: 'cognito',
      cognito: { enabled: true },
      realtimeEnabled: true,
      realtimeWsUrl: 'wss://example.test',
      publicSignupPrepared: true,
      publicSignupEnabled: false,
    });

    expect(caps.auth).toBe(true);
    expect(caps.realtime).toBe(true);
    expect(caps.cloudVault).toBe(true);
    expect(caps.billingGuard).toBe(true);
    expect(caps.shareLinks).toBe(true);
    expect(caps.publicSignupPrepared).toBe(true);
    expect(caps.publicSignupEnabled).toBe(false);
  });

  it('allows explicit capability overrides from config', () => {
    const caps = getOpCapabilities({
      authProvider: 'cognito',
      cognito: { enabled: true },
      realtimeEnabled: true,
      capabilities: {
        auth: false,
        realtime: false,
        cloudVault: false,
        billingGuard: false,
        shareLinks: false,
        publicSignupPrepared: true,
        publicSignupEnabled: true,
      },
      publicSignupPrepared: false,
      publicSignupEnabled: false,
    });

    expect(caps.auth).toBe(false);
    expect(caps.realtime).toBe(false);
    expect(caps.cloudVault).toBe(false);
    expect(caps.billingGuard).toBe(false);
    expect(caps.shareLinks).toBe(false);
    expect(caps.publicSignupPrepared).toBe(true);
    expect(caps.publicSignupEnabled).toBe(true);
  });
});

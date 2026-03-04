import { TestBed } from '@angular/core/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { CognitoOidcService } from './auth/cognito-oidc.service';
import { AuthService } from './auth.service';
import { STORAGE_ADAPTER } from './storage/storage-adapter';
import { LocalStorageAdapter } from './storage/local-storage.adapter';
import { StorageService } from './storage/storage.service';

describe('AuthService phone-mode sync', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [{ provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter }],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();
    const auth = TestBed.inject(AuthService);
    await auth.hydrate();
  });

  it('round-trips login phone mode preference and ignores malformed values', async () => {
    const auth = TestBed.inject(AuthService);
    const storage = TestBed.inject(StorageService);

    auth.setLoginPhoneModePreference(true);
    expect(auth.getLoginPhoneModePreference()).toBe(true);

    await storage.setItem('op_login_phone_mode', 'invalid-json');
    expect(auth.getLoginPhoneModePreference()).toBeNull();
  });

  it('does not apply login phone mode preference while logged out', () => {
    const auth = TestBed.inject(AuthService);

    auth.setLoginPhoneModePreference(true);
    auth.applyLoginPhoneModePreference();

    expect(auth.consumeLoginPhoneModeApplyFlag()).toBe(false);
  });

  it('applies login phone mode preference when logged in and marks apply flag', () => {
    const auth = TestBed.inject(AuthService);
    auth.loginAsGuest();

    const current = auth.preferences().phoneMode;
    const next = !current;
    auth.setLoginPhoneModePreference(next);

    auth.applyLoginPhoneModePreference();

    expect(auth.preferences().phoneMode).toBe(next);
    expect(auth.consumeLoginPhoneModeApplyFlag()).toBe(true);
    expect(auth.consumeLoginPhoneModeApplyFlag()).toBe(false);
  });

  it('does not mark apply flag when login phone mode matches current preference', () => {
    const auth = TestBed.inject(AuthService);
    auth.loginAsGuest();

    const current = auth.preferences().phoneMode;
    auth.setLoginPhoneModePreference(current);

    auth.applyLoginPhoneModePreference();

    expect(auth.consumeLoginPhoneModeApplyFlag()).toBe(false);
  });

  it('falls back safely when persisted session contract is malformed', async () => {
    const auth = TestBed.inject(AuthService);
    const storage = TestBed.inject(StorageService);

    await storage.setItem('op_session', JSON.stringify({ userId: 123, previewPersist: 'yes' }));
    await auth.hydrate();

    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.session().userId).toBeNull();
  });

  it('normalizes non-admin session shape without dropping required nullable fields', async () => {
    const auth = TestBed.inject(AuthService);
    const storage = TestBed.inject(StorageService);
    await storage.setItem(
      'op_users',
      JSON.stringify([
        { id: 'u_guest', username: 'guest', role: 'user' },
        { id: 'u_123', username: 'alice', role: 'user', password: '' },
      ]),
    );
    await storage.setItem(
      'op_session',
      JSON.stringify({
        userId: 'u_123',
        previewUserId: null,
        previewPersist: false,
        sessionRole: 'user',
        sessionUsername: 'alice',
        universeOwnerId: null,
        universeId: null,
      }),
    );

    await auth.hydrate();

    const session = auth.session();
    expect(session.userId).toBe('u_123');
    expect(session.previewUserId).toBeNull();
    expect(session.previewPersist).toBe(false);
    expect(session.sessionRole ?? null).toBeNull();
    expect(session.sessionUsername ?? null).toBeNull();
    expect(session.universeOwnerId ?? null).toBeNull();
    expect(typeof session.universeId).toBe('string');
    expect(String(session.universeId).length).toBeGreaterThan(0);
  });

  it('enforces invite policy guard for non-owner sessions', async () => {
    const auth = TestBed.inject(AuthService);
    const result = await auth.createInvitee('owner_1', 'editor1', 'pass123');
    expect(result.ok).toBe(false);
    expect(result.message).toBe('users.error.adminOnly');
  });
});

class MockExternalCognitoOidcService {
  isEnabled() {
    return true;
  }
  isConfigured() {
    return true;
  }
  getProfile() {
    return {
      sub: 'ext-user-1',
      username: 'roynouneh',
      email: 'roy.nouneh@gmail.com',
    };
  }
  clearSession() {
    // test double
  }
  startLogout() {
    // test double
  }
  async startLogin() {
    // test double
  }
  async startSignup() {
    // test double
  }
}

describe('AuthService external auth phone-mode behavior', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [
        { provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter },
        { provide: CognitoOidcService, useClass: MockExternalCognitoOidcService },
      ],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();
    const auth = TestBed.inject(AuthService);
    await auth.hydrate();
  });

  afterEach(() => {
    const w = window as Window & { __OP_CONFIG__?: unknown };
    delete w.__OP_CONFIG__;
  });

  it('applies login phone mode to device-local prefs for external auth without sync apply flag', async () => {
    const auth = TestBed.inject(AuthService);
    const storage = TestBed.inject(StorageService);

    expect(auth.isLoggedIn()).toBe(true);
    const before = auth.preferences().phoneMode;

    await storage.setItem('op_login_phone_mode', JSON.stringify(!before));
    auth.applyLoginPhoneModePreference();

    expect(auth.consumeLoginPhoneModeApplyFlag()).toBe(false);

    const rawDevicePrefs = window.localStorage.getItem('op_device_ui_prefs_v1');
    expect(rawDevicePrefs).toBeTruthy();
    const parsed = JSON.parse(String(rawDevicePrefs)) as Record<string, { phoneMode?: boolean }>;
    expect(parsed['ext-user-1']?.phoneMode).toBe(!before);
  });

  it('keeps phone mode device-local when saving synced preferences in external auth', () => {
    const auth = TestBed.inject(AuthService);

    auth.setLoginPhoneModePreference(true);
    auth.applyLoginPhoneModePreference();
    const current = auth.preferences();
    auth.savePreferences({ ...current, language: 'fr', phoneMode: true });

    const storedPrefsRaw = window.localStorage.getItem('op_prefs');
    expect(storedPrefsRaw).toBeTruthy();
    const storedPrefs = JSON.parse(String(storedPrefsRaw)) as Record<
      string,
      { phoneMode?: boolean; language?: string }
    >;
    const syncedEntry = storedPrefs[auth.storageUserKey()];
    expect(syncedEntry).toBeTruthy();
    expect(syncedEntry.language).toBe('fr');
    expect(syncedEntry.phoneMode).toBe(false);
    expect(auth.preferences().phoneMode).toBe(true);
  });

  it('keeps login screen phone-mode checkbox in sync with external-auth in-app phone mode', () => {
    const auth = TestBed.inject(AuthService);

    auth.setLoginPhoneModePreference(false);
    auth.applyLoginPhoneModePreference();

    const current = auth.preferences();
    auth.savePreferences({ ...current, phoneMode: true });

    expect(auth.getLoginPhoneModePreference()).toBe(true);
  });

  it('skips remote persist when serialized value is unchanged', async () => {
    const auth = TestBed.inject(AuthService);
    const authPrivate = auth as unknown as { persist: (key: string, value: unknown) => void };
    const storage = TestBed.inject(StorageService);
    const key = 'op_test_persist_noop';
    const value = { hello: 'world', n: 1 };
    await storage.setItem(key, JSON.stringify(value));
    let calls = 0;
    const originalSetItem = storage.setItem.bind(storage);
    storage.setItem = (async (k: string, v: string) => {
      calls += 1;
      return originalSetItem(k, v);
    }) as StorageService['setItem'];

    authPrivate.persist(key, value);

    await Promise.resolve();
    expect(calls).toBe(0);
    storage.setItem = originalSetItem;
  });

  it('does not re-persist unchanged external auth session on subsequent hydrate', async () => {
    const auth = TestBed.inject(AuthService);
    const storage = TestBed.inject(StorageService);
    let setCalls = 0;
    const originalSetItem = storage.setItem.bind(storage);
    storage.setItem = (async (...args: Parameters<StorageService['setItem']>) => {
      setCalls += 1;
      return originalSetItem(...args);
    }) as StorageService['setItem'];

    await auth.hydrate();
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(setCalls).toBe(0);
    storage.setItem = originalSetItem;
  });

  it('retries once on version_conflict for non-ephemeral auth keys', async () => {
    const auth = TestBed.inject(AuthService);
    const authPrivate = auth as unknown as { persist: (key: string, value: unknown) => void };
    const storage = TestBed.inject(StorageService);
    const key = 'op_test_persist_retry';
    const value = { retry: true };
    const conflict = Object.assign(new Error('version_conflict'), { code: 'version_conflict' });
    let setCalls = 0;
    let getItemCalls = 0;
    const originalSetItem = storage.setItem.bind(storage);
    const originalGetItem = storage.getItem.bind(storage);
    const originalGetItemSync = storage.getItemSync.bind(storage);
    storage.setItem = (async (keyName: string, serialized: string) => {
      void keyName;
      void serialized;
      setCalls += 1;
      if (setCalls === 1) throw conflict;
      return Promise.resolve();
    }) as StorageService['setItem'];
    storage.getItem = (async (k: string) => {
      void k;
      getItemCalls += 1;
      return null;
    }) as StorageService['getItem'];
    storage.getItemSync = ((k: string) => {
      void k;
      return null;
    }) as StorageService['getItemSync'];

    authPrivate.persist(key, value);
    await Promise.resolve();
    expect(setCalls).toBe(1);
    expect(getItemCalls).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 160));
    expect(setCalls).toBe(2);
    storage.setItem = originalSetItem;
    storage.getItem = originalGetItem;
    storage.getItemSync = originalGetItemSync;
  });

  it('keeps public signup disabled when prepared=true but enabled=false', async () => {
    const w = window as Window & {
      __OP_CONFIG__?: { publicSignupPrepared?: boolean; publicSignupEnabled?: boolean };
    };
    w.__OP_CONFIG__ = { publicSignupPrepared: true, publicSignupEnabled: false };
    const auth = TestBed.inject(AuthService);

    expect(auth.isPublicSignupPrepared()).toBe(true);
    expect(auth.isPublicSignupEnabled()).toBe(false);
    const result = await auth.startExternalSignup();
    expect(result.ok).toBe(false);
  });

  it('starts external signup only when capability is prepared and enabled', async () => {
    const w = window as Window & {
      __OP_CONFIG__?: {
        authProvider?: 'cognito';
        publicSignupPrepared?: boolean;
        publicSignupEnabled?: boolean;
      };
    };
    w.__OP_CONFIG__ = {
      authProvider: 'cognito',
      publicSignupPrepared: true,
      publicSignupEnabled: true,
    };
    const auth = TestBed.inject(AuthService);
    const cognito = TestBed.inject(CognitoOidcService) as unknown as {
      startSignup: () => Promise<void>;
    };
    const signupSpy = vi.spyOn(cognito, 'startSignup').mockResolvedValue();

    const result = await auth.startExternalSignup();

    expect(result.ok).toBe(true);
    expect(signupSpy).toHaveBeenCalledTimes(1);
  });

  it('derives universe permission helpers consistently for owner and observer contexts', () => {
    const auth = TestBed.inject(AuthService);
    const ownerPermissions = auth.getUniversePermissionSet({
      universeOwnerId: 'ext-user-1',
      multiUserEnabled: true,
      universeEditHolderId: null,
    });
    const observerPermissions = auth.getUniversePermissionSet({
      universeOwnerId: 'someone-else',
      multiUserEnabled: true,
      universeEditHolderId: null,
      viaShareLink: true,
    });

    expect(ownerPermissions.canInvite).toBe(true);
    expect(ownerPermissions.canGrantPencil).toBe(true);
    expect(ownerPermissions.canEditUniverse).toBe(true);
    expect(observerPermissions.canViewOnly).toBe(true);
    expect(observerPermissions.canEditUniverse).toBe(false);
  });
});

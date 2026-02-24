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
});

import { TestBed } from '@angular/core/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
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

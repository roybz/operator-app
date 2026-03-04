import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  TranslateFakeLoader,
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { AppComponent } from './app';
import { STORAGE_ADAPTER } from './core/storage/storage-adapter';
import { LocalStorageAdapter } from './core/storage/local-storage.adapter';
import { StorageService } from './core/storage/storage.service';
import { RemoteConflictService } from './core/realtime/remote-conflict.service';
import { AuthService } from './core/auth.service';
import { vi } from 'vitest';

type OpWindow = Window & {
  __OP_CONFIG__?: { mockMode?: boolean; guestModeOnly?: boolean; apiBaseUrl?: string };
};

describe('App', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    window.localStorage.setItem(
      'op_users',
      JSON.stringify([{ id: 'u_admin', username: 'admin', password: '', role: 'admin' }]),
    );
    window.localStorage.setItem(
      'op_session',
      JSON.stringify({ userId: 'u_admin', previewUserId: null, previewPersist: false }),
    );
    window.localStorage.setItem('op_prefs', JSON.stringify({}));
    window.localStorage.setItem(
      'op_org_settings',
      JSON.stringify({ siteTitle: 'Operator App', siteLogoEmoji: '🌎' }),
    );
    window.localStorage.setItem('op_accessibility_prompted_u_admin', 'true');

    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [provideRouter([]), { provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter }],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('shows loading screen while loading is visible', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as unknown as { loadingVisible: () => boolean };
    fixture.detectChanges();

    expect(app.loadingVisible()).toBe(true);
    const loading = fixture.nativeElement.querySelector('#loading-screen');
    expect(loading).toBeTruthy();
  });

  it('renders translated header and mock label', () => {
    const w = window as OpWindow;
    w.__OP_CONFIG__ = { mockMode: true, guestModeOnly: false };

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      mock: { label: 'Test mode' },
      auth: { loggedInAs: 'Logged in as {{user}}' },
      nav: { collapse: 'Collapse', expand: 'Expand', settings: 'Settings', logout: 'Log out' },
      apps: {
        todo: 'Todos',
        todoGroup: 'Todos',
        calculator: 'Calculators',
        calculatorGroup: 'Calculators',
        timer: 'Timers',
        timerGroup: 'Timers',
        navigator: 'Navigators',
        navigatorGroup: 'Navigators',
        notes: 'Notes',
        notesGroup: 'Notes',
      },
      workspaces: { button: 'Workspaces' },
      topbar: { collapse: 'Collapse top bar', expand: 'Expand top bar' },
      dialogs: {
        reset: 'Reset dialog positions',
        resetLeft: 'Reset to the left',
        resetMiddle: 'Reset to the middle',
        confirmDelete: 'Delete this instance permanently?',
        confirm: 'Delete',
        cancel: 'Cancel',
        hideAll: 'Hide all dialogs',
        showAll: 'Show all dialogs',
        lockDelete: 'Lock delete',
        unlockDelete: 'Unlock delete',
      },
    });
    translate.use('en');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    fixture.componentInstance.loadingVisible.set(false);
    fixture.detectChanges();

    expect(fixture.componentInstance.siteTitle()).toContain('Operator App');
    expect(fixture.componentInstance.loadingVisible()).toBe(false);
  });

  it('suppresses one rebroadcasted remote-change event after forced apply', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as unknown as {
      storage: StorageService;
      auth: { isLoggedIn: () => boolean; usesExternalAuth: () => boolean };
      applyRemoteStorageChange: (keys: string[]) => Promise<void>;
      suppressRemoteChangeSignature: string | null;
      suppressRemoteChangeUntil: number;
      lastStorageRemoteChangeSeq: number;
    };
    const storage = TestBed.inject(StorageService);
    const applySpy = vi.spyOn(app, 'applyRemoteStorageChange').mockResolvedValue();
    vi.spyOn(app.auth, 'isLoggedIn').mockReturnValue(true);
    vi.spyOn(app.auth, 'usesExternalAuth').mockReturnValue(true);

    app.suppressRemoteChangeSignature = 'op_prefs|op_session';
    app.suppressRemoteChangeUntil = Date.now() + 5_000;
    app.lastStorageRemoteChangeSeq = 0;

    storage.lastRemoteChange.set({ seq: 1, keys: ['op_session', 'op_prefs'] });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(applySpy).not.toHaveBeenCalled();
    expect(app.suppressRemoteChangeSignature).toBeNull();
    expect(app.suppressRemoteChangeUntil).toBe(0);
  });

  it('renders remote conflict banner when pending conflict is visible', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as unknown as {
      remoteConflictBannerVisible: { set: (v: boolean) => void };
      remoteConflict: RemoteConflictService;
      auth: AuthService;
    };
    vi.spyOn(app.auth, 'isLoggedIn').mockReturnValue(true);
    fixture.detectChanges();
    app.remoteConflict.queue(['op_session'], 'dirty');
    app.remoteConflictBannerVisible.set(true);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.remote-conflict-banner');
    expect(banner).toBeTruthy();
  });

  it('queues then auto-applies deferred remote conflict when idle', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as unknown as {
      remoteConflictPending: () => { keys: string[] } | null;
      remoteConflictBannerVisible: { set: (v: boolean) => void; (): boolean };
      remoteConflict: RemoteConflictService;
      storage: StorageService;
      applyRemoteStorageChange: (keys: string[], options?: { force?: boolean }) => Promise<void>;
      tryAutoApplyDeferredRemoteConflict: () => Promise<void>;
      suppressRemoteChangeSignature: string | null;
      suppressRemoteChangeUntil: number;
    };
    const storage = TestBed.inject(StorageService);
    const remoteConflict = TestBed.inject(RemoteConflictService);
    const emitSpy = vi.spyOn(storage, 'emitRemoteChange');
    const applySpy = vi.spyOn(app, 'applyRemoteStorageChange').mockResolvedValue();

    remoteConflict.queue(['x', 'a'], 'dirty');
    app.remoteConflictBannerVisible.set(true);
    vi.spyOn(storage, 'getLastLocalMutationAt').mockReturnValue(0);

    await app.tryAutoApplyDeferredRemoteConflict();

    expect(applySpy).toHaveBeenCalledWith(['a', 'x'], { force: true });
    expect(emitSpy).toHaveBeenCalledWith(['a', 'x']);
    expect(app.remoteConflictPending()).toBeNull();
    expect(app.remoteConflictBannerVisible()).toBe(false);
    expect(app.suppressRemoteChangeSignature).toBe('a|x');
    expect(app.suppressRemoteChangeUntil).toBeGreaterThan(Date.now() - 1000);
  });

  it('forces mock/local-only mode for guest users even when backend is configured and admin test mode is off', () => {
    const w = window as OpWindow;
    w.__OP_CONFIG__ = {
      mockMode: false,
      guestModeOnly: false,
      apiBaseUrl: 'https://api.example.com',
    };
    const fixture = TestBed.createComponent(AppComponent);
    const auth = fixture.componentInstance.auth;

    auth.saveOrgSettings({ ...auth.orgSettings(), testModeEnabled: false });
    auth.loginAsGuest();

    expect(auth.actualUser()?.id).toBe('u_guest');
    expect(fixture.componentInstance.isMockMode()).toBe(true);
  });

  it('forces mock/local-only mode for authenticated admins when org test mode is enabled', () => {
    const w = window as OpWindow;
    w.__OP_CONFIG__ = {
      mockMode: false,
      guestModeOnly: false,
      apiBaseUrl: 'https://api.example.com',
    };
    const fixture = TestBed.createComponent(AppComponent);
    const auth = fixture.componentInstance.auth;

    auth.saveOrgSettings({ ...auth.orgSettings(), testModeEnabled: true });

    expect(fixture.componentInstance.isMockMode()).toBe(true);
  });

  it('keeps deferred remote conflict pending while local writes are still recent', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as unknown as {
      remoteConflictPending: () => { keys: string[] } | null;
      remoteConflict: RemoteConflictService;
      storage: StorageService;
      applyRemoteStorageChange: (keys: string[], options?: { force?: boolean }) => Promise<void>;
      tryAutoApplyDeferredRemoteConflict: () => Promise<void>;
      scheduleDeferredRemoteApply: () => void;
    };
    const storage = TestBed.inject(StorageService);
    const remoteConflict = TestBed.inject(RemoteConflictService);
    const applySpy = vi.spyOn(app, 'applyRemoteStorageChange').mockResolvedValue();
    const rescheduleSpy = vi.spyOn(app, 'scheduleDeferredRemoteApply').mockImplementation(() => {
      // test stub
    });

    remoteConflict.queue(['busy-key'], 'recent-local-write');
    vi.spyOn(storage, 'getLastLocalMutationAt').mockReturnValue(Date.now());

    await app.tryAutoApplyDeferredRemoteConflict();

    expect(applySpy).not.toHaveBeenCalled();
    expect(rescheduleSpy).toHaveBeenCalled();
    expect(app.remoteConflictPending()?.keys).toEqual(['busy-key']);
  });
});
